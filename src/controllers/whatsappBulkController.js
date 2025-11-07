const prisma = require("../database");
const crypto = require("crypto");
const whatsappQueueBulk = require("../queues/whatsappQueueBulk");

const BLOCKED_HOURS = [
    { start: 12, end: 14 }, // almoço
    { start: 20, end: 24 }, // noite
    { start: 0, end: 8 },   // madrugada
];

// Verifica se o horário é bloqueado
function isBlockedHour(date) {
    const hour = date.getHours();
    return BLOCKED_HOURS.some(({ start, end }) =>
        start < end ? hour >= start && hour < end : hour >= start || hour < end
    );
}

// Avança até o próximo horário permitido
function adjustToNextValidTime(date) {
    let adjusted = new Date(date);
    while (isBlockedHour(adjusted)) {
        adjusted.setMinutes(adjusted.getMinutes() + 15); // pula em blocos de 15 min
    }
    return adjusted;
}

// Converte string tipo "2025-01-17 10:47:23" para Date
function parseSendAt(sendAt) {
    if (!sendAt) return null;
    try {
        const [datePart, timePart] = sendAt.split(" ");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute, second] = timePart.split(":").map(Number);
        return new Date(year, month - 1, day, hour, minute, second);
    } catch {
        return null;
    }
}

async function storeBulk(request, reply) {
    const customer_id = request.customer;
    const { data } = request.body;

    if (!Array.isArray(data) || data.length === 0) {
        return reply.status(400).send({
            message: "Invalid format: 'data' must be a non-empty array of messages.",
        });
    }

    if (data.length > 500) {
        return reply.status(400).send({
            message: "The maximum number of messages allowed is 500.",
        });
    }

    const whatsappOptionConfiguration =
        await prisma.whatsappOptionsForCustomers.findFirst({
            where: { customer_id },
        });

    if (!whatsappOptionConfiguration) {
        return reply
            .status(404)
            .send({ message: "Whatsapp configuration not provided" });
    }

    const results = [];
    const groupedByTime = {};

    // Agrupar mensagens pelo sendAt
    for (const item of data) {
        const key = item.sendAt || "immediate";
        if (!groupedByTime[key]) groupedByTime[key] = [];
        groupedByTime[key].push(item);
    }

    const FIXED_DELAY = 40000; // 40 segundos fixos

    for (const [sendAtKey, group] of Object.entries(groupedByTime)) {
        let baseSendAt = sendAtKey !== "immediate" ? parseSendAt(sendAtKey) : null;

        // Ajusta o sendAt se estiver em horário bloqueado
        if (baseSendAt && isBlockedHour(baseSendAt)) {
            baseSendAt = adjustToNextValidTime(baseSendAt);
        }

        // Hora base de envio (agora ou sendAt ajustado)
        let nextSendTime = baseSendAt ? new Date(baseSendAt) : new Date();

        for (const item of group) {
            const { country, dd, number, message } = item;

            if (!country || !dd || !number || !message) {
                results.push({
                    item,
                    status: "error",
                    message: "Missing required fields (country, dd, number, message)",
                });
                continue;
            }

            // Se o próximo horário cair em período bloqueado, pula pro horário permitido
            if (isBlockedHour(nextSendTime)) {
                nextSendTime = adjustToNextValidTime(nextSendTime);
            }

            const now = Date.now();
            const delay = Math.max(nextSendTime.getTime() - now, 0);

            const whatsappData = {
                id: crypto.randomUUID(),
                customer_id,
                zapi_client_instance: whatsappOptionConfiguration.zapi_client_instance,
                number: `${country}${dd}${number.slice(1)}`,
                status: {},
                received: {},
                message,
            };

            try {
                const newWhatsappNotification = await prisma.whatsappNotifications.create({
                    data: whatsappData,
                });

                const dataWhatsapp = {
                    ...whatsappData,
                    url: `${whatsappOptionConfiguration.zapi_client_url}/send-text`,
                    zapi_client_token: whatsappOptionConfiguration.zapi_client_token,
                };

                // Enfileira com o delay calculado
                await whatsappQueueBulk.add(dataWhatsapp, { delay });

                results.push({
                    id: newWhatsappNotification.id,
                    number: whatsappData.number,
                    status: "queued",
                    sendAt: nextSendTime.toISOString(),
                    delay,
                });

                // Avança 40 segundos para a próxima mensagem
                nextSendTime = new Date(nextSendTime.getTime() + FIXED_DELAY);
            } catch (error) {
                results.push({
                    item,
                    status: "error",
                    message: error.message || "Failed to queue message",
                });
            }
        }
    }

    return reply.send({
        success: true,
        total: data.length,
        processed: results.length,
        results,
    });
}

module.exports = { storeBulk };
const prisma = require("../database");
const crypto = require("crypto");
const whatsappQueueBulk = require("../queues/whatsappQueueBulk");

// Faixas de horário proibido
const BLOCKED_HOURS = [
    { start: 12, end: 14 }, // 12h às 14h
    { start: 20, end: 24 }, // 20h às 00h
    { start: 0, end: 8 },   // 00h às 08h
];

// Função para verificar se o horário é bloqueado
function isBlockedHour(date) {
    const hour = date.getHours();
    return BLOCKED_HOURS.some(({ start, end }) =>
        start < end ? hour >= start && hour < end : hour >= start || hour < end
    );
}

// Corrige o horário para o próximo horário permitido
function adjustToNextValidTime(date) {
    let adjusted = new Date(date);
    while (isBlockedHour(adjusted)) {
        adjusted.setMinutes(adjusted.getMinutes() + 15); // avança em blocos de 15 minutos
    }
    return adjusted;
}

// Converter string "2025-01-17 10:47:23" para Date
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

    // Agrupar mensagens por horário sendAt para aplicar delay entre elas
    const groupedByTime = {};
    for (const item of data) {
        const key = item.sendAt || "immediate";
        if (!groupedByTime[key]) groupedByTime[key] = [];
        groupedByTime[key].push(item);
    }

    // Processar cada grupo (horário)
    for (const [sendAtKey, group] of Object.entries(groupedByTime)) {
        let baseSendAt = sendAtKey !== "immediate" ? parseSendAt(sendAtKey) : null;

        if (baseSendAt) {
            // Ajustar se estiver em horário bloqueado
            if (isBlockedHour(baseSendAt)) {
                baseSendAt = adjustToNextValidTime(baseSendAt);
            }
        }

        // Controlar delays aleatórios para mensagens com mesmo horário
        let accumulatedDelay = 0;

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

                // Definir delay base
                let delay = 0;
                if (baseSendAt) {
                    const now = Date.now();
                    delay = Math.max(baseSendAt.getTime() - now, 0);
                } else {
                    delay = Math.floor(Math.random() * 4000) + 1000; // 1 a 5 segundos
                }

                // Adicionar delay extra entre mensagens com mesmo horário
                if (group.length > 1) {
                    const extraDelay = Math.floor(Math.random() * (40000 - 15000 + 1)) + 15000; // 15s a 40s
                    accumulatedDelay += extraDelay;
                    delay += accumulatedDelay;
                }

                await whatsappQueueBulk.add(dataWhatsapp, { delay });

                results.push({
                    id: newWhatsappNotification.id,
                    number: whatsappData.number,
                    status: "queued",
                    sendAt: baseSendAt ? baseSendAt.toISOString() : null,
                    delay,
                });
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

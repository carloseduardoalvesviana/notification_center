const prisma = require("../database");
const crypto = require("crypto");
const whatsappQueueBulk = require("../queues/whatsappQueueBulk");
const Redis = require("ioredis");
const { env } = require("../env");

// 🔹 Cliente Redis (para controle de intervalo entre envios)
const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
});

// 🔹 Horários bloqueados
const BLOCKED_HOURS = [
    { start: 12, end: 14 }, // almoço
    { start: 20, end: 24 }, // noite
    { start: 0, end: 8 },   // madrugada
];

// Verifica se o horário está dentro de um intervalo bloqueado
function isBlockedHour(date) {
    const hour = date.getHours();
    return BLOCKED_HOURS.some(({ start, end }) =>
        start < end ? hour >= start && hour < end : hour >= start || hour < end
    );
}

// Avança até o próximo horário permitido (pula em blocos de 15 minutos)
function adjustToNextValidTime(date) {
    let adjusted = new Date(date);
    while (isBlockedHour(adjusted)) {
        adjusted.setMinutes(adjusted.getMinutes() + 15);
    }
    return adjusted;
}

// Faz o parse do campo sendAt (YYYY-MM-DD HH:mm:ss)
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

// 🔹 Delay dinâmico com base em valores fixos aleatórios
function getDynamicDelay() {
    const possibleDelays = [19, 23, 27, 31, 35, 41, 47]; // segundos
    const randomSeconds = possibleDelays[Math.floor(Math.random() * possibleDelays.length)];
    return randomSeconds * 1000; // converte para milissegundos
}

// 🔹 Recupera o último horário de envio do cliente no Redis
async function getNextAvailableTime(customer_id) {
    const lastTimeStr = await redis.get(`lastSendTime:${customer_id}`);
    if (!lastTimeStr) return new Date();
    const lastTime = new Date(lastTimeStr);
    const now = new Date();
    // se o último envio ainda está no futuro, adiciona 10s de folga
    return lastTime > now ? new Date(lastTime.getTime() + 10_000) : now;
}

// 🔹 Atualiza o próximo horário disponível no Redis (expira em 2h)
async function setNextAvailableTime(customer_id, date) {
    await redis.set(
        `lastSendTime:${customer_id}`,
        date.toISOString(),
        "EX",
        60 * 60 * 2 // 2 horas
    );
}

// 🔹 Função principal
async function storeBulk(request, reply) {
    const customer_id = request.customer;
    const { data } = request.body;

    // validações
    if (!Array.isArray(data) || data.length === 0) {
        return reply.status(400).send({ message: "Invalid format: 'data' must be a non-empty array of messages." });
    }

    if (data.length > 500) {
        return reply.status(400).send({ message: "The maximum number of messages allowed is 500." });
    }

    const whatsappOptionConfiguration = await prisma.whatsappOptionsForCustomers.findFirst({
        where: { customer_id },
    });

    if (!whatsappOptionConfiguration) {
        return reply.status(404).send({ message: "Whatsapp configuration not provided" });
    }

    const results = [];
    const groupedByTime = {};

    // agrupa por horário de envio (sendAt)
    for (const item of data) {
        const key = item.sendAt || "immediate";
        if (!groupedByTime[key]) groupedByTime[key] = [];
        groupedByTime[key].push(item);
    }

    // começa pelo último horário salvo no Redis
    let globalNextSendTime = await getNextAvailableTime(customer_id);

    for (const [sendAtKey, group] of Object.entries(groupedByTime)) {
        let baseSendAt = sendAtKey !== "immediate" ? parseSendAt(sendAtKey) : null;

        // se o sendAt está no passado, reprograma com delay aleatório
        if (baseSendAt && baseSendAt.getTime() < Date.now()) {
            baseSendAt = new Date(Date.now() + getDynamicDelay());
        }

        // ajusta se estiver em horário bloqueado
        if (baseSendAt && isBlockedHour(baseSendAt)) {
            baseSendAt = adjustToNextValidTime(baseSendAt);
        }

        // define o primeiro horário disponível
        let nextSendTime = baseSendAt ? new Date(Math.max(baseSendAt, globalNextSendTime)) : globalNextSendTime;

        for (const item of group) {
            const { country, dd, number, message } = item;

            if (!country || !dd || !number || !message) {
                results.push({ item, status: "error", message: "Missing required fields" });
                continue;
            }

            // delay aleatório e dinâmico
            const randomDelayMs = getDynamicDelay();
            let candidateSendTime = new Date(nextSendTime.getTime() + randomDelayMs);

            // pula horários bloqueados se necessário
            if (isBlockedHour(candidateSendTime)) {
                candidateSendTime = adjustToNextValidTime(candidateSendTime);
                candidateSendTime = new Date(candidateSendTime.getTime() + getDynamicDelay());
            }

            const now = Date.now();
            const finalSendTime = new Date(Math.max(candidateSendTime.getTime(), now));
            const delay = finalSendTime.getTime() - now;

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
                const newWhatsappNotification = await prisma.whatsappNotifications.create({ data: whatsappData });

                const dataWhatsapp = {
                    ...whatsappData,
                    url: `${whatsappOptionConfiguration.zapi_client_url}/send-text`,
                    zapi_client_token: whatsappOptionConfiguration.zapi_client_token,
                };

                // adiciona na fila com delay
                await whatsappQueueBulk.add(dataWhatsapp, { delay });

                results.push({
                    id: newWhatsappNotification.id,
                    number: whatsappData.number,
                    status: "queued",
                    sendAt: finalSendTime.toISOString(),
                    delay,
                });

                // próxima mensagem começa 1s depois da anterior
                nextSendTime = new Date(finalSendTime.getTime() + 1000);
            } catch (error) {
                results.push({ item, status: "error", message: error.message });
            }
        }

        // atualiza o tempo global do cliente no Redis (+10s entre lotes)
        globalNextSendTime = new Date(nextSendTime.getTime() + 10_000);
        await setNextAvailableTime(customer_id, globalNextSendTime);
    }

    // resposta final
    return reply.send({
        success: true,
        total: data.length,
        processed: results.length,
        results,
    });
}

module.exports = { storeBulk };

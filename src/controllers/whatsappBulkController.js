const prisma = require("../database");
const crypto = require("crypto");
const whatsappQueue = require("../queues/whatsappQueue");

async function storeBulk(request, reply) {
    const customer_id = request.customer;
    const { data } = request.body;

    if (!Array.isArray(data) || data.length === 0) {
        return reply.status(400).send({
            message: "Invalid format: 'data' must be a non-empty array of messages.",
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

    // --- Função para converter sendAt (ex: "2025-01-17 10:47:23") ---
    function parseSendAt(sendAt) {
        if (!sendAt) return null;
        try {
            const [datePart, timePart] = sendAt.split(" ");
            const [year, month, day] = datePart.split("-").map(Number);
            const [hour, minute, second] = timePart.split(":").map(Number);
            return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, second));
        } catch {
            return null;
        }
    }

    const results = [];

    for (const item of data) {
        const { country, dd, number, message, sendAt } = item;

        if (!country || !dd || !number || !message) {
            results.push({
                item,
                status: "error",
                message: "Missing required fields (country, dd, number, message)",
            });
            continue;
        }

        const sentAt = parseSendAt(sendAt);

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

            let delay = 0;
            if (sentAt) {
                const now = Date.now();
                delay = Math.max(sentAt.getTime() - now, 0);
            } else {
                delay = Math.floor(Math.random() * 4000) + 1000; // 1 a 5 segundos
            }

            await whatsappQueue.add(dataWhatsapp, { delay });

            results.push({
                id: newWhatsappNotification.id,
                number: whatsappData.number,
                status: "queued",
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

    return reply.send({
        success: true,
        total: data.length,
        processed: results.length,
        results,
    });
}

module.exports = { storeBulk };

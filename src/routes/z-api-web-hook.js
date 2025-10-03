const prisma = require("../database");
const { env } = require("../env");

async function zApiWebHook(server) {
  server.post("/webhook-received", async (req, res) => {
    const { phone, instanceId } = req.body;

    const record = await prisma.whatsappNotifications.findFirst({
      where: {
        number: `+${phone}`,
        zapi_client_instance: instanceId,
      },
      orderBy: {
        created_at: "desc", // Changed from createdAt to created_at
      },
    });

    if (record) {
      await prisma.whatsappNotifications.update({
        where: {
          id: record.id,
        },
        data: {
          received: { ...req.body },
        },
      });
    }

    try {
      await fetch(env.URL_NOTIFICATION, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });
    } catch (error) {
      console.error("Erro ao enviar para central-de-notificacoes:", error);
    }

    return res.status(200).send({ message: "ok" });
  });
}

module.exports = zApiWebHook;

require("dotenv").config();

const fastify = require("fastify");
const emailRoutes = require("./routes/email");
const customersRoutes = require("./routes/customers");
const smsRoutes = require("./routes/sms");
const whatsappRoutes = require("./routes/whatsapp");
const prisma = require("./database");

const server = fastify({ logger: true });

server.get("/", (req, reply) => {
  return reply.status(200).send({
    message: "API running",
  });
});

server.register(customersRoutes); // admin only
server.register(emailRoutes);
server.register(smsRoutes);
server.register(whatsappRoutes);

server.post("/webhook-received", async (req, res) => {
  const { phone, instanceId } = req.body;

  console.log(req.body);

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
    await fetch(process.env.URL_NOTIFICATION, {
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

const port = process.env.PORT || 3000;
const host = "0.0.0.0"; // 👈 necessário no Docker

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`✅ API running at ${address}`);
});

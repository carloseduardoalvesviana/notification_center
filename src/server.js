const fastify = require("fastify");
const rateLimit = require("@fastify/rate-limit");

const emailRoutes = require("./routes/email");
const customersRoutes = require("./routes/customers");
const smsRoutes = require("./routes/sms");
const whatsappRoutes = require("./routes/whatsapp");
const zApiWebHook = require("./routes/z-api-web-hook");
const { env } = require("./env");

const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter"); // ✅ usa BullAdapter (não BullMQAdapter)
const { FastifyAdapter } = require("@bull-board/fastify");

const emailQueue = require("./queues/emailQueue");
const smsQueue = require("./queues/smsQueue");
const whatsappQueue = require("./queues/whatsappQueue");

const server = fastify({ logger: true });

/* ----------------------------- Bull Board ----------------------------- */
const serverAdapter = new FastifyAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullAdapter(emailQueue),
    new BullAdapter(smsQueue),
    new BullAdapter(whatsappQueue),
  ],
  serverAdapter,
});

server.register(serverAdapter.registerPlugin, { prefix: "/admin/queues" });

/* ----------------------------- Rate Limit ----------------------------- */
server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  ban: 5,
  keyGenerator: (req) => req.headers["x-real-ip"] || req.ip,
  errorResponseBuilder: (req, context) => ({
    code: 429,
    error: "Too Many Requests",
    message: `Você excedeu o limite de ${context.max} requisições em ${context.timeWindow}`,
  }),
});

/* ----------------------------- Rotas da API ----------------------------- */
server.get("/", (req, reply) => reply.status(200).send({ message: "API running 🚀" }));

server.register(customersRoutes);
server.register(emailRoutes);
server.register(smsRoutes);
server.register(whatsappRoutes);
server.register(zApiWebHook);

/* ----------------------------- Inicialização ----------------------------- */
const port = env.PORT || 3000;
const host = "0.0.0.0"; // necessário no Docker

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`✅ API running at ${address}`);
  console.log(`📊 Bull Board at ${address}/admin/queues`);
});

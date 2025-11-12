// Define timezone for consistent timestamps
process.env.TZ = "America/Sao_Paulo";

// --- Framework / plugins
// Fastify: web framework used to expose API routes
const fastify = require("fastify");
// Rate limiter plugin to protect endpoints from abuse
const rateLimit = require("@fastify/rate-limit");

// --- Route handlers (each file registers Fastify routes)
// - customersRoutes: POST /customers (admin only)
// - emailRoutes: POST /email
// - smsRoutes: POST /sms
// - whatsappRoutes: POST /whatsapp and POST /whatsapp-bulk
// - zApiWebHook: POST /webhook-received (used by Z-API integrations)
const emailRoutes = require("./routes/email");
const customersRoutes = require("./routes/customers");
const smsRoutes = require("./routes/sms");
const whatsappRoutes = require("./routes/whatsapp");
const zApiWebHook = require("./routes/z-api-web-hook");

// Environment variables validated in src/env.js (Zod)
const { env } = require("./env");

// --- Bull Board (dashboard) setup imports
// createBullBoard / BullAdapter / FastifyAdapter: used to mount the Bull UI
const { createBullBoard } = require('@bull-board/api')
const { BullAdapter } = require('@bull-board/api/bullAdapter')
const { FastifyAdapter } = require('@bull-board/fastify');

// --- Queue instances (Bull)
// Each queue file exports a Bull queue instance used by workers/controllers
const emailQueue = require("./queues/emailQueue");
const smsQueue = require("./queues/smsQueue");
const whatsappQueue = require("./queues/whatsappQueue");
const whatsappQueueBulk = require("./queues/whatsappQueueBulk");

// Fastify server with logging enabled
const server = fastify({ logger: true });

/* ----------------------------- Bull Board ----------------------------- */
const serverAdapter = new FastifyAdapter();

createBullBoard({
  queues: [
    new BullAdapter(emailQueue),
    new BullAdapter(smsQueue),
    new BullAdapter(whatsappQueue),
    new BullAdapter(whatsappQueueBulk)
  ],
  serverAdapter,
});

serverAdapter.setBasePath('/ui');
server.register(serverAdapter.registerPlugin(), { prefix: '/ui' });


/* ----------------------------- Rate Limit ----------------------------- */
server.register(rateLimit, {
  max: 1000,
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
server.get("/", (req, reply) => {
  const nowUtc = new Date().toISOString();
  const nowSaoPaulo = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  reply.status(200).send({
    message: "API running 🚀",
    utc: nowUtc,
    sao_paulo_time: nowSaoPaulo,
  });
});

// Register route modules with Fastify
// Each module (see ./routes/*.js) adds route definitions and any pre-handlers
server.register(customersRoutes); // routes: POST /customers
server.register(emailRoutes);     // routes: POST /email
server.register(smsRoutes);       // routes: POST /sms
server.register(whatsappRoutes);  // routes: POST /whatsapp, POST /whatsapp-bulk
server.register(zApiWebHook);     // routes: POST /webhook-received

/* ----------------------------- Inicialização ----------------------------- */
const port = env.PORT || 3000;
const host = "0.0.0.0"; // necessário no Docker

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`✅ API running at ${address}`);
  // Bull Board is mounted at /ui (FastifyAdapter base path)
  console.log(`📊 Bull Board at ${address}/ui`);
});

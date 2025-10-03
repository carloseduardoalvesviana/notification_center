const fastify = require("fastify");
const rateLimit = require("@fastify/rate-limit");
const emailRoutes = require("./routes/email");
const customersRoutes = require("./routes/customers");
const smsRoutes = require("./routes/sms");
const whatsappRoutes = require("./routes/whatsapp");
const zApiWebHook = require("./routes/z-api-web-hook");
const { env } = require("./env");

const server = fastify({ logger: true });

/**
 * Adicionando Rate Limiting (Throttle)
 * - max: máximo de requests no intervalo
 * - timeWindow: período em ms ou string (ex: '1 minute')
 * - ban: opcional → número de violações antes de banir
 */
server.register(rateLimit, {
  max: 100, // até 100 requisições
  timeWindow: "1 minute", // por minuto
  ban: 5, // opcional → depois de 5 estouros, o IP fica banido
  keyGenerator: (req) => req.headers["x-real-ip"] || req.ip, // personaliza a chave (IP real do proxy)
  errorResponseBuilder: (req, context) => {
    return {
      code: 429,
      error: "Too Many Requests",
      message: `Você excedeu o limite de ${context.max} requisições em ${context.timeWindow}`,
    };
  },
});

server.get("/", (req, reply) =>
  reply.status(200).send({ message: "API running" })
);

server.register(customersRoutes); // admin only
server.register(emailRoutes);
server.register(smsRoutes);
server.register(whatsappRoutes);
server.register(zApiWebHook);

const port = env.PORT || 3000;
const host = "0.0.0.0"; // 👈 necessário no Docker

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`✅ API running at ${address}`);
});

// Define timezone for consistent timestamps
process.env.TZ = "America/Sao_Paulo";

// --- Framework / plugins
// Fastify: web framework used to expose API routes
const fastify = require("fastify");
// Rate limiter plugin to protect endpoints from abuse
const rateLimit = require("@fastify/rate-limit");
const swagger = require("@fastify/swagger");
const swaggerUI = require("@fastify/swagger-ui");

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
const evolutionRoutes = require("./routes/evolution");
const zApiWebHook = require("./routes/z-api-web-hook");

// Environment variables validated in src/env.js (Zod)
const { env } = require("./env");

// --- Bull Board (dashboard) setup imports
// createBullBoard / BullAdapter / FastifyAdapter: used to mount the Bull UI
const { createBullBoard } = require('@bull-board/api')
const { BullAdapter } = require('@bull-board/api/bullAdapter')
const { FastifyAdapter } = require('@bull-board/fastify');

// --- Auth Plugins
const cookie = require("@fastify/cookie");
const formbody = require("@fastify/formbody");
const jwt = require("@fastify/jwt");
const authRoutes = require("./routes/auth");

// --- Queue instances (Bull)
// Each queue file exports a Bull queue instance used by workers/controllers
const emailQueue = require("./queues/emailQueue");
const smsQueue = require("./queues/smsQueue");
const whatsappQueue = require("./queues/whatsappQueue");
const whatsappQueueBulk = require("./queues/whatsappQueueBulk");
const evolutionWhatsappQueue = require("./queues/evolutionWhatsappQueue");

// Fastify server with logging enabled
const server = fastify({ logger: true });

// --- Auth Registration
server.register(cookie, {
  secret: "super-secret-key-change-in-prod-1234567890",
});
server.register(formbody);
server.register(jwt, {
  secret: "super-secret-jwt-key-change-in-prod-0987654321",
  cookie: {
    cookieName: "token",
    signed: false,
  },
});

server.register(authRoutes);

server.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/ui")) {
    try {
      await request.jwtVerify({ onlyCookie: true });
    } catch (err) {
      return reply.redirect("/login");
    }
  }
});

server.register(swagger, {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "Central de Notificações",
      description: "API para envio de notificações (E-mail, SMS e WhatsApp)",
      version: "1.0.0",
    },
    servers: [
      { url: `http://127.0.0.1:${env.PORT || 3000}` },
      { url: `http://localhost:${env.PORT || 3000}` }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      schemas: {
        SmsBody: {
          type: "object",
          required: ["country", "dd", "number", "message"],
          properties: {
            country: { type: "string", example: "+55" },
            dd: { type: "string", example: "99" },
            number: { type: "string", example: "999000111" },
            message: { type: "string", example: "Teste SMS" },
          },
        },
        WhatsappBody: {
          type: "object",
          required: ["country", "dd", "number", "message"],
          properties: {
            country: { type: "string", example: "+55" },
            dd: { type: "string", example: "99" },
            number: { type: "string", example: "999000111" },
            message: { type: "string", example: "Olá!" },
            image: { type: "string", example: "https://cdn.example.com/logo.png" },
            sendAt: { type: "string", example: "2025-11-07 10:25:23" },
          },
        },
        WhatsappBulkBody: {
          type: "object",
          required: ["data"],
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/WhatsappBody" },
            },
          },
        },
        EmailBody: {
          type: "object",
          required: ["email_to", "email_title", "email_header_title", "email_content", "email_footer_content"],
          properties: {
            email_to: { type: "string", example: "user@example.com" },
            email_title: { type: "string", example: "Assunto" },
            email_header_title: { type: "string" },
            email_content: { type: "string" },
            email_footer_content: { type: "string" },
          },
        },
        CustomerBody: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Empresa Exemplo" },
          },
        },
      },
    },
    paths: {
      "/sms": {
        post: {
          security: [{ bearerAuth: [] }],
          summary: "Enviar SMS",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SmsBody" },
                examples: {
                  default: {
                    value: {
                      country: "+55",
                      dd: "86",
                      number: "994873708",
                      message: "Opa tudo bem?"
                    }
                  }
                }
              }
            },
          },
          responses: {
            200: { description: "SMS enfileirado" },
            400: { description: "Falha de validação" },
            401: { description: "Não autorizado" },
          },
        },
      },
      "/whatsapp": {
        post: {
          security: [{ bearerAuth: [] }],
          summary: "Enviar WhatsApp (único)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WhatsappBody" },
                examples: {
                  text: {
                    value: {
                      country: "+55",
                      dd: "86",
                      number: "994873708",
                      message: "Olá tudo bem?",
                      sendAt: "2025-11-15 08:25:23"
                    }
                  },
                  imageUrl: {
                    value: {
                      country: "+55",
                      dd: "86",
                      number: "994873708",
                      message: "Olá tudo bem?",
                      sendAt: "2025-11-15 08:25:23",
                      image: "https://cdn.pixabay.com/photo/2025/10/16/08/14/parrot-9897724_1280.jpg"
                    }
                  },
                  imageBase64: {
                    value: {
                      country: "+55",
                      dd: "86",
                      number: "994873708",
                      message: "Olá tudo bem?",
                      sendAt: "2025-11-15 09:16:23",
                      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34..."
                    }
                  }
                }
              }
            },
          },
          responses: {
            200: { description: "WhatsApp enfileirado" },
            400: { description: "Falha de validação" },
            401: { description: "Não autorizado" },
          },
        },
      },
      "/whatsapp-bulk": {
        post: {
          security: [{ bearerAuth: [] }],
          summary: "Enviar WhatsApp (bulk)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WhatsappBulkBody" },
                examples: {
                  bulkUrl: {
                    value: {
                      data: [
                        {
                          country: "+55",
                          dd: "86",
                          number: "994873708",
                          message: "Olá tudo bem?",
                          sendAt: "2025-11-15 09:08:35",
                          image: "https://cdn.pixabay.com/photo/2025/10/16/08/14/parrot-9897724_1280.jpg"
                        },
                        {
                          country: "+55",
                          dd: "86",
                          number: "994873708",
                          message: "Olá tudo bem?",
                          sendAt: "2025-11-15 09:08:35",
                          image: "https://cdn.pixabay.com/photo/2025/10/16/08/14/parrot-9897724_1280.jpg"
                        }
                      ]
                    }
                  },
                  bulkBase64: {
                    value: {
                      data: [
                        {
                          country: "+55",
                          dd: "86",
                          number: "994873708",
                          message: "Olá tudo bem?",
                          sendAt: "2025-11-15 09:18:35",
                          image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34..."
                        },
                        {
                          country: "+55",
                          dd: "86",
                          number: "994873708",
                          message: "Olá tudo bem?",
                          sendAt: "2025-11-15 09:18:35",
                          image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34..."
                        }
                      ]
                    }
                  }
                }
              }
            },
          },
          responses: {
            200: { description: "WhatsApp bulk enfileirado" },
            400: { description: "Falha de validação" },
            401: { description: "Não autorizado" },
          },
        },
      },
      "/email": {
        post: {
          security: [{ bearerAuth: [] }],
          summary: "Enviar e-mail",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EmailBody" },
                examples: {
                  default: {
                    value: {
                      email_to: "user@example.com",
                      email_title: "Bem-vindo à nossa plataforma!",
                      email_header_title: "<div style=\"padding:20px; text-align:center;\"><h2>Inscrição 360</h2></div>",
                      email_content: "<div style=\"padding:20px;\"><p>Olá, este é um e-mail de teste com dados fictícios.</p></div>",
                      email_footer_content: "<div style=\"padding:10px; font-size:12px; color:#666;\">© 2025 Empresa Exemplo. Todos os direitos reservados.</div>"
                    }
                  }
                }
              }
            },
          },
          responses: {
            200: { description: "E-mail enfileirado" },
            400: { description: "Falha de validação" },
            401: { description: "Não autorizado" },
          },
        },
      },
      "/customers": {
        post: {
          security: [{ bearerAuth: [] }],
          summary: "Criar cliente (admin)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CustomerBody" } } },
          },
          responses: {
            200: { description: "Cliente criado" },
            400: { description: "Falha de validação" },
            401: { description: "Não autorizado" },
          },
        },
      },
      "/webhook-received": {
        post: {
          summary: "Webhook de recebimento (Z-API)",
          responses: { 200: { description: "OK" } },
        },
      },
    },
  },
});

server.register(swaggerUI, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
  },
});

/* ----------------------------- Bull Board ----------------------------- */
const serverAdapter = new FastifyAdapter();

createBullBoard({
  queues: [
    new BullAdapter(emailQueue),
    new BullAdapter(smsQueue),
    new BullAdapter(whatsappQueue),
    new BullAdapter(whatsappQueueBulk),
    new BullAdapter(evolutionWhatsappQueue)
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
server.register(evolutionRoutes); // routes: POST /evolution/whatsapp
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

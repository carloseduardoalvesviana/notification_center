const { checkTokenCustomer } = require("../middlewares/check-token-customer");
const { store } = require("../controllers/whatsappController");
const { storeBulk } = require("../controllers/whatsappBulkController");
const { whatsappBodySchema, whatsappBulkSchema } = require("../schemas/zod-schemas");

async function whatsappRoutes(server) {
  server.addHook("preHandler", checkTokenCustomer);

  server.post("/whatsapp", async (request, reply) => {
    const result = whatsappBodySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: "Validation failed",
        errors: result.error.issues,
      });
    }

    return store(request, reply);
  });

  server.post("/whatsapp-bulk", async (request, reply) => {
    const result = whatsappBulkSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: "Validation failed",
        errors: result.error.issues,
      });
    }

    return storeBulk(request, reply);
  });
}

module.exports = whatsappRoutes;

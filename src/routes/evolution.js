const { checkTokenCustomer } = require("../middlewares/check-token-customer");
const { sendMessage } = require("../controllers/evolutionWhatsappController");
const { evolutionBodySchema } = require("../schemas/zod-schemas");

async function evolutionRoutes(server) {
  server.addHook("preHandler", checkTokenCustomer);

  server.post("/evolution/whatsapp", async (request, reply) => {
     const result = evolutionBodySchema.safeParse(request.body);
     
     if (!result.success) {
        return reply.status(400).send({
           message: "Validation failed",
           errors: result.error.issues
        });
     }
     
     return sendMessage(request, reply);
  });
}

module.exports = evolutionRoutes;

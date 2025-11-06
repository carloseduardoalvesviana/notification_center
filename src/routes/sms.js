const { checkTokenCustomer } = require("../middlewares/check-token-customer");
const { store } = require("../controllers/smsController");

const { smsBodySchema } = require("../schemas/zod-schemas");


async function smsRoutes(server) {
  server.addHook("preHandler", checkTokenCustomer);

  server.post("/sms", async (request, reply) => {
    let result = smsBodySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: "Validation failed",
        errors: result.error.issues, // formato mais amigável do Zod
      });
    }
    return await store(request, reply);
  });
}

module.exports = smsRoutes;

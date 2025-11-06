const { sendEmail } = require("../controllers/emailController");
const { checkTokenCustomer } = require("../middlewares/check-token-customer");
const { emailSchema } = require("../schemas/zod-schemas");

async function emailRoutes(server) {
  server.addHook("preHandler", checkTokenCustomer);

  server.post("/email", async (request, reply) => {
    let result = emailSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: "Validation failed",
        errors: result.error.issues, // formato mais amigável do Zod
      });
    }

    const response = await sendEmail(request, reply);

    return response;
  });
}

module.exports = emailRoutes;

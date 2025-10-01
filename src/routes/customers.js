const { store } = require("../controllers/customerController");
const { checkTokenAdmin } = require("../middlewares/check-token-admin");
const z = require("zod");

const customerSchema = z.object({
  name: z.string().nonempty(),
});

async function customersRoutes(server) {
  server.addHook("preHandler", checkTokenAdmin);

  server.post("/customers", async (request, reply) => {
    let result = customerSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: "Validation failed",
        errors: result.error.issues, // formato mais amigável do Zod
      });
    }

    return await store(request, reply);
  });
}

module.exports = customersRoutes;

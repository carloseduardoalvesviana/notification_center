const { checkTokenCustomer } = require("../middlewares/check-token-customer");
const { store } = require("../controllers/smsController");

const z = require("zod");

const smsBodySchema = z.object({
  country: z
    .string()
    .nonempty("Country code is required")
    .regex(
      /^\+\d{1,3}$/,
      "Country code must start with '+' followed by 1 to 3 digits (e.g., +55)"
    ),
  dd: z
    .string()
    .nonempty("DD code is required")
    .regex(/^\d{2}$/, "DD code must be exactly 2 digits (e.g., 86)"),
  number: z
    .string()
    .nonempty("Phone number is required")
    .regex(/^\d{8,9}$/, "Phone number must be 8 or 9 digits (e.g., 994873708)"),
  message: z
    .string()
    .nonempty("Message is required")
    .max(160, "Message must not exceed 160 characters"), // Limite comum para SMS
});

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

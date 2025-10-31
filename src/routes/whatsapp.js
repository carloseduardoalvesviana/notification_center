const { checkTokenCustomer } = require("../middlewares/check-token-customer");
const { store } = require("../controllers/whatsappController");
const z = require("zod");

const whatsappBodySchema = z.object({
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
  message: z.string().nonempty("Message is required"),
  image: z.string().optional(), // torna o campo opcional
  sendAt: z.string().optional(), // torna o campo opcional
});

async function whatsappRoutes(server) {
  server.addHook("preHandler", checkTokenCustomer);

  server.post("/whatsapp", async (request, reply) => {
    const result = whatsappBodySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        message: "Validation failed",
        errors: result.error.issues, // formato mais amigável do Zod
      });
    }

    return store(request, reply);
  });
}

module.exports = whatsappRoutes;

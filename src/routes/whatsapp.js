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
  image: z.string().optional(),

  // ✅ validação do formato "YYYY-MM-DD HH:mm:ss"
  sendAt: z
    .string()
    .regex(
      /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/,
      "sendAt must be in the format 'YYYY-MM-DD HH:mm:ss' (e.g., 2025-01-17 10:47:23)"
    )
    .optional(),
});

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
}

module.exports = whatsappRoutes;

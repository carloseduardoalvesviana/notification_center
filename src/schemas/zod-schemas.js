const { z } = require('zod');

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

// ✅ Schema para envio em massa com limite de 500 mensagens
const whatsappBulkSchema = z.object({
    data: z
        .array(whatsappBodySchema)
        .nonempty("Data must be a non-empty array of message objects")
        .max(500, "You can send up to 500 messages at a time"),
});

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

const emailSchema = z.object({
    email_to: z.email(),
    email_title: z.string().nonempty(),
    email_header_title: z.string().nonempty(),
    email_content: z.string().nonempty(),
    email_footer_content: z.string().nonempty(),
});

const customerSchema = z.object({
    name: z.string().nonempty(),
});

const evolutionBodySchema = z.object({
    number: z.string().nonempty("Phone number is required"),
    message: z.string().nonempty("Message is required"),
});

module.exports = {
    whatsappBodySchema,
    whatsappBulkSchema,
    smsBodySchema,
    emailSchema,
    customerSchema,
    evolutionBodySchema
};

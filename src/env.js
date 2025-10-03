const z = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().default(3333), // converte string para number
  ADMIN_TOKEN: z.string().min(1), // obrigatório e não vazio
  REDIS_HOST: z.string().min(1), // obrigatório e não vazio
  REDIS_PORT: z.coerce.number(), // converte para number, obrigatório
  REDIS_PASSWORD: z.string().optional(), // pode não existir
  REDIS_USERNAME: z.string().optional(), // pode não existir
  URL_NOTIFICATION: z.string().min(1), // obrigatório
  DATABASE_URL: z.string().min(1), // obrigatório
});

let env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error("❌ Erro de configuração nas variáveis de ambiente:");
  console.error(error.errors); // mostra quais variáveis estão erradas ou ausentes
  throw new Error(
    "Configuração inválida do ambiente. A aplicação não pode iniciar."
  );
}

module.exports = { env };

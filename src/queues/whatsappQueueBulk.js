process.env.TZ = "America/Sao_Paulo";
const axios = require("axios");
const Queue = require("bull");
const prisma = require("../database");
const { env } = require("../env");

const whatsappQueueBulk = new Queue("whatsapp-queue-bulk", {
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
  },
  defaultJobOptions: {
    attempts: 3, // ✅ tenta reprocessar até 3 vezes em caso de erro
    backoff: {
      type: "exponential", // tempo aumenta a cada falha
      delay: 10000, // começa com 10s e dobra a cada erro
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// ✅ Limpar número (só dígitos)
function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

whatsappQueueBulk.process(async (job) => {
  const { id, number, customer_id, message, url, zapi_client_token } = job.data;

  try {
    const smsData = {
      phone: limparNumero(number),
      message: message,
    };

    const headers = {
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapi_client_token,
      },
      timeout: 20000, // ✅ evita travar fila se a API demorar
    };

    const response = await axios.post(url, smsData, headers);

    // ✅ Atualiza status no banco
    await prisma.whatsappNotifications.update({
      where: { id, customer_id },
      data: {
        status: {
          status: "sent",
          response: response.data,
          sentAt: new Date(),
        },
      },
    });

    job.progress(100);
    return Promise.resolve();
  } catch (error) {
    console.error("❌ Failed to send Whatsapp:", error.message);

    // ✅ Tenta salvar erro de forma mais limpa
    await prisma.whatsappNotifications.update({
      where: { id, customer_id },
      data: {
        status: {
          status: "error",
          error: error.response?.data || error.message,
          updatedAt: new Date(),
        },
      },
    });

    // ⚠️ Retorna erro para o Bull tentar novamente se configurado
    throw error;
  }
});

module.exports = whatsappQueueBulk;

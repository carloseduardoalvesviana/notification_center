process.env.TZ = "America/Sao_Paulo";
const axios = require("axios");
const Queue = require("bull");
const prisma = require("../database");
const { env } = require("../env");

// Configuração da fila
const whatsappQueue = new Queue("whatsapp-queue", {
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

// ✅ Helper: limpar número (somente dígitos)
function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

// ✅ Helper: salvar status da notificação
async function atualizarStatus(id, customer_id, data) {
  try {
    await prisma.whatsappNotifications.update({
      where: { id, customer_id },
      data: { status: data },
    });
  } catch (err) {
    console.error("⚠️ Falha ao atualizar status no banco:", err.message);
  }
}

// ✅ Função principal do processamento
whatsappQueue.process(async (job) => {
  const { id, number, customer_id, message, url, zapi_client_token } = job.data;
  const attempt = job.attemptsMade + 1;

  try {
    console.log(`🚀 Enviando mensagem [${id}] para ${number} (tentativa ${attempt})`);

    const smsData = {
      phone: limparNumero(number),
      message,
    };

    const config = {
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapi_client_token,
      },
      timeout: 20000, // ✅ timeout de 20 segundos
    };

    const response = await axios.post(url, smsData, config);

    await atualizarStatus(id, customer_id, {
      status: "sent",
      response: response.data,
      sentAt: new Date(),
    });

    console.log(`✅ Mensagem enviada com sucesso para ${number}`);

    job.progress(100);
    return Promise.resolve();
  } catch (error) {
    console.error(`❌ Falha ao enviar mensagem [${id}] (tentativa ${attempt}):`, error.message);

    const errorData = {
      status: attempt < 3 ? "retrying" : "error",
      error: error.response?.data || error.message,
      updatedAt: new Date(),
    };

    await atualizarStatus(id, customer_id, errorData);

    // ⚠️ Lança o erro para o Bull controlar o retry
    throw error;
  }
});

module.exports = whatsappQueue;

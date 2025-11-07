const axios = require("axios");
const Queue = require("bull");
const prisma = require("../database");
const { env } = require("../env");

const smsQueue = new Queue("sms-queue", {
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
  },
  defaultJobOptions: {
    attempts: 3, // ✅ tenta até 3 vezes se der erro
    backoff: {
      type: "exponential", // tempo dobra a cada falha
      delay: 10000, // começa com 10s
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// ✅ Helper para atualizar o status da notificação
async function atualizarStatus(id, data) {
  try {
    await prisma.smsNotifications.update({
      where: { id },
      data: { status: data },
    });
  } catch (err) {
    console.error("⚠️ Falha ao atualizar status SMS:", err.message);
  }
}

// ✅ Processamento principal da fila
smsQueue.process(async (job) => {
  const { id, number, customer_id, message } = job.data;
  const attempt = job.attemptsMade + 1;

  try {
    console.log(`📤 Enviando SMS [${id}] para ${number} (tentativa ${attempt})`);

    // Buscar configuração de SMS do cliente
    const smsConfig = await prisma.smsOptionsForCustomers.findFirst({
      where: { customer_id },
    });

    if (!smsConfig) {
      throw new Error(`SMS configuration not found for customer ${customer_id}`);
    }

    const smsData = {
      numberPhone: number,
      message,
      flashSms: false,
    };

    const url = `${smsConfig.nvoip_api_url}/sms?napikey=${smsConfig.nvoip_api_key}`;

    console.log(url)

    const config = {
      headers: { "Content-Type": "application/json" },
      timeout: 15000, // ✅ evita travamento da fila
    };

    const response = await axios.post(url, smsData, config);

    await atualizarStatus(id, {
      status: "sent",
      response: response.data,
      sentAt: new Date(),
    });

    console.log(`✅ SMS enviado com sucesso para ${number}`);
    job.progress(100);

    return Promise.resolve();
  } catch (error) {
    console.error(`❌ Falha ao enviar SMS [${id}] (tentativa ${attempt}):`, error.message);

    const errorData = {
      status: attempt < 3 ? "retrying" : "error",
      error: error.response?.data || error.message,
      updatedAt: new Date(),
    };

    await atualizarStatus(id, errorData);

    // Lança erro para que o Bull tente novamente se aplicável
    throw error;
  }
});

module.exports = smsQueue;

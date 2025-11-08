process.env.TZ = "America/Sao_Paulo";

const axios = require("axios");
const Queue = require("bull");
const Redis = require("ioredis");
const prisma = require("../database");
const { env } = require("../env");

// 🔹 Instância principal da fila
const whatsappQueueBulk = new Queue("whatsapp-queue-bulk", {
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// 🔹 Cliente Redis (para controle de intervalo entre envios)
const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  username: env.REDIS_USERNAME,
});

const MIN_INTERVAL_MS = 20000; // 10 segundos

// 🕒 Utilitário: aguarda um tempo
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🔹 Limpar número (somente dígitos)
function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

// 🔹 Garante espaçamento entre mensagens do mesmo cliente
async function ensureCustomerDelay(customer_id) {
  const key = `last_send:${customer_id}`;
  const now = Date.now();

  // Busca o último envio no Redis
  const lastSend = await redis.get(key);

  if (lastSend) {
    const diff = now - parseInt(lastSend, 10);

    if (diff < MIN_INTERVAL_MS) {
      const waitTime = MIN_INTERVAL_MS - diff;
      console.log(`[${customer_id}] Aguardando ${waitTime / 1000}s para evitar bloqueio...`);
      await sleep(waitTime);
    }
  }

  // Atualiza o horário do último envio
  await redis.set(key, now);
}

whatsappQueueBulk.process(async (job) => {
  const { id, number, customer_id, message, url, zapi_client_token } = job.data;

  try {
    // 🕒 Garante espaçamento mínimo entre mensagens do mesmo cliente
    await ensureCustomerDelay(customer_id);

    const smsData = {
      phone: limparNumero(number),
      message,
    };

    const headers = {
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapi_client_token,
      },
      timeout: 20000, // evita travar fila se a API demorar
    };

    // Envia via API Z-API
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

    // Salva erro no banco
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

    throw error;
  }
});

module.exports = whatsappQueueBulk;

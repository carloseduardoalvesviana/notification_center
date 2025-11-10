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

// 🕒 Utilitário: aguarda um tempo
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🔹 Limpar número (somente dígitos)
function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

// 🔹 Delay dinâmico mínimo baseado no delay médio de envio
async function ensureCustomerDelay(customer_id, dynamicDelayMs = 0) {
  const key = `last_send:${customer_id}`;
  const now = Date.now();
  const lastSend = await redis.get(key);

  // 🧮 Delay mínimo = entre 1/3 e 1/2 do delay médio usado no storeBulk
  // (garante espaçamento mesmo se storeBulk usar delays grandes)
  const adaptiveInterval = Math.max(
    7000, // nunca menos que 7 segundos
    Math.min(dynamicDelayMs / 2, 20000) // limite máximo 20s
  );

  if (lastSend) {
    const diff = now - parseInt(lastSend, 10);

    if (diff < adaptiveInterval) {
      const waitTime = adaptiveInterval - diff;
      console.log(`[${customer_id}] ⏳ Aguardando ${waitTime / 1000}s para evitar bloqueio...`);
      await sleep(waitTime);
    }
  }

  // Atualiza horário do último envio
  await redis.set(key, now);
}

// 🔹 Processador da fila principal
whatsappQueueBulk.process(async (job) => {
  const { id, number, customer_id, message, url, zapi_client_token, delayMs } = job.data;

  try {
    // Garante espaçamento mínimo dinâmico entre mensagens do mesmo cliente
    await ensureCustomerDelay(customer_id, delayMs);

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

    // 🔹 Envio via API Z-API
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
    console.error(`❌ Falha no envio (cliente ${customer_id}):`, error.message);

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

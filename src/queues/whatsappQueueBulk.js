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

// 🔹 Cliente Redis
const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  username: env.REDIS_USERNAME,
});

// 🕒 Pausa simples
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🔹 Limpa número
function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

// 🔹 Delay dinâmico entre mensagens do mesmo cliente
async function ensureCustomerDelay(customer_id, dynamicDelayMs = 0) {
  const key = `last_send:${customer_id}`;
  const now = Date.now();
  const lastSend = await redis.get(key);

  const adaptiveInterval = Math.max(
    10000,
    Math.min(Math.floor(dynamicDelayMs / 2), 30000)
  );

  if (lastSend) {
    const diff = now - parseInt(lastSend, 10);
    if (diff < adaptiveInterval) {
      const waitTime = adaptiveInterval - diff;
      console.log(`[${customer_id}] ⏳ Aguardando ${Math.ceil(waitTime / 1000)}s para evitar bloqueio...`);
      await sleep(waitTime);
    }
  }

  await redis.set(key, now, "EX", 60 * 60 * 2); // expira em 2h
}

// 🔹 Processamento da fila
whatsappQueueBulk.process(1, async (job) => { // 👈 garante 1 por vez
  const { id, number, customer_id, message, url, zapi_client_token, delayMs } = job.data;

  try {
    await ensureCustomerDelay(customer_id, delayMs);

    const phone = limparNumero(number);
    let payload;
    if (url.endsWith("/send-image")) {
      payload = { phone, image: job.data.image, caption: job.data.caption, viewOnce: false };
    } else {
      payload = { phone, message };
    }

    const headers = {
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapi_client_token,
      },
      timeout: 20000,
    };

    const payloadType = url.endsWith("/send-image")
      ? (typeof job.data.image === "string" && job.data.image.startsWith("data:") ? "image_base64" : "image_url_or_base64")
      : "text";
    console.log("🔎 Enviando para Z-API (bulk)", { url, payloadType });
    const response = await axios.post(url, payload, headers);

    await prisma.whatsappNotifications.update({
      where: { id },
      data: {
        status: {
          status: "sent",
          response: response.data,
          sentAt: new Date(),
        },
      },
    });

    console.log(`[${customer_id}] ✅ Mensagem enviada para ${number}`);
    job.progress(100);
    return Promise.resolve();
  } catch (error) {
    console.error(`❌ Falha no envio (cliente ${customer_id}):`, error.message);

    await prisma.whatsappNotifications.update({
      where: { id },
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

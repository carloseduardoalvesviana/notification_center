process.env.TZ = "America/Sao_Paulo";
const axios = require("axios");
const Queue = require("bull");
const prisma = require("../database");
const { env } = require("../env");
const Redis = require("ioredis");

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

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  username: env.REDIS_USERNAME,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCustomerDelay(customer_id) {
  const key = `last_send:${customer_id}`;
  const now = Date.now();
  const lastSend = await redis.get(key);
  const minInterval = 10000;
  if (lastSend) {
    const diff = now - parseInt(lastSend, 10);
    if (diff < minInterval) {
      await sleep(minInterval - diff);
    }
  }
  await redis.set(key, Date.now(), "EX", 60 * 60 * 2);
}

// ✅ Helper: limpar número (somente dígitos)
function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

// ✅ Helper: salvar status da notificação
async function atualizarStatus(id, data) {
  try {
    await prisma.whatsappNotifications.update({
      where: { id },
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

    await ensureCustomerDelay(customer_id);

    const phone = limparNumero(number);

    let payload;
    if (url.endsWith("/send-image")) {
      payload = { phone, image: job.data.image, caption: job.data.caption, viewOnce: false };
    } else {
      payload = { phone, message };
    }

    const config = {
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapi_client_token,
      },
      timeout: 20000,
    };

    const payloadType = url.endsWith("/send-image")
      ? (typeof job.data.image === "string" && job.data.image.startsWith("data:") ? "image_base64" : "image_url_or_base64")
      : "text";
    console.log("🔎 Enviando para Z-API", { url, payloadType });
    const response = await axios.post(url, payload, config);

    await atualizarStatus(id, {
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

    await atualizarStatus(id, errorData);

    // ⚠️ Lança o erro para o Bull controlar o retry
    throw error;
  }
});

module.exports = whatsappQueue;

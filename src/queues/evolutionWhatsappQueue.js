process.env.TZ = "America/Sao_Paulo";
const axios = require("axios");
const Queue = require("bull");
const prisma = require("../database");
const { env } = require("../env");
const Redis = require("ioredis");

// Configuração da fila
const evolutionWhatsappQueue = new Queue("evolution-whatsapp-queue", {
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10000,
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
  const key = `evolution_last_send:${customer_id}`;
  const now = Date.now();
  const lastSend = await redis.get(key);
  const minInterval = 1000; // 1 segundo entre envios para Evolution (ajustável)
  if (lastSend) {
    const diff = now - parseInt(lastSend, 10);
    if (diff < minInterval) {
      await sleep(minInterval - diff);
    }
  }
  await redis.set(key, Date.now(), "EX", 60 * 60 * 2);
}

// Helper: limpar número (somente dígitos)
function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

// Helper: salvar status da notificação
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

// Função principal do processamento
evolutionWhatsappQueue.process(async (job) => {
  const { id, number, customer_id, message, url, token } = job.data;
  const attempt = job.attemptsMade + 1;

  try {
    console.log(`🚀 [Evolution] Enviando mensagem [${id}] para ${number} (tentativa ${attempt})`);

    await ensureCustomerDelay(customer_id);

    const phone = limparNumero(number);

    // Payload para Evolution API (v2 text message)
    const payload = {
      number: phone,
      text: message,
    };

    const config = {
      headers: {
        "Content-Type": "application/json",
        "apikey": token,
      },
      timeout: 20000,
    };

    // Assumindo que a URL salva é a base da instância (ex: https://api.com/message/sendText/instance)
    // Se o usuário salvou apenas a base, precisaríamos concatenar. 
    // Vamos assumir que o controller já formatou a URL correta ou o usuário salvou a URL completa do endpoint.
    // Padrão Z-API era base + /send-text.
    // Vamos padronizar no controller para garantir.
    
    console.log("🔎 Enviando para Evolution API", { url });
    const response = await axios.post(url, payload, config);

    console.log(`✅ [Evolution] Mensagem enviada com sucesso! ID: ${id}`);
    
    await atualizarStatus(id, {
      sent: true,
      response: response.data,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`❌ [Evolution] Erro ao enviar mensagem [${id}]:`, error.message);
    if (error.response) {
      console.error("Dados do erro:", error.response.data);
    }

    await atualizarStatus(id, {
      sent: false,
      error: error.message,
      response: error.response ? error.response.data : null,
      timestamp: new Date().toISOString(),
    });

    throw error; // Faz o Bull tentar novamente
  }
});

module.exports = evolutionWhatsappQueue;

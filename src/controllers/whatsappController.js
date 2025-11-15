const prisma = require("../database");
const crypto = require("crypto");
const whatsappQueue = require("../queues/whatsappQueue");

async function store(request, reply) {
  const { country, dd, number, message, sendAt, image } = request.body;
  const customer_id = request.customer;

  const whatsappOptionConfiguration =
    await prisma.whatsappOptionsForCustomers.findFirst({
      where: { customer_id },
    });

  if (!whatsappOptionConfiguration) {
    return reply
      .status(404)
      .send({ message: "Whatsapp configuration not provided" });
  }

  // --- converte o sendAt (ex: "2025-01-17 10:47:23") em Date UTC (Brasil = -03) ---
  let sentAt = null;
  if (sendAt) {
    const [datePart, timePart] = sendAt.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);

    // Converte horário local (-03) para UTC somando 3h
    sentAt = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, second));

    if (isNaN(sentAt.getTime())) {
      return reply.status(400).send({ message: "Invalid sendAt format" });
    }

    
    const now = Date.now();
    if (sentAt.getTime() < now) {
      const randomDelayMs = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
      sentAt = new Date(now + randomDelayMs);
    }
  }

  const whatsappData = {
    id: crypto.randomUUID(),
    customer_id,
    zapi_client_instance: whatsappOptionConfiguration.zapi_client_instance,
    number: `${country}${dd}${number}`,
    status: {},
    received: {},
    message,
  };

  const newWhatsappNotification = await prisma.whatsappNotifications.create({
    data: whatsappData,
  });

  let dataWhatsapp = {
    ...whatsappData,
    zapi_client_token: whatsappOptionConfiguration.zapi_client_token,
  };

  if (image) {
    let imageContent = null;
    let isUrl = false;
    try {
      const u = new URL(image);
      isUrl = u.protocol === "http:" || u.protocol === "https:";
    } catch {}
    if (isUrl) {
      imageContent = image;
    } else {
      let base64ForValidation = image;
      const i = base64ForValidation.indexOf(";base64,");
      if (base64ForValidation.startsWith("data:") && i !== -1) base64ForValidation = base64ForValidation.substring(i + 8);
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      const validChars = base64Regex.test(base64ForValidation);
      let decoded;
      try { decoded = Buffer.from(base64ForValidation, "base64"); } catch {}
      const valid = validChars && decoded && decoded.length > 0;
      if (!valid) {
        return reply.status(400).send({ message: "Invalid image (malformed Base64 or URL)" });
      }
      imageContent = image; // mantém o formato original (data URI ou base64 puro)
    }
    const caption = typeof message === "string" ? message : "";
    dataWhatsapp = {
      ...dataWhatsapp,
      url: `${whatsappOptionConfiguration.zapi_client_url}/send-image`,
      image: imageContent,
      caption,
    };
  } else {
    dataWhatsapp = {
      ...dataWhatsapp,
      url: `${whatsappOptionConfiguration.zapi_client_url}/send-text`,
    };
  }

  // --- calcula o delay em milissegundos ---
  let delay = 0;
  if (sentAt) {
    const now = Date.now();
    delay = Math.max(sentAt.getTime() - now, 0);
  } else {
    delay = Math.floor(Math.random() * 1000) + 500;
  }

  // --- adiciona o job à fila com delay (Bull v3 aceita delay em ms) ---
  const { zapi_client_token: _omit, ...payloadToLog } = dataWhatsapp;
  console.log("📥 Adicionando job na fila whatsapp-queue", { ...payloadToLog, delay });
  await whatsappQueue.add(dataWhatsapp, { delay });

  return reply.send(newWhatsappNotification);
}

module.exports = { store };

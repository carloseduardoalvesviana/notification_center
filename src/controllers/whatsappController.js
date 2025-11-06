const prisma = require("../database");
const crypto = require("crypto");
const whatsappQueue = require("../queues/whatsappQueue");

async function store(request, reply) {
  const { country, dd, number, message, sendAt } = request.body;
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
  }

  const whatsappData = {
    id: crypto.randomUUID(),
    customer_id,
    zapi_client_instance: whatsappOptionConfiguration.zapi_client_instance,
    number: `${country}${dd}${number.slice(1)}`,
    status: {},
    received: {},
    message,
  };

  const newWhatsappNotification = await prisma.whatsappNotifications.create({
    data: whatsappData,
  });

  // --- prepara os dados do envio ---
  const dataWhatsapp = {
    ...whatsappData,
    url: `${whatsappOptionConfiguration.zapi_client_url}/send-text`,
    zapi_client_token: whatsappOptionConfiguration.zapi_client_token,
  };

  // --- calcula o delay em milissegundos ---
  let delay = 0;
  if (sentAt) {
    const now = Date.now();
    delay = Math.max(sentAt.getTime() - now, 0);
  } else {
    delay = Math.floor(Math.random() * 4000) + 1000; // 1 a 5 segundos
  }

  // --- adiciona o job à fila com delay (Bull v3 aceita delay em ms) ---
  await whatsappQueue.add(dataWhatsapp, { delay });

  return reply.send(newWhatsappNotification);
}

module.exports = { store };
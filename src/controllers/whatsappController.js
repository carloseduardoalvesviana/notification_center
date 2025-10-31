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
  const delay = sendAt
    ? Math.max(new Date(sendAt).getTime() - Date.now(), 0)
    : 0;

  // --- adiciona o job à fila com delay ---
  await whatsappQueue.add(dataWhatsapp, { delay });

  return reply.send(newWhatsappNotification);
}

module.exports = { store };

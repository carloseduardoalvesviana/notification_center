const prisma = require("../database");
const crypto = require("crypto");
const whatsappQueue = require("../queues/whatsappQueue");

async function store(request, reply) {
  const { country, dd, number, message } = request.body;
  const customer_id = request.customer;

  const whatsappOptionConfiguration =
    await prisma.whatsappOptionsForCustomers.findFirst({
      where: {
        customer_id,
      },
    });

  if (!whatsappOptionConfiguration) {
    return reply
      .status(404)
      .end({ message: "Whatsapp configuration not provider" });
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

  whatsappData.url = `${whatsappOptionConfiguration?.zapi_client_url}/send-text`;
  whatsappData.zapi_client_token =
    whatsappOptionConfiguration?.zapi_client_token;

  await whatsappQueue.add(whatsappData);

  return reply.send(newWhatsappNotification);
}

module.exports = {
  store,
};

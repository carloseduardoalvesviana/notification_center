const prisma = require("../database");
const crypto = require("crypto");
const evolutionWhatsappQueue = require("../queues/evolutionWhatsappQueue");

async function sendMessage(request, reply) {
  const { number, message } = request.body;
  const customer_id = request.customer; // Obtido do middleware checkTokenCustomer

  // Buscar configurações da Evolution API para o cliente
  const evolutionConfig =
    await prisma.whatsappEvolutionOptionsForCustomer.findFirst({
      where: { customer_id },
    });

  if (!evolutionConfig) {
    return reply
      .status(404)
      .send({ message: "Evolution API configuration not found for this customer" });
  }

  const { url, token } = evolutionConfig;

  if (!url || !token) {
    return reply
      .status(400)
      .send({ message: "Evolution API URL or Token missing in configuration" });
  }

  // Criação do ID único para a notificação
  const notificationId = crypto.randomUUID();

  // Dados para salvar no histórico (tabela whatsapp_notifications)
  // Usamos 'evolution' como identificador de instância já que a tabela exige zapi_client_instance
  const whatsappData = {
    id: notificationId,
    customer_id,
    zapi_client_instance: "evolution", 
    number: number,
    status: {},
    received: {},
    message,
  };

  try {
    // Salvar registro inicial no banco
    await prisma.whatsappNotifications.create({
      data: whatsappData,
    });

    // Enfileirar o job
    await evolutionWhatsappQueue.add({
      id: notificationId,
      customer_id,
      number,
      message,
      url, // A URL deve ser o endpoint completo (ex: https://api.com/message/sendText/instance)
      token,
    });

    return reply.status(200).send({
      message: "Message queued for sending via Evolution API",
      id: notificationId,
    });

  } catch (error) {
    console.error("Error queueing Evolution message:", error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

module.exports = {
  sendMessage,
};

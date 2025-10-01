require("dotenv").config();
const axios = require("axios");
const Queue = require("bull");
const prisma = require("../database");

const whatsappQueue = new Queue("whatsapp-queue", {
  redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME,
  },
});

function limparNumero(telefone) {
  return telefone.replace(/[^0-9]/g, "");
}

whatsappQueue.process(async (job, done) => {
  const { id, number, customer_id, message, url, zapi_client_token } = job.data;

  try {
    const smsData = {
      phone: limparNumero(number),
      message: message,
    };

    const headers = {
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapi_client_token,
      },
    };

    const response = await axios.post(url, smsData, headers);

    await prisma.whatsappNotifications.update({
      where: {
        id,
        customer_id,
      },
      data: {
        status: response.data,
      },
    });

    return done();
  } catch (error) {
    console.error("Failed to send Whatsapp:", error.message);

    await prisma.whatsappNotifications.update({
      where: {
        id,
        customer_id,
      },
      data: {
        status: { message: error },
      },
    });

    return done(error);
  }
});

module.exports = whatsappQueue;

require("dotenv").config();
const axios = require("axios");
const Queue = require("bull");
const prisma = require("../database");

const smsQueue = new Queue("sms-queue", {
  redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME,
  },
});

smsQueue.process(async (job, done) => {
  try {
    const { id, number, customer_id, message } = job.data;

    const smsData = {
      numberPhone: number,
      message,
      flashSms: false,
    };

    const smsConfig = await prisma.smsOptionsForCustomers.findFirst({
      where: { customer_id },
    });

    if (!smsConfig) {
      return done(new Error(`SMS not configured for customer: ${customer_id}`));
    }

    const url = `${smsConfig.nvoip_api_url}/sms?napikey=${smsConfig.nvoip_api_key}`;

    const response = await axios.post(url, smsData, {
      headers: { "Content-Type": "application/json" },
    });

    await prisma.smsNotifications.update({
      where: { id },
      data: {
        status: response.data,
      },
    });

    return done();
  } catch (error) {
    console.error("Failed to send SMS:", error.message);

    // Atualiza status como erro
    await prisma.smsNotifications.update({
      where: { id },
      data: {
        status: { message: error.message },
      },
    });

    return done(error);
  }
});

module.exports = smsQueue;

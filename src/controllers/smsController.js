const crypto = require("crypto");
const smsQueue = require("../queues/smsQueue");
const prisma = require("../database");

async function store(request, reply) {
  const { country, dd, number, message } = request.body;
  const customer_id = request.customer;

  const smsData = {
    id: crypto.randomUUID(),
    customer_id,
    number: `${country}${dd}${number}`,
    message,
    status: {},
  };

  const newCustomer = await prisma.smsNotifications.create({
    data: smsData,
  });

  smsQueue.add(smsData);

  return reply.send(newCustomer);
}

module.exports = {
  store,
};

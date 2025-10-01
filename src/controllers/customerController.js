const crypto = require("crypto");

const prisma = require("../database");

async function store(request, reply) {
  const { name } = request.body;

  const customerExists = await prisma.customer.findFirst({
    where: {
      name,
    },
  });

  if (customerExists) {
    return reply.send({ message: "Customer exists" });
  }

  const newCustomer = await prisma.customer.create({
    data: {
      name,
      token: crypto.randomUUID(),
    },
  });

  return reply.send(newCustomer);
}

module.exports = {
  store,
};

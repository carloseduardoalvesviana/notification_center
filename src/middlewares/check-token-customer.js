const prisma = require("../database");

async function checkTokenCustomer(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or malformed Authorization header");
    }

    const token = authHeader.split(" ")[1];

    const result = await prisma.customer.findFirst({
      where: {
        token,
      },
    });

    if (!result) {
      return reply.status(404).send({
        error: "Token not found",
      });
    }

    if (result.status === "blocked") {
      return reply.status(404).send({
        error: "Customer blocked",
      });
    }

    request.customer = result?.id;
  } catch (err) {
    console.log(err);
    reply.status(401).send({ error: "Unauthorized: Invalid or missing token" });
  }
}

module.exports = { checkTokenCustomer };

const { env } = require("../env");

async function checkTokenAdmin(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or malformed Authorization header");
    }

    const token = authHeader.split(" ")[1];

    const tokenAdmin = env.ADMIN_TOKEN || null;

    if (token != tokenAdmin) {
      return reply.status(404).send({
        error: "Customer blocked",
      });
    }
  } catch (err) {
    console.log(err);
    reply.status(401).send({ error: "Unauthorized: Invalid or missing token" });
  }
}

module.exports = { checkTokenAdmin };

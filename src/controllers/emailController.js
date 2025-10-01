const crypto = require("crypto");
const emailQueue = require("../queues/emailQueue");
const prisma = require("../database");

async function sendEmail(request, reply) {
  let customer_id = request?.customer;

  const {
    email_to,
    email_title,
    email_header_title,
    email_content,
    email_footer_content,
  } = request.body;

  try {
    const emailId = crypto.randomUUID();
    let emailData = {
      id: emailId,
      customer_id,
      email_to,
      email_title,
      email_header_title,
      email_content,
      email_footer_content,
      status: {},
    };

    await prisma.emailNotifications.create({
      data: emailData,
    });

    await emailQueue.add(emailData);

    const message = "EMAIL queued for sending";

    return reply.send({ message });
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
}

module.exports = {
  sendEmail,
};

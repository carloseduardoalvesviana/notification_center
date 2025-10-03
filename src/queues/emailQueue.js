const Queue = require("bull");
const nodemailer = require("nodemailer");
const path = require("path");
const juice = require("juice");
const { readFile } = require("fs/promises");
const prisma = require("../database");
const { env } = require("../env");

const emailQueue = new Queue("email-queue", {
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
  },
});

emailQueue.process(async (job, done) => {
  const {
    email_to,
    email_title,
    email_content,
    email_header_title,
    email_footer_content,
    customer_id,
    id,
  } = job.data;

  try {
    // Busca configuração SMTP do cliente
    const smtpConfig = await prisma.smtpOptionsForCustomers.findFirst({
      where: { customer_id },
    });

    if (!smtpConfig) {
      throw new Error(`SMTP não configurado para o cliente: ${customer_id}`);
    }

    // Cria transportador
    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: Number(smtpConfig.smtp_port),
      secure: Number(smtpConfig.smtp_port) === 465, // SSL se porta 465
      auth: {
        user: smtpConfig.smtp_user,
        pass: smtpConfig.smtp_pass,
      },
      tls: { rejectUnauthorized: false },
    });

    // Verifica conexão SMTP
    await transporter.verify();

    // Lê e processa template
    const templatePath = path.join(__dirname, "../../templates", "email.html");
    const template = await readFile(templatePath, "utf8");

    const htmlContent = template
      .replace("{{email_header_title}}", email_header_title || "")
      .replace("{{email_content}}", email_content || "")
      .replace("{{email_footer_content}}", email_footer_content || "");

    const inlinedHtml = juice(htmlContent);

    // Configuração do e-mail
    const mailOptions = {
      from: `"${smtpConfig.mail_from_name}" <${smtpConfig.mail_from_address}>`,
      to: email_to,
      subject: email_title,
      html: inlinedHtml,
    };

    // Envia e-mail
    await transporter.sendMail(mailOptions);

    // Atualiza status como enviado
    await prisma.emailNotifications.update({
      where: { id },
      data: { status: { message: "sent" } },
    });

    return done();
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error.message);

    await prisma.emailNotifications.update({
      where: { id },
      data: {
        status: {
          message: error.message,
        },
      },
    });

    return done(error);
  }
});

module.exports = emailQueue;

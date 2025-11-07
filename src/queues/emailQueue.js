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
  defaultJobOptions: {
    attempts: 3, // ✅ tenta reprocessar até 3 vezes em caso de erro
    backoff: {
      type: "exponential", // tempo aumenta a cada falha
      delay: 10000, // começa com 10s e dobra a cada erro
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// ✅ Cache simples de template (para performance)
let cachedTemplate = null;

async function getEmailTemplate() {
  if (!cachedTemplate) {
    const templatePath = path.join(__dirname, "../../templates", "email.html");
    cachedTemplate = await readFile(templatePath, "utf8");
  }
  return cachedTemplate;
}

// ✅ Atualiza status no banco
async function atualizarStatus(id, data) {
  try {
    await prisma.emailNotifications.update({
      where: { id },
      data: { status: data },
    });
  } catch (err) {
    console.error("⚠️ Falha ao atualizar status de e-mail:", err.message);
  }
}

// ✅ Processamento principal da fila
emailQueue.process(async (job) => {
  const {
    email_to,
    email_title,
    email_content,
    email_header_title,
    email_footer_content,
    customer_id,
    id,
  } = job.data;

  const attempt = job.attemptsMade + 1;
  console.log(`📧 Enviando e-mail [${id}] para ${email_to} (tentativa ${attempt})`);

  try {
    const smtpConfig = await prisma.smtpOptionsForCustomers.findFirst({
      where: { customer_id },
    });

    if (!smtpConfig) {
      throw new Error(`SMTP não configurado para o cliente ${customer_id}`);
    }

    // Cria transportador SMTP
    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: Number(smtpConfig.smtp_port),
      secure: Number(smtpConfig.smtp_port) === 465,
      auth: {
        user: smtpConfig.smtp_user,
        pass: smtpConfig.smtp_pass,
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 20000, // ✅ timeout de 20 segundos
    });

    // Verifica conexão SMTP antes do envio
    await transporter.verify();

    // Prepara HTML
    const template = await getEmailTemplate();
    const htmlRaw = template
      .replace("{{email_header_title}}", email_header_title || "")
      .replace("{{email_content}}", email_content || "")
      .replace("{{email_footer_content}}", email_footer_content || "");

    const htmlFinal = juice(htmlRaw); // ✅ aplica CSS inline

    // Monta email
    const mailOptions = {
      from: `"${smtpConfig.mail_from_name}" <${smtpConfig.mail_from_address}>`,
      to: email_to,
      subject: email_title,
      html: htmlFinal,
    };

    // Envia e-mail
    await transporter.sendMail(mailOptions);

    await atualizarStatus(id, {
      status: "sent",
      sentAt: new Date(),
      response: { success: true },
    });

    console.log(`✅ E-mail enviado com sucesso para ${email_to}`);
    job.progress(100);
    return Promise.resolve();
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail [${id}] (tentativa ${attempt}):`, error.message);

    const errorData = {
      status: attempt < 3 ? "retrying" : "error",
      error: error.response || error.message,
      updatedAt: new Date(),
    };

    await atualizarStatus(id, errorData);

    // Relança o erro para o Bull tentar novamente (se aplicável)
    throw error;
  }
});

module.exports = emailQueue;

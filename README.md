# 📬 Central de Notificações - API (SMS, WhatsApp e E-mail)

API para envio centralizado de **notificações** (e-mail, SMS e WhatsApp) com suporte a **multi-clientes**.
Cada cliente possui suas próprias configurações de envio (SMTP, Z-API, NVoIP) e só pode acessar os seus próprios recursos através de **tokens de autenticação**.

---

## 🚀 Tecnologias

* [Node.js](https://nodejs.org/)
* [Fastify](https://fastify.dev/)
* [Prisma ORM](https://www.prisma.io/)
* [MySQL](https://www.mysql.com/)
* [Bull](https://github.com/OptimalBits/bull) (filas com Redis)
* [Redis](https://redis.io/)
* [Zod](https://zod.dev/) (validação)
* [Nodemailer](https://nodemailer.com/) (e-mail)

---

## ⚙️ Configuração do Projeto

### 1. Clonar repositório

```bash
git clone https://github.com/sua-org/central-notificacoes.git
cd central-notificacoes
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente (`.env`)

```env
DATABASE_URL="mysql://user:password@localhost:3306/notifications"

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=

# Admin token para cadastro de clientes
ADMIN_TOKEN=seu_token_admin
```

### 4. Rodar migrations e criar cliente prisma

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Rodar servidor

```bash
npm run dev
```

---

## 🛠️ Configuração de Clientes

Para que os clientes possam enviar notificações, é necessário configurar as opções específicas para cada tipo de notificação (SMS, E-mail e WhatsApp). Essas configurações são armazenadas nas tabelas `sms_options_for_customers`, `smtp_options_for_customers` e `whatsapp_options_for_customers`. Abaixo estão exemplos de inserções com dados fictícios para configurar as opções de um cliente:

### Configuração de SMS (NVoIP)

```sql
INSERT INTO `sms_options_for_customers` (`id`, `customer_id`, `nvoip_api_key`, `nvoip_api_url`, `createdAt`, `updatedAt`)
VALUES
    ('11111111-2222-3333-4444-555555555555', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'QWxhZGRpbjpPcGVuU2VzYW1l', 'https://api-fake.nvoip.com/v2', '2025-01-01 00:00:00.000', '2025-01-01 00:00:00.000');
```

---

### Configuração de E-mail (SMTP)

```sql
INSERT INTO `smtp_options_for_customers` (`id`, `customer_id`, `mail_from_address`, `mail_from_name`, `smtp_host`, `smtp_pass`, `smtp_port`, `smtp_user`, `createdAt`, `updatedAt`)
VALUES
    ('22222222-3333-4444-5555-666666666666', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'noreply@fake-mail.com', 'Fake Notification', 'smtp.fakehost.com', 'FakePass123!', '587', 'fake_user@fake-tenant.com', '2025-01-01 00:00:00.000', '2025-01-01 00:00:00.000');
```

---

### Configuração de WhatsApp (Z-API)

```sql
INSERT INTO `whatsapp_options_for_customers` (`id`, `customer_id`, `zapi_client_token`, `zapi_client_instance`, `zapi_client_url`, `createdAt`, `updatedAt`)
VALUES
    ('33333333-4444-5555-6666-777777777777', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'FAKE_TOKEN_1234567890', 'FAKEINSTANCE123456', 'https://api.z-api.io/instances/FAKEINSTANCE123456/token/FAKE_TOKEN_123456', '2025-01-01 00:00:00.000', '2025-01-01 00:00:00.000');
```

**Nota**: Substitua os valores fictícios acima pelos valores reais fornecidos pelo cliente ou pelos serviços correspondentes (NVoIP, SMTP, Z-API).

---

## 📦 Estrutura da API

* **Autenticação**

  * Clientes se autenticam via **token único** (`Authorization: Bearer <token>`)
  * Admin possui token especial para cadastrar novos clientes

* **Filas**

  * E-mails, SMS e WhatsApp são enviados via **Bull** usando Redis
  * Garantia de processamento assíncrono e reprocessamento em caso de erro

* **Banco de Dados**

  * Tabelas separadas para logs de notificações e configurações por cliente

---

## 🔑 Autenticação

* **Admin**: usado para criar clientes (`/customers`)
* **Cliente**: cada cliente tem um **token único** para acessar rotas de envio

Header esperado:

```http
Authorization: Bearer <TOKEN>
```

---

## 📌 Rotas

### 👤 Clientes (admin only)

`POST /customers`

Cria novo cliente no sistema.

```json
{
  "name": "Cliente XPTO"
}
```

---

### 📧 Envio de E-mail

`POST /email`

```json
{
  "email_to": "user@email.com",
  "email_title": "<p>Bem-vindo!</p>",
  "email_header_title": "<p>Seja bem-vindo</p>",
  "email_content": "<h3>Obrigado por se cadastrar!</h3>",
  "email_footer_content": "<p>Equipe XPTO</p>"
}
```

---

### 📱 Envio de SMS

`POST /sms`

```json
{
  "country": "+55",
  "dd": "86",
  "number": "994876677",
  "message": "Seu código é 123456"
}
```

---

### 💬 Envio de WhatsApp

`POST /whatsapp`

```json
{
  "country": "+55",
  "dd": "86",
  "number": "994876677",
  "message": "Olá! Esse é um teste de WhatsApp"
}
```

---

## 📊 Filas de Processamento

* **email-queue** → envia e-mails usando configuração SMTP do cliente
* **sms-queue** → envia SMS via **NVoIP**
* **whatsapp-queue** → envia mensagens via **Z-API**

Todos os jobs têm **logs salvos no banco** em suas respectivas tabelas (`email_notifications`, `sms_notifications`, `whatsapp_notifications`).

---

## 📂 Estrutura do Projeto

```
prisma/                  # Migrations
src/
 ├── controllers/        # Lógica das rotas
 ├── routes/             # Definições de rotas (Fastify)
 ├── queues/             # Workers Bull (e-mail, SMS, WhatsApp)
 ├── middlewares/        # Autenticação (admin e cliente)
 ├── database.js         # Conexão Prisma
 ├── server.js           # Entry point
templates/               # Template de e-mails
```

---

## 🗄️ Modelos (Prisma)

* **Customer** → Clientes (com `token`)
* **EmailNotifications**, **SmsNotifications**, **WhatsappNotifications** → histórico de notificações
* **SmtpOptionsForCustomers**, **SmsOptionsForCustomers**, **WhatsappOptionsForCustomers** → configs por cliente

---
# 📬 Central de Notificações

API para envio centralizado de notificações (E-mail, SMS e WhatsApp) com suporte a multi-clientes.
Cada cliente possui configurações próprias (SMTP, NVoIP, Z-API) e autentica por token.

---

## Tecnologias

- Node.js
- Fastify
- Prisma
- MySQL
- Redis + Bull (filas)
- Zod (validação)
- Nodemailer (e-mail)

---

## Sumário rápido

- Endpoints protegidos por token (header `Authorization: Bearer <TOKEN>`).
- Admin usa `ADMIN_TOKEN` para rotas de administração (ex.: criação de clientes).
- Requisições são validadas com Zod (schemas em `src/schemas/zod-schemas.js`).
- Envio é feito de forma assíncrona via filas (Bull + Redis).

---

## Instalação e execução

1. Clone o repositório

```bash
git clone <repo-url>
cd central-de-notificacoes
```

2. Instale dependências

```bash
npm install
```

3. Variáveis de ambiente

Crie um arquivo `.env` com as variáveis necessárias. O projeto valida as variáveis com Zod (veja `src/env.js`). Variáveis principais:

```
PORT=3333                # opcional, padrão 3333
ADMIN_TOKEN=seu_token_admin
DATABASE_URL=...
REDIS_HOST=...
REDIS_PORT=...
REDIS_USERNAME=...      # opcional
REDIS_PASSWORD=...      # opcional
URL_NOTIFICATION=...    # URL para reencaminhar webhooks (usado em z-api-web-hook)
```

4. Prisma (migrations / generate)

```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. Rodar em desenvolvimento

```bash
npm run dev
```

---

## Autenticação

- Admin: usa o `ADMIN_TOKEN` via header `Authorization: Bearer <ADMIN_TOKEN>` para rotas administrativas como `POST /customers`.
- Cliente: cada cliente cadastrado tem um token (campo `token` na tabela `Customer`) usado no header `Authorization: Bearer <CUSTOMER_TOKEN>`.

Erro de autenticação retorna 401.

---

## Rotas (principais)

Observação: todas as rotas abaixo esperam o header `Authorization: Bearer <TOKEN>` (exceto quando explicitado diferente).

1) Criar cliente (admin)

POST /customers

Payload:

```json
{ "name": "Nome do Cliente" }
```

Validação: `name` obrigatório.

2) Enviar e-mail

POST /email

Payload (exemplo):

```json
{
  "email_to": "user@example.com",
  "email_title": "Assunto",
  "email_header_title": "Cabeçalho",
  "email_content": "<p>Conteúdo HTML</p>",
  "email_footer_content": "<p>Rodapé</p>"
}
```

Validação: `email_to` (formato de e-mail), demais campos strings não vazias.

3) Enviar SMS

POST /sms

Payload (exemplo):

```json
{
  "country": "+55",
  "dd": "86",
  "number": "994876677",
  "message": "Seu código é 123456"
}
```

Validação: `country` no formato `+NN`, `dd` com 2 dígitos, `number` 8 ou 9 dígitos, `message` com limite de 160 chars.

4) Enviar WhatsApp (único)

POST /whatsapp

Payload (exemplo):

```json
{
  "country": "+55",
  "dd": "86",
  "number": "994876677",
  "message": "Olá!"
}
```

Validação: mesma validação de phone do SMS. Campo `sendAt` (opcional) aceita formato `YYYY-MM-DD HH:mm:ss`.

5) Enviar WhatsApp (bulk)

POST /whatsapp-bulk

Payload: `{ "data": [ /* array de objetos como /whatsapp */ ] }`

Limite: máximo 500 mensagens por requisição (validado pelo schema `whatsappBulkSchema`).

6) Webhook Z-API (recebimento)

POST /webhook-received

Endpoint interno usado por integrações Z-API para atualizar o status de mensagens recebidas e reencaminhar informações para `URL_NOTIFICATION` (configurada em `.env`).

Este endpoint não exige token de cliente no código atual — ele é utilizado por serviços externos (Z-API).

---

## Validações (Zod)

As validações estão em `src/schemas/zod-schemas.js` e definem formatos e restrições:

- `smsBodySchema` — valida `country`, `dd`, `number`, `message` (máx 160 chars).
- `whatsappBodySchema` — valida campos de telefone, `message` e `sendAt` (formato `YYYY-MM-DD HH:mm:ss`).
- `whatsappBulkSchema` — array de `whatsappBodySchema`, máximo 500 itens.
- `emailSchema` — valida campos de e-mail.
- `customerSchema` — valida criação de clientes.

Erros de validação retornam 400 com detalhes de `errors` (issues do Zod).

---

## Filas e processamento

- `email-queue`: processa envios de e-mail usando a configuração SMTP do cliente.
- `sms-queue`: envia SMS via NVoIP.
- `whatsapp-queue`: envia mensagens via Z-API.
 - `whatsapp-queue-bulk` (arquivo: `src/queues/whatsappQueueBulk.js`): processa envios em massa (bulk) via Z-API — recebe o payload `{ data: [...] }` e valida o limite de até 500 mensagens por requisição (conforme `whatsappBulkSchema`).

Jobs são processados assincronamente e os resultados ficam persistidos nas tabelas de notificações.

---

## Estrutura do projeto

```
prisma/                  # Migrations
src/
 ├─ controllers/         # Lógica de negócio
 ├─ routes/              # Definição das rotas (Fastify)
 ├─ queues/              # Workers (Bull)
 ├─ middlewares/         # Autenticação (admin/cliente)
 ├─ schemas/             # Zod schemas
 ├─ database.js          # Prisma client
 ├─ env.js               # Validação das vars de ambiente
 └─ server.js            # Entry point
templates/               # Templates de e-mail
```

---

## Testes rápidos com cURL

Observação: o server usa a variável `PORT` (padrão no `env.js` é 3333). Os exemplos abaixo usam `http://localhost:3000` pois seguem o formato que você enviou — ajuste a porta conforme seu `.env`.

### Send SMS
POST http://localhost:3000/sms
Content-Type: application/json
Authorization: Bearer 4b0bc9fb-6c16-49cf-ad0e-bf98a201bc48

```json
{
  "country": "+55",
  "dd": "86",
  "number": "999999999",
  "message": "Teste SMS nova central de notificações"
}
```

### Send Whatsapp
POST http://localhost:3000/whatsapp
Content-Type: application/json
Authorization: Bearer 4b0bc9fb-6c16-49cf-ad0e-bf98a201bc48

```json
{
  "country": "+55",
  "dd": "86",
  "number": "999999999",
  "message": "🌟 Oi, Fulano! Que alegria ter você conosco. 🙏💙 Dr. Vinícius quer compartilhar sua jornada. 1- Sim, autorizo  2- Não",
  "sendAt": "2025-11-07 10:25:23"
}
```

### Send Email
POST http://localhost:3000/email
Content-Type: application/json
Authorization: Bearer 4b0bc9fb-6c16-49cf-ad0e-bf98a201bc48

```json
{
  "email_to": "usuario@gmai.com",
  "email_title": "Bem-vindo à nossa plataforma!",
  "email_header_title": "<div style=\"background: linear-gradient(to right, #1a73e8, #4f46e5); padding: 30px 20px; text-align: center; font-family: Arial, Helvetica, sans-serif; border-bottom: 3px solid #facc15;\"><h2 style=\"font-size: 28px; color: #ffffff; margin: 0; line-height: 1.2; font-weight: bold; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);\">Inscrição 360</h2></div>",
  "email_content": "<div style=\"padding: 30px 20px; text-align: center; font-family: Arial, Helvetica, sans-serif; background-color: #f9fafb; border-radius: 6px; margin: 10px;\"><h3 style=\"font-size: 22px; color: #1f2937; margin: 0 0 15px 0; line-height: 1.3; font-weight: 600;\">Bem-vindo, <a href=\"mailto:usuario@gmaill.com\" style=\"color: #1a73e8; text-decoration: none; font-weight: 500;\">usuario@gmaill.com!</a></h3><p style=\"font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;\">Estamos entusiasmados por tê-lo conosco! Acesse nossa plataforma para explorar ferramentas e recursos que vão impulsionar seu crescimento e aprendizado.</p><a href=\"https://inscricao360.com.br\" style=\"display: inline-block; padding: 14px 30px; background: linear-gradient(to bottom, #1a73e8, #2563eb); color: #ffffff; text-decoration: none; font-size: 16px; border-radius: 6px; font-weight: bold; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); transition: background 0.3s ease;\">Acessar Plataforma</a></div>",
  "email_footer_content": "<div style=\"text-align: center; font-size: 13px; color: #6b7280; line-height: 1.5; font-family: Arial, Helvetica, sans-serif; padding: 20px; background-color: #f3f4f6;\"><p style=\"margin: 0;\">© 2025 <a href=\"https://inscricao360.com.br\" style=\"color: #1a73e8; text-decoration: none;\">inscricao360.com.br</a>. Todos os direitos reservados.</p><p style=\"margin: 5px 0 0 0;\">Se você não se cadastrou, por favor, ignore este e-mail.</p></div>"
}
```

### Send Whatsapp Bulk
POST http://localhost:3000/whatsapp-bulk
Content-Type: application/json
Authorization: Bearer 4b0bc9fb-6c16-49cf-ad0e-bf98a201bc48

```json
{
  "data": [
    {
      "country": "+55",
      "dd": "86",
      "number": "999999999",
      "message": "🌟 Oi, Fulano! ",
      "sendAt": "2025-11-07 10:40:23"
    },
    {
      "country": "+55",
      "dd": "86",
      "number": "999999999",
      "message": "🌟 Oi, Fulano! ",
      "sendAt": "2025-11-07 10:40:23"
    }
    /* ... até 500 objetos */
  ]
}
```

---
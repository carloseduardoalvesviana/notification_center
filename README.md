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

Adicionalmente, a aplicação expõe um dashboard web para gerenciamento das filas (Bull UI) disponível em `/ui`. Pelo dashboard é possível visualizar jobs (waiting, active, failed, completed), reprocessar, remover e acompanhar progresso dos jobs em tempo real.

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
Authorization: Bearer <CUSTOMER_TOKEN>

```json
{
  "country": "+55",
  "dd": "99",
  "number": "999000111",
  "message": "Teste SMS (dados fictícios)"
}
```

### Send Whatsapp
POST http://localhost:3000/whatsapp
Content-Type: application/json
Authorization: Bearer <CUSTOMER_TOKEN>

```json
{
  "country": "+55",
  "dd": "99",
  "number": "999000111",
  "message": "Olá! Mensagem de teste (dados fictícios)",
  "sendAt": "2025-11-07 10:25:23"
}
```

### Send Email
POST http://localhost:3000/email
Content-Type: application/json
Authorization: Bearer <CUSTOMER_TOKEN>

```json
{
  "email_to": "user@example.com",
  "email_title": "Boas-vindas (exemplo)",
  "email_header_title": "<div style=\"padding:20px; text-align:center; background:#eee;\"><h2>Empresa Exemplo</h2></div>",
  "email_content": "<div style=\"padding:20px;\"><p>Olá, este é um e-mail de teste com dados fictícios.</p></div>",
  "email_footer_content": "<div style=\"padding:10px; font-size:12px; color:#666;\">© 2025 Empresa Exemplo. Todos os direitos reservados.</div>"
}
```

### Send Whatsapp Bulk
POST http://localhost:3000/whatsapp-bulk
Content-Type: application/json
Authorization: Bearer <CUSTOMER_TOKEN>

```json
{
  "data": [
    {
      "country": "+55",
      "dd": "99",
      "number": "999000111",
      "message": "Mensagem em lote (exemplo)",
      "sendAt": "2025-11-07 10:40:23"
    },
    {
      "country": "+55",
      "dd": "99",
      "number": "999000112",
      "message": "Mensagem em lote (exemplo)",
      "sendAt": "2025-11-07 10:40:25"
    }
    /* ... até 500 objetos */
  ]
}
```

---
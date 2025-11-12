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

## Executar com Docker (local)

Estas instruções mostram duas formas simples de executar a aplicação localmente com Docker:

- Opção rápida (rodar containers separados com `docker run` para MySQL e Redis + sua app)
- Opção recomendada (usar `docker compose` com um arquivo de exemplo)

Observação: a aplicação lê variáveis de ambiente do `.env` (veja seção Variáveis de ambiente acima). Ajuste as portas conforme necessário.

1) Opção rápida (containers separados)

- Criar uma rede Docker para comunicação entre containers:

```bash
docker network create notification_net
```

- Subir banco MySQL (exemplo mínimo):

```bash
docker run -d --name nc-mysql --network notification_net \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=notifications \
  -p 3306:3306 \
  mysql:8 --default-authentication-plugin=mysql_native_password
```

- Subir Redis:

```bash
docker run -d --name nc-redis --network notification_net -p 6379:6379 redis:6
```

- Build da imagem da aplicação (no diretório do projeto):

```bash
docker build -t notification_center:local .
```

- Criar um arquivo `.env` local (exemplo minimal):

```
PORT=3333
ADMIN_TOKEN=admin_example_token
DATABASE_URL=mysql://root:rootpass@nc-mysql:3306/notifications
REDIS_HOST=nc-redis
REDIS_PORT=6379
URL_NOTIFICATION=http://example.local/webhook
```

- Rodar o container da aplicação apontando para a rede e o arquivo `.env`:

```bash
docker run -d --name nc-app --network notification_net --env-file .env -p 3333:3333 notification_center:local
```

- Rodando migrações (opcional):

Se você prefere rodar as migrations dentro do container após subir o DB, execute:

```bash
docker exec -it nc-app sh -c "npx prisma generate && npx prisma migrate deploy"
```

2) Opção recomendada: `docker compose` (exemplo)

Crie um arquivo `docker-compose.yml` próximo ao `Dockerfile` com o conteúdo abaixo (exemplo):

```yaml
version: '3.8'
services:
  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: notifications
    ports:
      - '3306:3306'
    volumes:
      - db-data:/var/lib/mysql

  redis:
    image: redis:6
    ports:
      - '6379:6379'

  app:
    build: .
    env_file: .env
    ports:
      - '3333:3333'
    depends_on:
      - db
      - redis
    networks:
      - default

volumes:
  db-data:
```

- Com o `docker-compose.yml` e `.env` no lugar, levante tudo com:

```bash
docker compose up -d --build
```

- Para aplicar migrations (recomendado antes de executar em produção):

```bash
docker compose exec app sh -c "npx prisma generate && npx prisma migrate deploy"
```

3) Observações úteis

- Porta: por padrão a aplicação usa `PORT=3333` (veja `src/env.js`). No `docker run`/`docker compose` mapeie a porta externa que preferir.
- Rede: no exemplo `docker run` usamos `--network notification_net` para que `DATABASE_URL` e `REDIS_HOST` apontem para os nomes dos containers (`nc-mysql`, `nc-redis`). No `docker-compose` os serviços conversam entre si automaticamente.
- Bull Board (dashboard): após subir a app, o painel do Bull Board estará disponível em `http://localhost:3333/ui` (ou na porta configurada).
- Persistência: monte volumes para MySQL e, se desejar, para logs/arquivos gerados pela aplicação.
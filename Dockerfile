# Usar uma imagem base leve do Node.js
FROM node:24-alpine

# Variáveis de ambiente
ENV NODE_ENV=production

# Definir diretório de trabalho
WORKDIR /app

# Copiar apenas os arquivos de dependências para melhor cache
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar o restante do código
COPY . .

# Copiar a pasta do Prisma (caso não tenha vindo no COPY anterior)
COPY prisma ./prisma

# PM2 global
RUN npm install -g pm2

# Dar permissão ao entrypoint
RUN chmod +x entrypoint.sh

# Expor a porta
EXPOSE 3000

# Usar entrypoint customizado
ENTRYPOINT ["./entrypoint.sh"]

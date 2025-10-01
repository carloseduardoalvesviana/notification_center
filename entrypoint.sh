#!/bin/sh
set -e

echo "🚀 Executando migrations..."
npx prisma migrate deploy

echo "🚀 Criando cliente..."
npx prisma generate

echo "✅ Iniciando aplicação com PM2..."
pm2-runtime start src/server.js --name central-notificacoes -- --host 0.0.0.0
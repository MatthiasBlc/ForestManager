#!/bin/sh
# Demarrage de l'API (dev et prod) : migrations, seed idempotent, puis serveur.
# En dev, le client Prisma est regenere (les sources sont montees depuis l'hote).
# Usage : api-start.sh dev|prod
set -e
cd /app/apps/api
if [ "$1" = "dev" ]; then
  npx prisma generate
fi
npx prisma migrate deploy
node prisma/seed.ts
if [ "$1" = "dev" ]; then
  exec node --watch src/server.ts
fi
exec node src/server.ts

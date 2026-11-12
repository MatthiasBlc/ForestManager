#!/bin/sh
# Demarrage de l'API : migrations, seed idempotent, puis serveur.
# Hors prod, le client Prisma est genere au demarrage (en dev les sources sont
# montees depuis l'hote ; l'image de dev ne le contient pas).
# Usage : api-start.sh dev|test|prod   (test : stack E2E, sans rechargement)
set -e
cd /app/apps/api
if [ "$1" != "prod" ]; then
  npx prisma generate
fi
npx prisma migrate deploy
node prisma/seed.ts
if [ "$1" = "dev" ]; then
  exec node --watch src/server.ts
fi
exec node src/server.ts

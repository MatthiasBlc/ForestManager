#!/bin/sh
# Entree du conteneur de tests : client Prisma a jour et migrations appliquees
# sur la base de test, puis la commande demandee (vitest par defaut).
set -e
(cd /app/apps/api && npx prisma generate >/dev/null && npx prisma migrate deploy >/dev/null)
exec "$@"

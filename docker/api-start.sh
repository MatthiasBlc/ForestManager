#!/bin/sh
# Demarrage de l'API : sauvegarde (si BACKUP_DIR), migrations, seed idempotent,
# puis serveur.
# Hors prod, le client Prisma est genere au demarrage (en dev les sources sont
# montees depuis l'hote ; l'image de dev ne le contient pas).
# Usage : api-start.sh dev|test|prod   (test : stack E2E, sans rechargement)
set -e
cd /app/apps/api
if [ "$1" != "prod" ]; then
  npx prisma generate
fi

# Sauvegarde avant les migrations [D76] : la prod seule definit BACKUP_DIR.
# Un echec arrete le conteneur avant toute migration. Les dumps de plus de
# BACKUP_RETENTION_DAYS jours (14 par defaut) sont effaces apres un dump reussi.
if [ -n "${BACKUP_DIR:-}" ]; then
  dump="${BACKUP_DIR}/fm-$(date -u +%Y%m%dT%H%M%SZ).dump"
  echo "Backup: ${dump}"
  # Les parametres de Prisma (schema, connection_limit...) sont refuses par libpq.
  if ! pg_dump --format=custom --no-owner --file="${dump}.part" "${DATABASE_URL%%\?*}"; then
    rm -f "${dump}.part"
    echo "ERROR: backup failed, migrations not applied" >&2
    exit 1
  fi
  mv "${dump}.part" "${dump}"
  find "${BACKUP_DIR}" -name 'fm-*.dump' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
  echo "Backup done ($(du -h "${dump}" | cut -f1))"
fi

npx prisma migrate deploy
node prisma/seed.ts
if [ "$1" = "dev" ]; then
  exec node --watch src/server.ts
fi
exec node src/server.ts

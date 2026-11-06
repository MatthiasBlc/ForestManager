#!/usr/bin/env bash
# Deploy d'une stack Portainer [D147] : reprise de deploy_prod.sh de la V1.
# Substitue les variables du compose (envsubst, liste explicite) puis met a jour
# la stack existante par l'API Portainer (PUT, pull des images, prune).
#
#   COMPOSE_FILE=docker/compose.prod.yml TAG=sha-abc1234 docker/deploy.sh
#
# Changements V2 : variables substituees limitees a la liste (un "$" dans un
# secret ou une URL du compose n'est plus avale), fichier temporaire supprime
# meme en cas d'erreur, image fixee par TAG (retour arriere = redeployer un tag).
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker/compose.prod.yml}
DEPLOY_ENV=${DEPLOY_ENV:-production}
export TAG=${TAG:-latest}

echo "=== ForestManager deploy (${DEPLOY_ENV}, ${COMPOSE_FILE}, ${TAG}) ==="

required_vars=(
  PORTAINER_URL PORTAINER_API STACK_ID ENDPOINT_ID
  POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
  SESSION_SECRET ADMIN_SESSION_SECRET
  MINIO_ACCESS_KEY MINIO_SECRET_KEY
  REGISTRY_URL IMAGE_NAME
)
for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: required variable ${var} is not set" >&2
    exit 1
  fi
  export "${var?}"
done

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "ERROR: ${COMPOSE_FILE} not found" >&2
  exit 1
fi

# Variables du compose remplacees ; tout autre "$" reste tel quel.
SUBST_VARS='${POSTGRES_USER} ${POSTGRES_PASSWORD} ${POSTGRES_DB} ${SESSION_SECRET} ${ADMIN_SESSION_SECRET} ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} ${REGISTRY_URL} ${IMAGE_NAME} ${TAG}'
STACK_FILE=$(mktemp)
trap 'rm -f "${STACK_FILE}"' EXIT
envsubst "${SUBST_VARS}" < "${COMPOSE_FILE}" > "${STACK_FILE}"

PAYLOAD=$(jq -n --rawfile content "${STACK_FILE}" \
  '{ prune: true, pullImage: true, stackFileContent: $content }')

echo "Updating Portainer stack ${STACK_ID}..."
RESPONSE=$(curl -sS -w "\n%{http_code}" -X PUT \
  "${PORTAINER_URL}/api/stacks/${STACK_ID}?endpointId=${ENDPOINT_ID}" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${PORTAINER_API}" \
  --data-binary "${PAYLOAD}")

HTTP_CODE=$(echo "${RESPONSE}" | tail -n1)
if [ "${HTTP_CODE}" -ge 200 ] && [ "${HTTP_CODE}" -lt 300 ]; then
  echo "Deployment successful (HTTP ${HTTP_CODE})"
else
  # Le corps de la reponse peut citer la stack substituee : on ne l'affiche pas en entier.
  echo "ERROR: deployment failed (HTTP ${HTTP_CODE})" >&2
  echo "${RESPONSE}" | sed '$d' | jq -r '.message // empty' 2>/dev/null >&2 || true
  exit 1
fi

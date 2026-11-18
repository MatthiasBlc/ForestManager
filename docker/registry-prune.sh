#!/usr/bin/env bash
# Menage du registry (roadmap C8) : garde les KEEP derniers tags `sha-*` de chaque
# image, plus tous les autres tags (`latest`...), et supprime les manifests des
# plus anciens par l'API du registry (DELETE par digest).
#
#   REGISTRY_URL=registry.example.fr IMAGE_NAME=forestmanager \
#   REGISTRY_USERNAME=... REGISTRY_PASSWORD=... docker/registry-prune.sh
#
# Regles :
# - l'ordre vient de la date de creation de l'image (champ `created` de sa
#   config), pas de l'historique git : les tags de preprod sont des commits de
#   fusion de PR, absents de toute branche ;
# - un digest encore pointe par un tag garde n'est jamais supprime (un DELETE
#   par digest retire tous les tags qui le pointent) ;
# - PROTECT_TAG (le tag qui vient d'etre deploye) est toujours garde ;
# - DRY_RUN=1 affiche sans supprimer.
# Les blobs ne sont liberes que par le `garbage-collect` du registry (cote
# serveur) ; ce script ne fait que retirer les manifests.
set -euo pipefail

: "${REGISTRY_URL:?}" "${IMAGE_NAME:?}"
KEEP=${KEEP:-10}
DRY_RUN=${DRY_RUN:-0}
PROTECT_TAG=${PROTECT_TAG:-}
IMAGES=${IMAGES:-"backend frontend"}
SCHEME=${REGISTRY_SCHEME:-https}

ACCEPT="application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json"

AUTH=()
if [ -n "${REGISTRY_USERNAME:-}" ]; then
  AUTH=(-u "${REGISTRY_USERNAME}:${REGISTRY_PASSWORD:-}")
fi

api() {
  curl -fsS "${AUTH[@]}" "$@"
}

# Digest du manifest pointe par un tag.
digest_of() {
  api -I -H "Accept: ${ACCEPT}" "${BASE}/manifests/$1" |
    tr -d '\r' | awk -F': ' 'tolower($1) == "docker-content-digest" { print $2 }'
}

# Date de creation (secondes epoch) de l'image d'un tag ; pour un index, celle de la
# premiere image dont la plateforme est connue (les attestations sont "unknown").
created_of() {
  local manifest config created
  manifest=$(api -H "Accept: ${ACCEPT}" "${BASE}/manifests/$1")
  if echo "${manifest}" | jq -e '.manifests' >/dev/null; then
    local child
    child=$(echo "${manifest}" | jq -r '[.manifests[] | select(.platform.os != "unknown")][0].digest')
    manifest=$(api -H "Accept: ${ACCEPT}" "${BASE}/manifests/${child}")
  fi
  config=$(echo "${manifest}" | jq -r '.config.digest')
  created=$(api "${BASE}/blobs/${config}" | jq -r '.created // empty')
  # En secondes : les dates n'ont pas toutes le meme fuseau (`Z`, `+01:00`).
  date -d "${created:-@0}" +%s
}

status=0
for image in ${IMAGES}; do
  BASE="${SCHEME}://${REGISTRY_URL}/v2/${IMAGE_NAME}/${image}"
  echo "=== ${IMAGE_NAME}/${image} ==="

  tags=$(api "${BASE}/tags/list?n=10000" | jq -r '.tags // [] | .[]')
  if [ -z "${tags}" ]; then
    echo "aucun tag"
    continue
  fi

  # Tags sha-* tries du plus recent au plus ancien : "date tag" par ligne.
  dated=""
  others=()
  for tag in ${tags}; do
    case "${tag}" in
      sha-*) dated+="$(created_of "${tag}") ${tag}"$'\n' ;;
      *) others+=("${tag}") ;;
    esac
  done
  sorted=$(printf '%s' "${dated}" | sort -rn | awk '{ print $2 }')

  keep=("${others[@]}")
  drop=()
  i=0
  for tag in ${sorted}; do
    if [ "${i}" -lt "${KEEP}" ] || [ "${tag}" = "${PROTECT_TAG}" ]; then
      keep+=("${tag}")
    else
      drop+=("${tag}")
    fi
    i=$((i + 1))
  done

  if [ "${#drop[@]}" -eq 0 ]; then
    echo "rien a supprimer (${#keep[@]} tags)"
    continue
  fi

  declare -A kept_digests=()
  for tag in "${keep[@]}"; do
    kept_digests[$(digest_of "${tag}")]=1
  done

  # Digests lus avant toute suppression : deux tags a supprimer peuvent pointer le
  # meme digest (image web reconstruite a l'identique), et le DELETE du premier
  # retire aussi le second, dont la lecture repondrait alors 404.
  declare -A drop_digests=()
  for tag in "${drop[@]}"; do
    drop_digests[${tag}]=$(digest_of "${tag}")
  done
  declare -A deleted_digests=()

  for tag in "${drop[@]}"; do
    digest=${drop_digests[${tag}]}
    if [ -n "${kept_digests[${digest}]:-}" ]; then
      echo "garde ${tag} (meme digest qu'un tag garde)"
      continue
    fi
    if [ -n "${deleted_digests[${digest}]:-}" ]; then
      echo "supprime ${tag} (meme digest que le precedent)"
      continue
    fi
    if [ "${DRY_RUN}" = "1" ]; then
      echo "supprimerait ${tag} (${digest})"
      continue
    fi
    if api -X DELETE "${BASE}/manifests/${digest}" >/dev/null; then
      deleted_digests[${digest}]=1
      echo "supprime ${tag} (${digest})"
    else
      echo "echec de la suppression de ${tag} (${digest})" >&2
      status=1
    fi
  done
  unset kept_digests drop_digests deleted_digests
  echo "gardes : ${keep[*]}"
done

exit "${status}"

#!/bin/sh
# Variante de la PWA choisie au demarrage du conteneur du front [D220].
# Lance par l'entrypoint de l'image nginx (/docker-entrypoint.d/).
#
#   WEB_VARIANT vide ou absent : prod, rien ne change.
#   WEB_VARIANT=preprod        : nom "Forest Manager Preprod" et icones a bandeau
#                                (dist/preprod/, construit par le build) recopies
#                                a la racine.
#
# La meme image sert la preprod et la prod : un choix au build ne suivrait pas
# une image redeployee d'un environnement a l'autre (retour arriere par tag).
set -eu

ROOT=/usr/share/nginx/html

case "${WEB_VARIANT:-}" in
  "")
    ;;
  preprod)
    cp -f "${ROOT}/preprod/"* "${ROOT}/"
    echo "$0: web variant 'preprod' applied"
    ;;
  *)
    # Valeur inconnue : on garde la prod plutot que de ne pas demarrer.
    echo "$0: unknown WEB_VARIANT '${WEB_VARIANT}', serving the default (production) variant" >&2
    ;;
esac

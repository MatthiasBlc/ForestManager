# Roadmap - V2.2

La premiere case non cochee est le point de reprise. Cocher au fil de l'eau.

## 1. Lot de corrections et petites evolutions (`v2.2.0`)

Decide avec le proprietaire le 2026-11-18 : tout le lot part ensemble en preprod puis en prod, sans hotfix separe pour l'import texte.

Fait et committe sur `Developement` :

- [x] Import par texte colle : etapes en blocs "ETAPE N", lignes parasites ecartees [D222]
- [x] Ordre des tags dans une famille, choisi comme l'ordre des familles [D223]
- [x] Geste retour d'Android coherent avec la fleche de retour d'une recette [D224]

En cours en parallele (un sous-agent chacun, dans un worktree, branche non poussee) :

- [ ] Reimport d'un export dans F-AJOUT-RECETTE [D192, D225] : etapes 1 et 2 (shared, API) faites ; etapes 3 a 5 (web, E2E, docs) en cours. Plan : `1-Plan-Reimport.md`
- [ ] Changelog public, lisible sans connexion (flag `isPublic`) ; Markdown dans les notes de version [D226]
- [ ] E2E WebKit (Safari) [D195, D227]

Integration et mise en ligne :

- [ ] Bilan des trois agents ; choix de D226 (et D227 si besoin) valides au selecteur par le proprietaire
- [ ] Fusion des trois branches dans `Developement` ; `npm test`, `npm run e2e`, lint et typecheck au vert
- [ ] Preprod : PR `Developement` -> `master`, verification pas a pas avec le proprietaire
- [ ] Prod `v2.2.0` : fusion de la PR, tag, changelog ; puis regler a la main l'ordre des tags de Saison et Palier [D223]

## 2. Nouveaux modules (apres la `v2.2.0`)

- [ ] C9 Module liste de courses (CDC S4.7, F-SHP ; droits [D141] ; conversions et rayons deja en base [D36]) : plan a ecrire (`1-Plan-C9.md`), choix au selecteur, puis TDD
- [ ] Autres nouveaux modules : etude et decision pour chacun, a choisir parmi les idees ci-dessous

## Actions infra du proprietaire (reprises de C8, non bloquantes)

- [ ] Menage du registry (a revoir ensemble) : tache planifiee de nuit pour `registry-gc` (ou registry en lecture seule pendant le collect) ; pas de `--delete-untagged` tant que des tags gardes sont d'anciennes images avec index ; `REGISTRY_HTTP_DEBUG_ADDR` a retirer du reseau `proxy` (detail : `../Archive/Rework-V2/31-Mise-en-prod.md` S6)
- [ ] Vraie IP des clients derriere Cloudflare : `trustedIPs` de Traefik a regler (`TRUST_PROXY=3` deja fait) ; reglage et verification dans `../Reference/Architecture.md` S13
- [ ] Retirer la lecture publique des buckets V1 `forestmanager-images-preprod` / `-prod` (`mc anonymous set none`) [D167]

## Idees a etudier (pas encore dans un lot)

Chacune passe par une etude et une decision avant d'entrer dans un lot.

- [ ] Module "On joue a quoi ?" : liste de jeux d'un espace, a partir d'une API publique (nouveau module par le registre [D40], acces sur demande [D33])
- [ ] Module "On regarde quoi et ou ?" : films et series, API publique, interface inspiree de Netflix (memes bases)
- [ ] Visite guidee pour les nouveaux utilisateurs (rail, modules, ajout de recette), si l'ecran de bienvenue [D61] ne suffit pas
- [ ] Bot Discord pour les notifications [D202]

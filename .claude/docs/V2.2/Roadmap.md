# Roadmap - V2.2

La premiere case non cochee est le point de reprise. Cocher au fil de l'eau.

## Lot V2.2

Ordre fixe avec le proprietaire le 2026-11-18 : les plus simples d'abord (1 a 3 en autonomie, puis une seule mise en prod `v2.2.0`).

- [x] Import par texte colle : etapes en blocs "ETAPE N", lignes parasites ecartees [D222]
- [x] Ordre des tags dans une famille, choisi comme l'ordre des familles [D223]
- [x] Geste retour d'Android coherent avec la fleche de retour d'une recette [D224]
- [ ] Reimport d'un export dans F-AJOUT-RECETTE [D192, D225] : plan `1-Plan-Reimport.md` ecrit, etapes 1 a 5 a faire en TDD
- [ ] Changelog public, lisible sans connexion (flag `isPublic`) ; Markdown dans les notes de version
- [ ] C9 Module liste de courses (CDC S4.7, F-SHP ; droits [D141] ; conversions et rayons deja en base [D36]) : plan a ecrire (`1-Plan-C9.md`) puis TDD
- [ ] E2E WebKit (Safari) [D195]

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

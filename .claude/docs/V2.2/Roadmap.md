# Roadmap - V2.2

La premiere case non cochee est le point de reprise. Cocher au fil de l'eau.

## 1. Lot de corrections et petites evolutions (`v2.2.0`)

Decide avec le proprietaire le 2026-11-18 : tout le lot part ensemble en preprod puis en prod, sans hotfix separe pour l'import texte.

Fait et committe sur `Developement` :

- [x] Import par texte colle : etapes en blocs "ETAPE N", lignes parasites ecartees [D222]
- [x] Ordre des tags dans une famille, choisi comme l'ordre des familles [D223]
- [x] Geste retour d'Android coherent avec la fleche de retour d'une recette [D224]

Faits en parallele par trois sous-agents, puis repris sur `Developement` :

- [x] Reimport d'un export dans F-AJOUT-RECETTE [D192, D225] : shared, API, web, E2E (parcours 20), docs. Plan : `1-Plan-Reimport.md` ; libelles de l'ecran a relire en preprod
- [x] Changelog public, lisible sans connexion sur `/news` (case par version) ; Markdown en ligne dans les notes de version [D226]
- [x] E2E WebKit (iPhone) en job de CI a part et informatif ; `npm run e2e:webkit` en local [D195, D227]

Integration et mise en ligne :

- [x] Bilan des trois agents ; choix de D226 et D227 valides au selecteur par le proprietaire
- [x] Fusion des trois branches dans `Developement` ; `npm test` (1809/1809), `npm run e2e` (25 passes, 1 saute), lint et typecheck au vert
- [ ] Preprod : PR `Developement` -> `master`, verification pas a pas avec le proprietaire. Premier passage le 2026-11-18 au vert (import texte, ordre des tags, fleche de retour, reimport, changelog public et Markdown) ; correctif du texte de la feuille "Importer un export" (affiche a l'ecran) a repasser en preprod ; geste retour a voir sur un vrai Android
- [ ] Prod `v2.2.0` : fusion de la PR, tag, changelog (cocher "Visible sans connexion" si souhaite [D226]) ; puis regler a la main l'ordre des tags de Saison et Palier [D223]

## 2. Nouveaux modules (apres la `v2.2.0`)

- [ ] C9 Module liste de courses (CDC S4.7, F-SHP ; droits [D141] ; conversions et rayons deja en base [D36]) : choix tranches au selecteur le 2026-11-18 [D228], plan `2-Plan-C9.md` ; puis TDD (maquette avant le web)
- [ ] Autres nouveaux modules : etude et decision pour chacun, a choisir parmi les idees ci-dessous

## Actions infra du proprietaire (reprises de C8, non bloquantes)

- [ ] Menage du registry (a revoir ensemble) : tache planifiee de nuit pour `registry-gc` (ou registry en lecture seule pendant le collect) ; pas de `--delete-untagged` tant que des tags gardes sont d'anciennes images avec index ; `REGISTRY_HTTP_DEBUG_ADDR` a retirer du reseau `proxy` (detail : `../Archive/Rework-V2/31-Mise-en-prod.md` S6)
- [ ] Vraie IP des clients derriere Cloudflare : `trustedIPs` de Traefik a regler (`TRUST_PROXY=3` deja fait) ; reglage et verification dans `../Reference/Architecture.md` S13
- [ ] Retirer la lecture publique des buckets V1 `forestmanager-images-preprod` / `-prod` (`mc anonymous set none`) [D167]

## Idees a etudier (pas encore dans un lot)

Chacune passe par une etude et une decision avant d'entrer dans un lot.

- [ ] Module "On joue a quoi ?" : liste de jeux d'un espace, a partir d'une API publique (nouveau module par le registre [D40], acces sur demande [D33])
- [ ] Module "On regarde quoi et ou ?" : films et series, API publique, interface inspiree de Netflix (memes bases)
- [ ] Accueil par espace : chacun y regle ses widgets et raccourcis, par espace (aujourd'hui l'espace widgets est personnel et commun a tous les espaces) ; idee du proprietaire a la maquette C9 (2026-11-18)
- [ ] Visite guidee pour les nouveaux utilisateurs (rail, modules, ajout de recette), si l'ecran de bienvenue [D61] ne suffit pas
- [ ] Bot Discord pour les notifications [D202]

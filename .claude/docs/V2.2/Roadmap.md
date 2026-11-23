# Roadmap - V2.2

La premiere case non cochee est le point de reprise. Cocher au fil de l'eau.

Classe par release : une section par version taguee, un lot = une branche `lot/v<X.Y.0>`, un hotfix = une version de patch [D229] (procedure : `../Reference/Architecture.md` S13). Les actions infra et les idees ne sont rattachees a aucune release.

## `v2.2.0` - Corrections et petites evolutions (en prod le 2026-11-18)

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
- [x] Preprod : PR `Developement` -> `master`, verification pas a pas avec le proprietaire. Premier passage le 2026-11-18 au vert (import texte, ordre des tags, fleche de retour, reimport, changelog public et Markdown) ; correctif du texte de la feuille "Importer un export" (affiche a l'ecran) a repasser en preprod ; geste retour a voir sur un vrai Android
- [x] Prod `v2.2.0` (2026-11-18) : fusion de la PR #37, tag, changelog publie (visible sans connexion, notification a tous) ; ordre des tags de Saison (Printemps, Ete, Automne, Hiver) et Palier (Incontournable, Regulier, Occasionnel, A tester) regle

## Hotfixes `v2.2.x`

Depuis `master` dans `hotfix/<sujet>`, puis fusionnes dans le lot en cours.

### `v2.2.1` - Patch planning (en prod le 2026-11-23) [D230]

Retours d'usage du 2026-11-23, choix au selecteur ; plan `4-Plan-Patch-Planning.md`. A faire avant C9.

- [x] Etude et choix au selecteur ; D230 au journal, CDC S4.6 et Parcours P10 a jour
- [x] Ouvrir `hotfix/planning` (2026-11-23) : depuis le commit de `lot/v2.3.0`, dont le code est celui de `master` (`v2.2.0`) et qui n'ajoute que des docs, pour eviter un conflit de docs ; lot laisse en l'etat
- [x] Etape 1 : recette aux portions du repas (`?servings=`), accueil compris (l API renvoie les portions effectives)
- [x] Etape 2 : gestes inverses au planning (clic gauche / toucher : F-REPAS ; clic droit / appui long : la recette)
- [x] Etape 3 : raccourcis du texte libre
- [x] Etape 4 : grille ponctuelle avant generation (shared, API, web) : etape "Repas a generer" apres "Suivant"
- [x] Etape 5 : docs (Plan-Tests, Parcours, ecarts au plan) ; verification complete (1815 tests, 25 E2E, lint, typecheck) et revue a 390 px dans Chrome sur la dev (compte de test) ; changelog : brouillon genere par la CI depuis les commits `fix:`, a reformuler a la mise en prod
- [x] CI de la PR #39 : `verify` en echec sur `npm audit` (avis GHSA-7589-6fvf-x4pw, ReDoS dans `effect` <= 3.22.0, tire par `@prisma/config` 7.10.1, outil en ligne de commande seulement) ; `overrides` `@prisma/config` -> `effect` 3.22.4 sur `hotfix/planning` (2026-11-23), tests et E2E au vert
- [x] Preprod verifiee sur ordinateur (2026-11-23) : gestes, portions, raccourcis, generation ; le proprietaire demande l'accordeon facultatif et la grille (D230 complete), fait sur `hotfix/planning` avant la prod
- [x] PR #41 `hotfix/planning` -> `Developement` (accordeon et grille), preprod revue sur ordinateur ; PR #39 `Developement` -> `master` fusionnee : prod `v2.2.1` taguee (2026-11-23), controlee dans Chrome (lecture seule) ; changelog publie (2 nouveautes, 2 ameliorations, visible sans connexion, notification a tous)
- [x] `Developement` fusionne dans `lot/v2.3.0` (lot = `Developement` = `1780d9a`) ; `hotfix/planning` supprimee ; actions infra laissees en l'etat par le proprietaire

## `v2.3.0` - Liste de courses (branche `lot/v2.3.0`)

- [x] Ouvrir la branche `lot/v2.3.0` depuis `Developement` (2026-11-18, poussee)
- [ ] C9 Module liste de courses (CDC S4.7, F-SHP ; droits [D141] ; conversions et rayons deja en base [D36]) : choix tranches au selecteur le 2026-11-18 [D228], maquette `3-Maquette-C9.html` validee, plan `2-Plan-C9.md` ; en TDD
- [ ] Fermeture du lot : `Developement` fusionne dans le lot, `npm test`, `npm run e2e`, lint et typecheck au vert ; PR `lot/v2.3.0` -> `Developement`
- [ ] Preprod : PR `Developement` -> `master`, verification pas a pas avec le proprietaire
- [ ] Prod `v2.3.0` : fusion, tag, changelog ; suppression de la branche du lot

## Releases suivantes (version a fixer a l'ouverture du lot)

- [ ] Autres nouveaux modules : etude et decision pour chacun, a choisir parmi les idees ci-dessous ; chaque module retenu ouvre sa section de release

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

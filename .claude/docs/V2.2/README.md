# V2.2

Chantier ouvert le 2026-11-18, apres la mise en prod de la `v2.1.0` : module liste de courses, reimport de l'export, E2E Safari, et les idees a etudier.

## Ordre de lecture

1. Ce README (etat et reprise).
2. `Roadmap.md` : la premiere case non cochee est le point de reprise.
3. `5-Revue-Ingredients.md` : revue des ingredients de la prod (faite) ; `4-Plan-Patch-Planning.md` : patch planning `v2.2.1` en cours [D230] ; `2-Plan-C9.md` : plan de la liste de courses [D228] ; `1-Plan-Reimport.md` : reimport (fait).
4. `../Reference/CDC.md` : S1 a S3 (vision, glossaire, roles), puis la section du module concerne (liste de courses : S4.7).
5. `../Reference/Journal-des-Decisions.md` : seulement pour le pourquoi d'une regle (chercher le `D##`).

## Etat

- En prod : `v2.2.1` (2026-11-23, patch planning [D230]). Historique du chantier precedent : `../Archive/Rework-V2/`.
- En cours : lot `v2.3.0` (liste de courses, C9), branche `lot/v2.3.0` a jour de la prod.

## Reprise

- 2026-11-18 : chantier ouvert, docs reorganisees [D221] ; `v2.1.0` en prod, changelog publie (notification a tous), familles de tags creees en prod (globales : Saison, Moment, Type de plat ; Le Nid : Categorie, Palier). Prochaine etape : choisir avec le proprietaire par quoi commencer (liste de courses : plan a ecrire avant le code, avec ses choix au selecteur ; ou reimport du JSON d'export, plus court).
- 2026-11-18 (suite) : idees listees avec leur charge (ordre a fixer avec le proprietaire) ; correctif de l'import texte [D222] fait en TDD a partir d'une recette reelle (One pot pasta), a committer puis deployer pour mettre a jour la recette en prod.
- 2026-11-18 (fin) : import texte [D222], ordre des tags [D223] et geste retour [D224] committes (E2E 24/24) ; reimport : choix tranches [D225], plan `1-Plan-Reimport.md` ; reprise a son etape 1. A la mise en prod `v2.2.0` : regler l'ordre de Saison et Palier, reinstaller rien (pas de changement PWA).
- 2026-11-18 (reimport) : etapes 1 (shared) et 2 (API, tests d'integration et matrice B2) faites et committees ; reprise a l'etape 3 (web : lecture du zip, feuille d'apercu). Ecarts au plan notes en fin de `1-Plan-Reimport.md`.
- 2026-11-18 (agents) : trois sous-agents en parallele, chacun dans un worktree (branches non poussees) : fin du reimport (etapes 3 a 5), changelog public + Markdown (D226, choix a valider au selecteur), E2E WebKit (D227). Ensuite : fusion dans `Developement`, mise a jour de la roadmap, un seul passage en preprod de tout le lot (pas de hotfix `v2.1.1` pour l'import texte), puis C9 liste de courses et les nouveaux modules.
- 2026-11-18 (C9) : pendant que les agents tournent, choix de la liste de courses tranches au selecteur (8 points, tous recommandes) et plan `2-Plan-C9.md` ecrit ; D228 reporte au journal et au CDC a la fusion.
- 2026-11-18 (fusion) : les trois agents ont fini ; choix D226 (tels quels) et D227 (WebKit en job informatif, pas de verification iPhone) valides au selecteur ; leurs commits repris sur `Developement` (cherry-pick, conflit du journal resolu) ; D228 au journal et au CDC. Verification complete au vert (1809 tests, 25 E2E). Reprise : preprod (PR `Developement` -> `master`).
- 2026-11-18 (preprod) : CI verte (WebKit compris), `v2.2.0` deployee en preprod et verifiee dans Chrome : les cinq points passent. En preprod il reste une 2.0.0 de test masquee et un second "Gratin dauphinois" dans Coloc recette. Correctif : texte de la feuille "Importer un export" visible (il n'etait lu que par les lecteurs d'ecran), committe, a pousser puis revoir en preprod avant la prod. En parallele : maquette de C9.
- 2026-11-18 (maquette C9) : maquette `3-Maquette-C9.html` validee par le proprietaire, choix reportes dans D228 et au CDC S4.7 ; correctif de `registry-prune` (deux tags au meme digest) committe. Reprise C9 : etape 1 de `2-Plan-C9.md` (shared), en TDD, apres la mise en prod `v2.2.0`.
- 2026-11-18 (prod) : PR #37 fusionnee, `v2.2.0` en prod et taguee, `registry-prune` au vert avec son correctif. Reste au proprietaire : changelog `v2.2.0` (relire, "Visible sans connexion", notifier ou non) et ordre des tags de Saison et Palier [D223]. Puis `/clear` et C9 etape 1.
- 2026-11-18 (fin du lot) : changelog `v2.2.0` publie (visible sans connexion, notification a tous), ordre de Saison et Palier regle en prod. Lot `v2.2.0` termine. Reprise : `/clear`, puis C9 etape 1 de `2-Plan-C9.md` (shared), en TDD.
- 2026-11-18 (flux git) : flux par lot et hotfix decide [D229], procedure dans `../Reference/Architecture.md` S13. Branche `lot/v2.3.0` ouverte et poussee. Reprise : C9 etape 1 de `2-Plan-C9.md` (shared), en TDD, sur `lot/v2.3.0`.
- 2026-11-23 (patch planning) : retours d'usage du proprietaire etudies, choix au selecteur [D230] (droits de generation : D58 garde) ; plan `4-Plan-Patch-Planning.md`, hotfix `v2.2.1` avant C9. Branche `hotfix/planning` ouverte (code de `v2.2.0`, non poussee). Etapes 1 a 5 faites et committees (verification complete au vert, revue dans Chrome sur la dev). Reprise : le proprietaire pousse `hotfix/planning`, PR vers `Developement`, puis preprod (Roadmap, section `v2.2.1`).
- 2026-11-23 (prod `v2.2.1`) : patch planning en prod et tague, changelog publie ; accordeon "Choisir les repas" en grille ajoute apres la revue preprod ; faille `effect` (audit) corrigee par un `overrides`. `Developement` fusionne dans `lot/v2.3.0`, `hotfix/planning` supprimee. Reprise : `/clear`, puis C9 etape 1 de `2-Plan-C9.md` (shared), en TDD, sur `lot/v2.3.0`.
- 2026-11-23 (ingredients) : revue des 152 ingredients de la prod faite avec le proprietaire (selecteur) : 139 verifies, traduits et ranges, 13 fusions, 7 recettes corrigees (`5-Revue-Ingredients.md`). Point ouvert pour C9 : une section de liste de courses ne suit qu'un rayon (`2-Plan-C9.md`, fin). Reprise : `/clear`, puis C9 en commencant par ce point, puis etape 1 (shared), en TDD.
- 2026-11-23 (C9, ouverture) : point ouvert des rayons tranche au selecteur [D231] : section favorite par produit et par espace (premier deplacement memorise, puis "Toujours ranger ici"), sections de depart depuis les rayons, supprimables, doublons par produit et par section, la case coche et toucher le produit ouvre le detail. Journal, CDC S4.7 et plan a jour ; la maquette garde l'ancien geste (non republiee). Reprise : C9 etape 1 de `2-Plan-C9.md` (shared), en TDD.

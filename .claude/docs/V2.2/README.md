# V2.2

Chantier ouvert le 2026-11-18, apres la mise en prod de la `v2.1.0` : module liste de courses, reimport de l'export, E2E Safari, et les idees a etudier.

## Ordre de lecture

1. Ce README (etat et reprise).
2. `Roadmap.md` : la premiere case non cochee est le point de reprise.
3. `1-Plan-Reimport.md` : plan du reimport en cours.
4. `../Reference/CDC.md` : S1 a S3 (vision, glossaire, roles), puis la section du module concerne (liste de courses : S4.7).
5. `../Reference/Journal-des-Decisions.md` : seulement pour le pourquoi d'une regle (chercher le `D##`).

## Etat

- En prod : `v2.1.0` (2026-11-18). Historique du chantier precedent : `../Archive/Rework-V2/` (bilan de mise en prod V2 : `31-Mise-en-prod.md`, recette de la v2.1.0 : `33-Recette-v2.1.md`).
- Fait, pas encore deploye : import par texte colle [D222] ; ordre des tags dans une famille [D223] (migration `tag_order`) ; geste retour d'Android [D224]. Apres le deploy en prod : regler l'ordre de Saison et Palier a la main.

## Reprise

- 2026-11-18 : chantier ouvert, docs reorganisees [D221] ; `v2.1.0` en prod, changelog publie (notification a tous), familles de tags creees en prod (globales : Saison, Moment, Type de plat ; Le Nid : Categorie, Palier). Prochaine etape : choisir avec le proprietaire par quoi commencer (liste de courses : plan a ecrire avant le code, avec ses choix au selecteur ; ou reimport du JSON d'export, plus court).
- 2026-11-18 (suite) : idees listees avec leur charge (ordre a fixer avec le proprietaire) ; correctif de l'import texte [D222] fait en TDD a partir d'une recette reelle (One pot pasta), a committer puis deployer pour mettre a jour la recette en prod.
- 2026-11-18 (fin) : import texte [D222], ordre des tags [D223] et geste retour [D224] committes (E2E 24/24) ; reimport : choix tranches [D225], plan `1-Plan-Reimport.md` ; reprise a son etape 1. A la mise en prod `v2.2.0` : regler l'ordre de Saison et Palier, reinstaller rien (pas de changement PWA).
- 2026-11-18 (reimport) : etapes 1 (shared) et 2 (API, tests d'integration et matrice B2) faites et committees ; reprise a l'etape 3 (web : lecture du zip, feuille d'apercu). Ecarts au plan notes en fin de `1-Plan-Reimport.md`.

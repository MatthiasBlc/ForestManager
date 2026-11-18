# Plan - Reimport d'un export de recettes [D192, D225]

Choix du proprietaire au selecteur le 2026-11-18 (tous ceux recommandes). Le format est celui de l'export : `recettes.json` (`forest-manager/recipes` v1, `recipesExportSchema` de `packages/shared/src/schemas/export.ts`) et `photos/...` dans l'archive zip.

## Decisions (D225)

- **Fichier** : l'archive zip telle que telechargee (photos reprises) ou le `recettes.json` seul (sans photos).
- **Entree** : "Ajouter une recette" > "Creer" : un choix "Importer un export" a cote de "Un lien" et "Un texte colle" ; import dans l'espace courant.
- **Apercu a cocher** : la liste des recettes de l'archive, toutes cochees sauf celles dont le titre existe deja dans l'espace (marquees "Deja dans l'espace", comparaison sans casse ni accents) ; bouton "Importer N recettes". Meme feuille que "Depuis mes recettes" [D203].
- **Auteur et tags** : la personne qui importe devient l'auteur. Tags globaux retrouves par leur nom ; tags d'espace crees dans l'espace courant s'ils n'y existent pas (meme regle que le partage [D216]).
- **Limite** : 200 recettes par import, une seule operation cote API (tout ou rien).

## Regles de conversion

- Ingredients : par nom, comme a l'enregistrement d'une recette (ingredient existant, sinon cree "nouveau" pour la moderation admin). Unites par code (`g`, `tbsp`...) ; code inconnu -> sans unite, quantite gardee, note "unite : <code>".
- Sous-recettes (blocs `RECIPE`) : la reference vers une recette importee dans le meme lot devient un lien vivant ; vers une recette non cochee mais deja dans l'espace (meme titre), lien vers celle-ci ; sinon le bloc est retire et une ligne "Sous-recette non importee : <titre>" s'ajoute aux notes. Ordre de creation : sous-recettes d'abord (tri topologique, 3 niveaux maximum comme a l'edition).
- Rendement, temps, notes, lien source, description : repris tels quels ; `isBase` repris. Revision 1 de source `IMPORT`.
- Photos (zip) : envoyees apres la creation, recette par recette, par le circuit photo existant (televersement puis `PUT /:recipeId/photo`) ; un echec de photo n'annule pas l'import (toast "N photos non reprises").

## Etapes (TDD)

1. [fait] Shared : schema du corps `POST /spaces/:spaceId/recipes/import-export` (`recipes` : 1 a 200 `exportedRecipeSchema`) et de la reponse (`{ ref, recipeId }[]`) ; codes erreur dedies.
2. [fait] API : service d'import (transaction, tri topologique, conversion ci-dessus, permission `recipes.create`), tests d'integration (aller-retour export -> import, doublons, sous-recette absente, unite inconnue, limite 200, droits B2).
3. [fait] Web : lecture du zip dans le navigateur (`fflate`, deja utilise par l'API, a ajouter au front), validation Zod, feuille d'apercu a cocher, envoi, puis photos ; tests composants (archive invalide, JSON seul, doublons decoches).
4. [fait] E2E : export d'un espace puis reimport dans un autre (parcours 11 etendu ou nouveau parcours).
5. [fait, roadmap au coordinateur] Docs : CDC (F-IMP), Parcours (F-AJOUT-RECETTE), Permissions (nouvelle route), cocher la roadmap.

## Ecarts au plan (etapes 1 et 2)

- Route d'apercu en plus : `POST /spaces/:spaceId/recipes/import-export/preview` (`titles` -> `existing`), pour decocher les titres deja presents sans lister tout l'espace.
- Codes : `RECIPE_022` (fichier qui n'est pas un export, pour le front), `RECIPE_023` (sous-recettes en boucle) ; plus de 3 niveaux : `RECIPE_008` existant.
- Corps JSON de cette route seule borne a 3 Mo (50 ko ailleurs) ; 10 imports par 15 min.
- Activite : une ligne "recettes ajoutees" pour un lot, la notification de creation pour une recette seule.

## Ecarts au plan (etapes 3 a 5)

- Export Markdown (zip sans `recettes.json` mais avec des `.md`) : message dedie "refais un export au format JSON" ; tout autre fichier : message de RECIPE_022, sans appel a l'API.
- Photos non reprises comptees aussi quand la photo annoncee manque dans l'archive ou quand l'envoi de photos est coupe (stockage non configure) ; un `recettes.json` seul ne compte rien. Bouton "Photos 2/5..." pendant l'envoi ; toast "N photos non reprises" en ton avertissement.
- Fichier de plus de 200 recettes : apercu en plusieurs appels, les 200 premieres nouvelles cochees, compteur "200 max" comme F-MES-RECETTES.
- Feuille "Creer une recette" : la phrase "Dans tous les cas, tu verifies tout dans l'editeur" devient "Lien ou texte : ..." (le reimport n'ouvre pas l'editeur) ; icone `archive` ajoutee au jeu d'icones.
- E2E : nouveau parcours 20 (`e2e/journeys/20-reimport-export.spec.ts`) plutot que d'etendre le 11 : export JSON avec photos de Famille par lea, reimport dans Colocs par tom (photo reprise), second passage tout "Deja dans l'espace". Parcours 18 et 19, absents de la liste du Plan de tests, y sont ajoutes.

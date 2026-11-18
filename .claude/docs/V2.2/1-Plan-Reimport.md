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

1. Shared : schema du corps `POST /spaces/:spaceId/recipes/import-export` (`recipes` : 1 a 200 `exportedRecipeSchema`) et de la reponse (`{ ref, recipeId }[]`) ; codes erreur dedies.
2. API : service d'import (transaction, tri topologique, conversion ci-dessus, permission `recipes.create`), tests d'integration (aller-retour export -> import, doublons, sous-recette absente, unite inconnue, limite 200, droits B2).
3. Web : lecture du zip dans le navigateur (`fflate`, deja utilise par l'API, a ajouter au front), validation Zod, feuille d'apercu a cocher, envoi, puis photos ; tests composants (archive invalide, JSON seul, doublons decoches).
4. E2E : export d'un espace puis reimport dans un autre (parcours 11 etendu ou nouveau parcours).
5. Docs : CDC (F-IMP), Parcours (F-AJOUT-RECETTE), Permissions (nouvelle route), cocher la roadmap.

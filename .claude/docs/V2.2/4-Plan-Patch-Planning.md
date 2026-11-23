# Plan - Patch planning `v2.2.1` [D230]

Retours d'usage du proprietaire le 2026-11-23, avant le lot liste de courses. Choix tranches au selecteur le meme jour (tous recommandes). Hotfix depuis `master` dans `hotfix/planning` [D229] ; pas de migration Prisma.

## Decisions (D230)

- **Gestes inverses au planning** (D204 amende pour le planning) : clic gauche ou toucher sur un repas ouvre F-REPAS (le reglage du repas), recette comprise ; clic droit, touche Menu ou appui long sans bouger ouvrent la recette du repas-recette (aux portions du repas). Appui long puis glisser : echange, inchange. Repas texte, vide ou "Pas de repas" : pas de geste secondaire (F-REPAS au toucher). "Voir la recette" aussi en tete de F-REPAS (clavier, lecteurs d'ecran). Accueil ("Prochains repas") : inchange, toucher ouvre la recette.
- **La recette s'ouvre aux portions du repas** : lien `?servings=` (deja lu par E-RECETTE pour le retour du mode cuisine), partout ou un repas mene a sa recette (F-REPAS, lecture seule, accueil).
- **F-GENERER, grille avant generation** : apres le profil et la periode, la grille des repas de la periode (date x midi/soir), pre-remplie par la grille du profil [D114] ; on decoche un repas a ne pas remplir, on pose un tag sur un repas (choix unique, feuille de tags D216). Pour cette generation seulement : le profil ne change pas. Les repas verrouilles sont affiches et non cochables ; en mode "Ajouter", les repas deja remplis aussi.
- **Texte libre : raccourcis fixes** sous le champ : Restes, Resto, A emporter, Chez des amis, Pique-nique. Un toucher remplit le champ (remplace le texte), qu'on peut encore modifier.
- **Ecarte** : droits de generer et des profils ouverts aux membres (idee du proprietaire, laissee telle quelle : D58 inchange) ; apercu cochable apres generation ; raccourcis tires des textes deja saisis.

## Etapes (TDD)

1. **Liens aux portions** (web) : `?servings=` sur "Voir la recette" (lecture seule) et sur le lien de l'accueil (`widgets.tsx`) ; portions du repas, sinon defaut de l'espace.
2. **Gestes inverses** (web) : dans `meal-slot.tsx`, le repas-recette devient un bouton (F-REPAS) dont le geste secondaire (clic droit, Menu, appui long sans glisser) ouvre la recette ; `MealForm` affiche "Voir la recette" en tete ; tests de `calendar.test.tsx` et parcours E2E du planning a revoir (geste D204).
3. **Raccourcis du texte libre** (web) : pastilles sous le champ dans `meal-sheet.tsx`.
4. **Grille ponctuelle** : shared (`generateBodySchema` + `cells` facultatif : `{ date, mealTime, state: EXCLUDED | PINNED, tagId? }`, dates dans la periode, une par case) ; API (`generation.ts` : les cases du corps remplacent la grille du profil pour leur date ; tests d'integration, matrice si besoin) ; web (etape "Repas a generer" dans `generate-sheet.tsx`, composant proche de `profile-grid.tsx`).
5. **Docs** : CDC S4.6, Parcours P10, Plan-Tests ; changelog de la version.
6. **Verification** : `npm test`, `npm run e2e`, lint, typecheck ; puis flux hotfix (Architecture S13) : PR -> `Developement`, preprod, prod, `Developement` fusionne dans `lot/v2.3.0`.

## Ecarts au plan

- **Branche** : `hotfix/planning` part du commit de `lot/v2.3.0`, dont le code est celui de `master` (`v2.2.0`) et qui n'ajoute que des docs (les commits de docs de D229 ne sont pas sur `master` : partir de `master` faisait des conflits de docs).
- **Etape 1** : le widget "Prochains repas" ne connaissait pas les portions ; l'API les renvoie (portions du repas, sinon defaut de l'espace).
- **Etape 2** : aide du planning completee ("clic droit : sa recette", "sans bouger : sa recette") ; la regle CSS qui evite la bulle native et la selection a l'appui long vaut pour toutes les cases, plus seulement les liens.
- **Etape 4** : F-GENERER passe en deux etapes ("Suivant" puis "Repas a generer" et "Generer") : un toucher de plus quand on ne change rien, mais la vue des repas est visible a chaque generation (le souhait). La grille envoyee remplace toujours celle du profil pour la periode ; le choix du tag se fait dans la feuille de tags (choix unique), avec "Retirer le tag". Retour depuis "Planning propose" : vers "Repas a generer", choix gardes.
- **Revue dans Chrome** (dev, 390 px) : le compteur "N repas a generer" etait coince a cote du bouton, il passe en tete de la liste. Le retour depuis l'apercu perdait les choix : corrige (choix gardes tant que les options ne changent pas).
- **Revue en preprod par le proprietaire** (2026-11-23, avant la prod) : l'etape obligatoire "Repas a generer" (liste a cocher) devient un accordeon facultatif "Choisir les repas", ferme par defaut, avec une grille : telephone un jour par ligne (Midi, Soir en colonnes), grand ecran la disposition du planning, une grille par semaine, dans une feuille elargie (`Sheet wide`, 880 px) ; un toucher sur une case ouvre son choix comme la grille du profil (choix au selecteur). Accordeon jamais ouvert : la generation suit la grille du profil (pas de `cells`).

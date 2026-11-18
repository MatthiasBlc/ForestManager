# Plan C7c - Ajouter ses recettes a un espace, repas au toucher

Statut : voir le journal (D203, D204, D208). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `1-CDC-V2.md` S5.1 (F-REC-5 partage par reference), S5.2 (E-PLANNING, F-REPAS), `13-Parcours.md` (P05 partage, P09 planning, P14 accueil), `16-Maquettes/2-Recettes/` (F-AJOUT-RECETTE, F-PARTAGER), `16-Maquettes/3-Planning-Profil/` (E-PLANNING, F-REPAS), journal D03, D26, D38, D69, D81, D140, D186, D193.

## 1. Perimetre

**Dans C7c** :

- D203 : dans un espace de groupe, "Ajouter une recette" propose d'abord "Depuis mes recettes" (partage par reference en lot), puis "Creer".
- D204 : toucher un repas-recette ouvre la recette (planning et accueil) ; F-REPAS par appui long, clic droit ou touche Menu ; lien "Planning" par espace dans "Prochains repas" ; echange par glisser au pointeur (doigt et souris, style Trello).

**Hors C7c** : etude UX mobile (apres C7c, D208), connexion Discord (C7b). Pas d'adaptation (copie liee) depuis cette feuille : le partage par reference seulement [D203].

## 2. Decoupage

Tranches verticales, tests ecrits d'abord [D151]. Ordre : maquette, C7c.1, C7c.2, C7c.3, revue dans Chrome, cloture.

### C7c.0 Maquette

Copie locale `16-Maquettes/2-Recettes/` (ou HTML a cote du plan si plus simple) : F-AJOUT-RECETTE refaite (deux lignes, sous-menu Creer) et F-MES-RECETTES (selection multiple, recherche, tags, compteur, confirmation des sous-recettes). Validee par le proprietaire (selecteur) avant le code. Les gestes de D204 n'ont pas de maquette : D204 les decrit, la revue dans Chrome tranche le rendu.

### C7c.1 Depuis mes recettes [D203, D208]

- Partage (`packages/shared`) : `ADD_MINE_MAX = 50`, `addMineBodySchema` (`recipeIds` 1 a 50, sans doublon), `addMinePreviewSchema` (`withIt` : `{ id, title, included }` comme F-PARTAGER), filtre `addable` de `mineRecipeListQuerySchema`.
- API, sous `/spaces/:spaceId/recipes`, droit `recipes.create` ; espace perso refuse (`SPACE_003`) :
  - `GET /mine?addable=true` : recettes de l'utilisateur (`authoredBySql`), non supprimees, non masquees, pas deja visibles dans l'espace (`NOT visibleInSql`). Recherche et tags comme la liste.
  - `POST /add-mine/preview` : sous-recettes emportees par la selection (dedoublonnees, sans celles deja visibles ou deja choisies), `included: false` pour celles d'un autre auteur (elles ne suivent pas, D26).
  - `POST /add-mine` : **tout ou rien** dans une transaction. Chaque recette doit etre de l'utilisateur, non supprimee, non masquee, son auteur membre actif de l'espace d'origine (il tranche lui-meme, D81 : pas de demande) ; sinon `RECIPE_001` et rien n'est ajoute. Une recette deja visible est ignoree (double envoi sans effet). `shareInto` (sous-recettes du meme auteur, demandes en attente closes). Reponse : nombre ajoute.
  - Activite : **une ligne par lot** [D208] : nouveau type `recipes.recipes.added` (`data` : `count`, trois premiers titres) quand le lot compte plus d'une recette ; une seule recette garde `recipes.recipe.shared`.
- Web : bouton "Ajouter une recette" dans un espace de groupe (inchange "Nouvelle recette" dans l'espace perso). Feuille : "Depuis mes recettes" (en tete), puis "Creer" qui ouvre un sous-menu Saisir / Un lien / Un texte colle (choix du proprietaire, D208). F-MES-RECETTES : liste a cases (recherche, puces de tags), compteur "3 choisies", plafond 50 annonce ; "Ajouter" ouvre la confirmation seulement si des sous-recettes suivent (listees, celles d'un autre auteur marquees "reste dans son espace"), sinon ajoute tout de suite ; toast "3 recettes ajoutees a Coloc" ; liste de l'espace rechargee. Refus `RECIPE_001` : message, liste rechargee, selection gardee pour les recettes encore disponibles. Etat vide : "Toutes tes recettes sont deja dans cet espace" ou "Tu n'as pas encore de recette" + Creer.
- Palette (C6b.1) : action "Ajouter mes recettes" dans un espace de groupe.
- Tests : `apps/api/test/recipes-add-mine.test.ts` (filtre, apercu, lot, tout ou rien, droits, espace perso, activite), `apps/web/src/modules/recipes/add-mine.test.tsx`.

### C7c.2 Repas : toucher = recette [D204]

- Planning : toucher (clic, Entree) un repas-recette visible ouvre E-RECETTE ; repas texte, "Pas de repas" et case vide : F-REPAS comme avant. Recette invisible pour le lecteur : F-REPAS.
- F-REPAS : appui long (`useLongPress`, geste D38), clic droit, touche Menu / Maj+F10 sur la case ; libelle accessible de la case ("Ouvrir la recette X, appui long pour le repas").
- Accueil, "Prochains repas" : toucher un repas-recette ouvre la recette ; lien "Planning" a cote du nom de chaque espace (semaine en cours), qu'il y ait des repas ou non.
- Tests : `apps/web/src/modules/meal-plan/calendar.test.tsx`, `apps/web/src/core/home/widgets.test.tsx`.

### C7c.3 Echange au glisser pointeur [D204]

- Un seul code pointeur (`pointerdown/move/up`, capture) pour la souris et le doigt, a la place du drag natif de bureau. Souris : glisser des que le pointeur bouge de quelques pixels. Doigt : appui long, la case se souleve ; si le doigt bouge, glisser ; sinon F-REPAS au relachement.
- Rendu style Trello : carte soulevee (ombre, legere inclinaison) qui suit le pointeur, case d'origine en creux, case survolee eclairee, echange anime ; defilement automatique au bord (vue Semaine et grille). `prefers-reduced-motion` : sans animation.
- Echap ou relacher hors d'une case : annule. Cases verrouillees : ni source ni cible (comme l'echange actuel). Appel `POST /meal-plan/meals/swap` existant.
- "Echanger" reste dans F-REPAS (clavier, lecteurs d'ecran) [D69 amende].
- Tests : logique de glisser isolee (`use-pointer-drag.ts`, seuils, annulation) en jsdom ; le reste en revue Chrome et dans le parcours E2E 9 (echange par glisser au lieu du drag natif).

### Revue et cloture

- Revue dans Chrome, bureau et emulation mobile (Safari ignore).
- Lignes ajoutees a la feuille de recette (`25-Recette-Preprod.html`, collection `recette`) : ajout en lot depuis un espace, sous-recettes, repas au toucher, appui long, glisser bureau et mobile, lien Planning de l'accueil.
- CDC (F-REC-5, E-PLANNING, F-REPAS, E-ACCUEIL), `13-Parcours.md` (P05, P09, P14), E2E touches mis a jour ; suite complete, lint, typecheck verts ; etat dans `README.md`.

## 3. Risques

- Glisser au doigt et defilement : `touch-action: none` seulement pendant le glisser (apres l'appui long), sinon la page ne defile plus.
- Appui long qui ouvre aussi le menu contextuel natif sur mobile : `contextmenu` intercepte sur la case.

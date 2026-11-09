# Plan C5 - Module Planning et generation

Statut : voir le journal (D180 a D185). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `1-CDC-V2.md` S4.6, `11-Modele-Donnees/schema.prisma` section 6, `12-Permissions.md` (Planning), `13-Parcours.md` (P10), `16-Maquettes/3-Planning-Profil/` (E-PLANNING, F-REPAS, F-RECHERCHE, F-GENERER, E-PROFILS-GENERATION, E-IDEES), `15-Plan-Tests.md` (Module Planning, scenario E2E 9). V1 relue depuis `v1-final` : `.claude/docs/V1/features/meal-plan/SPEC_MEAL_PLAN.md`, `SPEC_MEAL_GENERATION.md`, `backend/src/services/mealGeneration*.ts`.

## 1. Perimetre

**Dans C5** : reglages du planning d'un espace, calendrier continu (D180) avec les repas recette, texte libre et "Pas de repas" (D181), verrouillage, echange, vues Jour / Semaine en mobile et grille en bureau ; idees de repas et conversion en recette (D182) ; profils de generation (regles, exclusions, epinglages, profil Standard d'office, D183) ; generation avec apercu, rapport et "Proposer un autre repas" ; compteurs D39 sur le detail d'une recette ; espace PERSONAL compris (F-MPL-1).

**Hors C5** :

- Temps reel (salle `space:<id>`) et activite "Planning de la semaine genere par X" : C6, avec les notifications [D184].
- Liste de courses : C9 (elle prendra une periode du calendrier).

**Ecarts aux maquettes** (a reprendre a l'ecran, les canevas ne sont pas republies) : F-CREER-PLANNING devient F-REGLAGES-PLANNING (repas de la journee, portions par defaut, debut de semaine, role minimal) ; E-PLANNING-vide montre la semaine vide ; E-IDEES perd "Liee a ..." ; la regle du profil gagne le mode "Avance" (jauge 0 a 200 %) ; midi et soir seulement, ni petit-dejeuner ni gouter (D11 amendee).

## 2. Decoupage [D185]

Tranches verticales, comme C3 et C4 : chaque sous-etape livre l'API (`apps/api/src/modules/meal-plan/`, routes sous `/api/v1/spaces/:spaceId/meal-plan`), le partage (schemas, codes `MEAL_`) et les ecrans (`apps/web/src/modules/meal-plan/`), tests ecrits d'abord [D151].

### C5.1 Socle du module, reglages

- Migration : `MealPlanSettings`, `MealSlot`, `MealIdea`, profils, regles, exclusions, epinglages (schema cible, section 6).
- Role minimal reglable par espace : `ApiModule.roleOverrides` lu par `requireModule`, applique aux permissions `configurable` (`meal-plan.edit` = `editRole`).
- Manifeste complet (routeur, permissions, `onSpaceDeleted`), droits calcules dans `shared` (editRole, moderateurs, OWNER).
- Reglages : `GET` / `PUT` des reglages (repas de la journee, portions, debut de semaine ; role minimal par l'OWNER seul). Web : entree Planning dans ModuleNav / TabBar, F-REGLAGES-PLANNING.

### C5.2 Calendrier et repas

- Services entre modules [D184], poses ici a leur premier usage : `provides` / `requires` dans le manifeste, resolus par le registre. Recettes fournit `recipes.catalog` (recettes visibles d'un espace : titres, tags globaux et de l'espace, `isBase`, masquee, supprimee ; le pool de la generation s'y ajoute en C5.5) ; le Planning fournit `meal-plan.recipeStats`.
- Lecture d'une periode (`?from=&to=`, 31 jours au plus) : repas, reglages, droits du lecteur ; recette devenue invisible rendue en texte avec son dernier titre [D184].
- Ecrire un repas (`PUT` par date et repas) : recette (visible dans l'espace), texte, "Pas de repas", commentaire, portions, verrou ; vider (`DELETE`). Echanger deux cases (verrou compris, case vide = deplacer).
- Web : E-PLANNING (grille bureau, Jour / Semaine en mobile, D111), navigation de semaine et "Aujourd'hui", F-REPAS, F-RECHERCHE (espace d'abord, puis mes recettes avec "Partager dans l'espace"), echange par glisser en bureau et mode echange en mobile (D112), lecture seule avec mention sans le droit, PullToRefresh et relecture au retour sur l'onglet.
- Hors ligne (D169) : la semaine affichee est gardee et relue par schema, ecritures desactivees avec le bandeau.
- Compteurs D39 sur E-RECETTE ("Planifiee N fois", "Derniere fois le ...") via `meal-plan.recipeStats`, seulement si le module est actif dans l'espace.

### C5.3 Idees de repas

- CRUD (ajouter : membre ; modifier, supprimer : son idee, ou moderateurs), retrait apres conversion [D182].
- Web : E-IDEES ; "Transformer en recette" ouvre E-RECETTE-EDITION-Idee pre-rempli (nom en titre, commentaire en notes), l'idee est retiree une fois la recette enregistree.

### C5.4 Profils de generation

- CRUD, dupliquer, choisir le profil par defaut, profil "Standard" cree d'office et dernier profil non supprimable [D183].
- Regles sur un tag ou une recette (jamais les deux, CHECK SQL), poids (paliers, ou mode avance de 0 a 200 % par pas de 5 %), repas concerne, frequence min / max par semaine ou par periode, delai entre deux recettes du tag ; grille unique jours x repas pour exclure ou epingler un tag (D114) ; tags fusionnes suivis, tags supprimes signales [D184].
- Web : E-PROFILS-GENERATION (mobile et bureau).

### C5.5 Algorithme de generation (domaine pur)

- `apps/api/src/modules/meal-plan/domain/` sans Express ni Prisma : reprise de l'algorithme V1 (passe principale, rattrapage des minimums, rapport), graine aleatoire injectable, contraintes dans l'ordre V1 (verrou, exclusion, epinglage, frequence max, delais, frequence min, poids).
- Adapte au calendrier continu : les delais regardent les repas deja places avant et apres la periode ; "par semaine" suit les semaines du calendrier, repas hors periode de la semaine compris ; la generation ne refuse jamais et explique chaque case laissee vide (D113).
- Tests unitaires deterministes : chaque contrainte, leurs conflits, idees, recette de base jamais proposee (D24).

### C5.6 Generer, garder, remplacer

- Apercu (`POST .../generate`, moderateurs) : profil, periode, "Remplacer les repas non verrouilles" ; renvoie la proposition, le rapport et l'etat vu de chaque case. Garder (`POST .../generate/apply`) : n'ecrase pas une case modifiee entre-temps et le signale [D110, D184].
- "Proposer un autre repas" sur un repas (droit `editRole`, profil par defaut, recette actuelle exclue), apres confirmation.
- Web : F-GENERER, rapport (F-GENERER-rapport), action du MealSlot.

## 3. Definition de fini de C5

- Chaque route refusee hors de l'espace, sans le module actif, et selon la matrice Planning (role minimal compris) ; teste en integration.
- Algorithme couvert par des tests unitaires deterministes ; apercu sans aucune ecriture en base, verifie.
- Ecrans E-PLANNING, F-REPAS, F-RECHERCHE, F-REGLAGES-PLANNING, F-GENERER et rapport, E-PROFILS-GENERATION, E-IDEES en mobile et bureau, tests de composants verts (axe sans violation), revue visuelle dans Chrome.
- Scenario E2E 9 (remplir, verrouiller, generer le reste) ecrit, joue en C7.
- Lint, typecheck et build verts ; README du chantier et roadmap a jour. Sur les bases existantes, le Planning passe de "Bientot" a "Disponible" dans A04 [D184].

## 4. Scenario E2E 9 (ecrit a la cloture de C5, code et joue en C7)

Parcours 9 de `15-Plan-Tests.md` : remplir le planning a la main, verrouiller un repas, generer le reste de la semaine. Mobile (projet par defaut).

- **Donnees** (route `POST /api/v1/__test/scenario` de C7) : un OWNER, un espace partage avec le Planning accorde et actif, 6 recettes taguees (dont 3 "Vegetarien"), profil Standard sans regle. Date du navigateur figee au mardi d'une semaine connue, reglages par defaut (lundi, midi et soir).
- **Etapes et attentes** :
  1. Ouvrir Planning : vue Jour sur aujourd'hui, 14 cases de la semaine vides (vue Semaine), axe sans violation.
  2. Toucher "Mardi, midi" : F-REPAS, chercher une recette, l'enregistrer ; la case montre son titre.
  3. "Mardi, soir" : Texte libre "Restes", 2 portions, verrou active ; la case montre le texte, "2 p." et le cadenas.
  4. "Mercredi, midi" : "Pas de repas".
  5. Generer, "Cette semaine", sans remplacer : le rapport annonce 11 repas proposes sur 11 et "Laisses tels quels : 1 verrouille, 1 deja rempli, 1 « Pas de repas »" ; garder ce planning.
  6. Les 14 cases sont remplies ; mardi midi et mardi soir n'ont pas change, mercredi midi reste "Pas de repas".
  7. Generer a nouveau avec "Remplacer les repas non verrouilles" : mardi soir (verrouille) et mercredi midi restent tels quels, mardi midi peut changer.
  8. Recharger la page : le planning garde est relu tel quel (rien ne depend du cache).
- **Hors scenario** (deja prouve plus bas) : regles, frequences et delais (unitaires du domaine), conflits a l'enregistrement (integration), tirer pour rafraichir (composant).

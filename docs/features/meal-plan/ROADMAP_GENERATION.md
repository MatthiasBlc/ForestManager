# Roadmap : Meal Plan Generation (Feature 2 — Generation Automatique)

Spec : `docs/features/meal-plan/SPEC_MEAL_GENERATION.md`
Prerequis : Feature 1 (Planning Manuel) completement implementee.

---

## Phase 1 — Modele de donnees & migration

- [x] Creer le modele `MealGenerationParams` dans `schema.prisma`
- [x] Creer le modele `MealSlotExclusion` (pivot, cascade)
- [x] Creer le modele `MealGenerationRule` (tagId XOR recipeId, frequencyMin/Max, tagCooldownDays)
- [x] Creer le modele `MealSlotPin` (pivot, cascade, unique par slot par jeu)
- [x] Ajouter `locked Boolean @default(false)` sur `MealSlot` (Feature 1 migration) — deja present
- [x] Ajouter les relations dans `Community`, `Tag`, `Recipe`
- [x] Generer et appliquer la migration Prisma
- [x] Seed de test : creer un jeu "Standard" avec regles, exclusions et pins pour la communaute de test
- [x] Verifier que le seed passe sans erreur (idempotent)

---

## Phase 2 — Backend API Params CRUD

- [x] Creer `controllers/mealGenerationParams.ts`
- [x] Creer `routes/mealGenerationParams.ts`
- [x] `GET /api/communities/:communityId/meal-generation-params` — liste (memberOf)
- [x] `POST /api/communities/:communityId/meal-generation-params` — creer (MODERATOR)
- [x] `GET /api/communities/:communityId/meal-generation-params/:paramsId` — detail + exclusions + regles + pins (memberOf)
- [x] `PATCH /api/communities/:communityId/meal-generation-params/:paramsId` — modifier (MODERATOR)
- [x] `DELETE /api/communities/:communityId/meal-generation-params/:paramsId` — soft delete (MODERATOR)
- [x] Gestion `isDefault` : un seul par communaute, desactiver l'ancien quand un nouveau est set
- [x] Validation : name max 100, description max 500, cooldownDays >= 0
- [x] Codes erreur MEAL_GEN_001, MEAL_GEN_005
- [x] Brancher les routes (avec requireFeature MEAL_PLAN)
- [x] Tests unitaires CRUD params (26 tests)

---

## Phase 3 — Backend API Exclusions, Rules & Pins

- [x] `PUT .../exclusions` — set complet (MODERATOR)
- [x] `GET .../rules` — liste (memberOf)
- [x] `POST .../rules` — ajouter (MODERATOR)
- [x] `PATCH .../rules/:ruleId` — modifier (MODERATOR)
- [x] `DELETE .../rules/:ruleId` — supprimer (MODERATOR, hard delete)
- [x] `PUT .../pins` — set complet des pins (MODERATOR)
- [x] Validation rules : tagId XOR recipeId, weight 0.0–2.0, frequencyMin <= frequencyMax
- [x] Validation rules : frequencyMin/Max et tagCooldownDays uniquement si tagId (pas recipeId)
- [x] Validation pins : slot ne peut pas etre exclu ET epingle
- [x] Codes erreur MEAL_GEN_003, MEAL_GEN_004, MEAL_GEN_006, MEAL_GEN_009-012
- [x] Tests unitaires exclusions (5 tests)
- [x] Tests unitaires rules CRUD + toutes validations (22 tests)
- [x] Tests unitaires pins CRUD + validations (7 tests) + integration (1 test)

---

## Phase 4 — Algorithme de generation (passe principale)

- [x] Creer `services/mealGeneration.ts` (logique metier isolee)
- [x] Construire le pool de recettes (communaute + idees si useIdeas)
- [x] Skip : slots exclus, verrouilles, deja remplis (si fillEmptyOnly)
- [x] Appliquer le pin (filtrer par tag epingle)
- [x] Filtrage par mealTimeConstraint
- [x] Exclusion par cooldown recette (global + cross-planning)
- [x] Exclusion par cooldown tag (tagCooldownDays par regle + cross-planning)
- [x] Exclusion par frequencyMax (compteur par tag, PER_WEEK/PER_PLANNING)
- [x] Calcul des poids (base x regles tag x regles recette)
- [x] Tirage aleatoire pondere
- [x] Gestion MealIdea sans recipeId → slot FREE_TEXT
- [x] Gestion pool insuffisant → slot EMPTY + warning
- [x] Tests unitaires : poids, cooldown recette, cooldown tag, frequencyMax, pin, locked, fillEmptyOnly, pool vide (25 tests)

---

## Phase 5 — Algorithme de generation (passe de rattrapage + rapport)

- [x] Passe de rattrapage frequencyMin : identifier deficits, remplacer slots les moins prioritaires
- [x] Gestion conflits de contraintes (voir spec section 3.9)
- [x] Construction du rapport de generation (slotsGenerated, slotsSkipped, warnings)
- [x] Types de warning : POOL_EXHAUSTED, FREQUENCY_MIN_NOT_MET, FREQUENCY_MAX_EXCEEDED, CONFLICTING_CONSTRAINTS
- [x] Tests unitaires : frequencyMin, exact (min == max), rattrapage, conflits, rapport complet (6 tests)

---

## Phase 6 — Backend API Generate & Replace

- [x] `POST /api/communities/:communityId/meal-plan/generate` (MODERATOR)
  - [x] Validation : paramsId requis et valide, plan doit exister
  - [x] Mode `fillEmptyOnly` + respect des slots verrouilles
  - [x] Reponse : plan complet + rapport de generation
- [x] `POST /api/communities/:communityId/meal-plan/slots/:slotId/replace` (MODERATOR)
  - [x] Validation : slot non verrouille, paramsId requis
  - [x] Re-roll en excluant la recette actuelle
  - [x] Codes erreur MEAL_GEN_002, MEAL_GEN_007, MEAL_GEN_008
- [x] Fix `hasDefaultGenerationParams` dans GET /meal-plan (spec 2.5)
- [x] Tests integration generate (full + fillEmptyOnly + locked + exclusions + pin + pool vide) — 9 tests
- [x] Tests integration replace (re-roll, slot verrouille, slot exclu, permissions, params invalides) — 5 tests
- [x] Tests integration hasDefaultGenerationParams flag — 3 tests

---

## Phase 7 — Frontend : verrouillage de slots

- [x] Ajouter icone cadenas sur chaque carte de slot
- [x] Toggle verrouille/deverrouille au clic (moderateur : bouton direct sur la carte)
- [x] Style visuel distinct pour les slots verrouilles (ring warning + fond teinte)
- [x] Masquer le bouton "Remplacer" sur les slots verrouilles (done in Phase 10)
- [x] API call PATCH slot avec `{ locked: true/false }`

---

## Phase 8 — Frontend : page parametres de generation

- [x] Section/onglet "Parametres de generation" dans la page planning (onglet "Generation")
- [x] Liste des jeux de params avec badge "par defaut"
- [x] Formulaire creation/edition : nom, description, cooldownDays, useIdeas, isDefault
- [x] Grille d'exclusion : 7x2 checkboxes
- [x] Grille d'epinglage : 7x2 selects tag (autocomplete), incompatible avec exclusion visuelle
- [x] Bouton supprimer avec confirmation (dupliquer reporte — pas d'endpoint backend)

---

## Phase 9 — Frontend : edition des regles

- [x] Section regles dans le detail d'un jeu de params
- [x] Regles par tag :
  - [x] Autocomplete tag communaute
  - [x] Jauge poids 0–200% (slider)
  - [x] Select contrainte LUNCH/DINNER
  - [x] Toggle frequence : Aucune / Exact / Plage (min/max)
  - [x] Champ cooldown tag (jours, optionnel)
- [x] Regles par recette :
  - [x] Autocomplete recette communaute
  - [x] Jauge poids 0–200%
  - [x] Select contrainte LUNCH/DINNER
- [x] CRUD regles inline

---

## Phase 10 — Frontend : generation + rapport

- [x] Bouton "Generer le planning" (MODERATOR)
- [x] Selecteur jeu de params (pre-selectionne sur isDefault)
- [x] Toggle fillEmptyOnly
- [x] Modal confirmation si ecrasement de slots non verrouilles
- [x] Affichage rapport post-generation : slots generes, skips, warnings
- [x] Warning visuel clair pour frequencyMin non atteint, pool epuise, etc.
- [x] Bouton "Remplacer" sur chaque carte (masque si locked ou pas de jeu par defaut)
- [x] Modal confirmation au clic sur "Remplacer"

---

## Phase 11 — Frontend mobile

- [x] Adaptation responsive des pages params/regles/pins
- [x] Bouton generer et remplacer fonctionnels sur mobile
- [x] Grilles exclusion/pins adaptees mobile (layout vertical par jour)
- [x] Icone cadenas fonctionnel sur mobile

---

## Phase 12 — Mise a jour docs & contexte

- [x] Mettre a jour `.claude/context/DB_MODELS.md` (nouveaux modeles) — deja a jour
- [x] Mettre a jour `.claude/context/API_MAP.md` (nouveaux endpoints) — deja a jour
- [x] Mettre a jour `.claude/context/PROGRESS.md`
- [x] Mettre a jour `.claude/context/FILE_MAP.md` (nouveaux composants frontend)
- [x] Mettre a jour Readme (ajout features meal plan + generation)
- [x] Rediger un protocole MANUAL test complet (`docs/features/meal-plan/MANUAL_TEST.md`)

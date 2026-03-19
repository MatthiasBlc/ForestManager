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

- [ ] Creer `controllers/mealGenerationParams.ts`
- [ ] Creer `routes/mealGenerationParams.ts`
- [ ] `GET /api/communities/:communityId/meal-generation-params` — liste (memberOf)
- [ ] `POST /api/communities/:communityId/meal-generation-params` — creer (MODERATOR)
- [ ] `GET /api/communities/:communityId/meal-generation-params/:paramsId` — detail + exclusions + regles + pins (memberOf)
- [ ] `PATCH /api/communities/:communityId/meal-generation-params/:paramsId` — modifier (MODERATOR)
- [ ] `DELETE /api/communities/:communityId/meal-generation-params/:paramsId` — soft delete (MODERATOR)
- [ ] Gestion `isDefault` : un seul par communaute, desactiver l'ancien quand un nouveau est set
- [ ] Validation : name max 100, description max 500, cooldownDays >= 0
- [ ] Codes erreur MEAL_GEN_001, MEAL_GEN_005
- [ ] Brancher les routes (avec requireFeature MEAL_PLAN)
- [ ] Tests unitaires CRUD params

---

## Phase 3 — Backend API Exclusions, Rules & Pins

- [ ] `PUT .../exclusions` — set complet (MODERATOR)
- [ ] `GET .../rules` — liste (memberOf)
- [ ] `POST .../rules` — ajouter (MODERATOR)
- [ ] `PATCH .../rules/:ruleId` — modifier (MODERATOR)
- [ ] `DELETE .../rules/:ruleId` — supprimer (MODERATOR, hard delete)
- [ ] `PUT .../pins` — set complet des pins (MODERATOR)
- [ ] Validation rules : tagId XOR recipeId, weight 0.0–2.0, frequencyMin <= frequencyMax
- [ ] Validation rules : frequencyMin/Max et tagCooldownDays uniquement si tagId (pas recipeId)
- [ ] Validation pins : slot ne peut pas etre exclu ET epingle
- [ ] Codes erreur MEAL_GEN_003, MEAL_GEN_004, MEAL_GEN_006, MEAL_GEN_009-012
- [ ] Tests unitaires exclusions
- [ ] Tests unitaires rules CRUD + toutes validations
- [ ] Tests unitaires pins CRUD + validations

---

## Phase 4 — Algorithme de generation (passe principale)

- [ ] Creer `services/mealGeneration.ts` (logique metier isolee)
- [ ] Construire le pool de recettes (communaute + idees si useIdeas)
- [ ] Skip : slots exclus, verrouilles, deja remplis (si fillEmptyOnly)
- [ ] Appliquer le pin (filtrer par tag epingle)
- [ ] Filtrage par mealTimeConstraint
- [ ] Exclusion par cooldown recette (global)
- [ ] Exclusion par cooldown tag (tagCooldownDays par regle)
- [ ] Exclusion par frequencyMax (compteur par tag)
- [ ] Calcul des poids (base x regles tag x regles recette)
- [ ] Tirage aleatoire pondere
- [ ] Gestion MealIdea sans recipeId → slot FREE_TEXT
- [ ] Gestion pool insuffisant → slot EMPTY + warning
- [ ] Tests unitaires : poids, cooldown recette, cooldown tag, frequencyMax, pin, locked, fillEmptyOnly, pool vide

---

## Phase 5 — Algorithme de generation (passe de rattrapage + rapport)

- [ ] Passe de rattrapage frequencyMin : identifier deficits, remplacer slots les moins prioritaires
- [ ] Gestion conflits de contraintes (voir spec section 3.9)
- [ ] Construction du rapport de generation (slotsGenerated, slotsSkipped, warnings)
- [ ] Types de warning : POOL_EXHAUSTED, FREQUENCY_MIN_NOT_MET, FREQUENCY_MAX_EXCEEDED, CONFLICTING_CONSTRAINTS
- [ ] Tests unitaires : frequencyMin, exact (min == max), rattrapage, conflits, rapport complet

---

## Phase 6 — Backend API Generate & Replace

- [ ] `POST /api/communities/:communityId/meal-plan/generate` (MODERATOR)
  - [ ] Validation : paramsId requis et valide, plan doit exister
  - [ ] Mode `fillEmptyOnly` + respect des slots verrouilles
  - [ ] Reponse : plan complet + rapport de generation
- [ ] `POST /api/communities/:communityId/meal-plan/slots/:slotId/replace` (MODERATOR)
  - [ ] Validation : slot non verrouille, paramsId requis
  - [ ] Re-roll en excluant la recette actuelle
  - [ ] Codes erreur MEAL_GEN_002, MEAL_GEN_007, MEAL_GEN_008
- [ ] Tests integration generate (full + fillEmptyOnly + locked)
- [ ] Tests integration replace (re-roll, slot verrouille)
- [ ] Tests integration rapport de generation

---

## Phase 7 — Frontend : verrouillage de slots

- [ ] Ajouter icone cadenas sur chaque carte de slot
- [ ] Toggle verrouille/deverrouille au clic
- [ ] Style visuel distinct pour les slots verrouilles
- [ ] Masquer le bouton "Remplacer" sur les slots verrouilles
- [ ] API call PATCH slot avec `{ locked: true/false }`

---

## Phase 8 — Frontend : page parametres de generation

- [ ] Section/onglet "Parametres de generation" dans la page planning
- [ ] Liste des jeux de params avec badge "par defaut"
- [ ] Formulaire creation/edition : nom, description, cooldownDays, useIdeas, isDefault
- [ ] Grille d'exclusion : 7x2 checkboxes
- [ ] Grille d'epinglage : 7x2 selects tag (autocomplete), incompatible avec exclusion visuelle
- [ ] Bouton supprimer/dupliquer avec confirmation

---

## Phase 9 — Frontend : edition des regles

- [ ] Section regles dans le detail d'un jeu de params
- [ ] Regles par tag :
  - [ ] Autocomplete tag communaute
  - [ ] Jauge poids 0–200% (slider)
  - [ ] Select contrainte LUNCH/DINNER
  - [ ] Toggle frequence : Aucune / Exact / Plage (min/max)
  - [ ] Champ cooldown tag (jours, optionnel)
- [ ] Regles par recette :
  - [ ] Autocomplete recette communaute
  - [ ] Jauge poids 0–200%
  - [ ] Select contrainte LUNCH/DINNER
- [ ] CRUD regles inline

---

## Phase 10 — Frontend : generation + rapport

- [ ] Bouton "Generer le planning" (MODERATOR)
- [ ] Selecteur jeu de params (pre-selectionne sur isDefault)
- [ ] Toggle fillEmptyOnly
- [ ] Modal confirmation si ecrasement de slots non verrouilles
- [ ] Affichage rapport post-generation : slots generes, skips, warnings
- [ ] Warning visuel clair pour frequencyMin non atteint, pool epuise, etc.
- [ ] Bouton "Remplacer" sur chaque carte (masque si locked ou pas de jeu par defaut)
- [ ] Modal confirmation au clic sur "Remplacer"

---

## Phase 11 — Frontend mobile

- [ ] Adaptation responsive des pages params/regles/pins
- [ ] Bouton generer et remplacer fonctionnels sur mobile
- [ ] Grilles exclusion/pins adaptees mobile
- [ ] Icone cadenas fonctionnel sur mobile

---

## Phase 12 — Mise a jour docs & contexte

- [ ] Mettre a jour `.claude/context/DB_MODELS.md` (nouveaux modeles)
- [ ] Mettre a jour `.claude/context/API_MAP.md` (nouveaux endpoints)
- [ ] Mettre a jour `.claude/context/PROGRESS.md`
- [ ] Mettre a jour `.claude/context/FILE_MAP.md` si necessaire

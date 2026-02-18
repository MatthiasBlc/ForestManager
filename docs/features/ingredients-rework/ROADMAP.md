# Roadmap : Rework Ingredients (Phase 11)

> **Spec** : `docs/features/ingredients-rework/SPEC_INGREDIENTS_REWORK.md`
> **Branche** : `IngredientsRework`

---

## 11.1 - Schema & Migration

- [x] Migration Prisma : creer table Unit (id, name, abbreviation, category, sortOrder)
- [x] Migration Prisma : enrichir Ingredient (status, defaultUnitId, createdById, createdAt, updatedAt)
- [x] Migration Prisma : modifier RecipeIngredient (quantity String? → Float?, ajout unitId)
- [x] Migration Prisma : creer table ProposalIngredient
- [x] Migration Prisma : relation ProposalIngredient sur RecipeUpdateProposal
- [x] Nouveaux enums : UnitCategory, IngredientStatus
- [x] Nouveaux types AdminActionType : INGREDIENT_APPROVED, INGREDIENT_REJECTED, UNIT_CREATED, UNIT_UPDATED, UNIT_DELETED
- [x] Seed : unites standard (17 unites, 5 categories)
- [x] Seed : mettre a jour les ingredients existants (status=APPROVED)
- [x] Tests migration

## 11.2 - Backend Units (CRUD admin + lecture user)

- [x] Endpoint user : GET /api/units (liste groupee par categorie)
- [x] Endpoint admin : GET /api/admin/units
- [x] Endpoint admin : POST /api/admin/units (creation + validation unicite)
- [x] Endpoint admin : PATCH /api/admin/units/:id (modification)
- [x] Endpoint admin : DELETE /api/admin/units/:id (avec protection si utilisee)
- [x] Audit log : UNIT_CREATED, UNIT_UPDATED, UNIT_DELETED
- [x] Tests unitaires + integration

## 11.3 - Backend Ingredients (gouvernance + moderation)

- [x] Refactoring recipeService : upsertIngredients → gestion quantity Float + unitId + creation PENDING
- [x] Endpoint GET /api/ingredients : enrichir avec status, filtrer APPROVED + PENDING
- [x] Endpoint GET /api/ingredients/:id/suggested-unit (pre-selection intelligente)
- [x] Adaptation endpoints admin existants : filtre par status, enrichir reponses
- [x] Endpoint admin : POST /api/admin/ingredients/:id/approve (avec rename optionnel)
- [x] Endpoint admin : POST /api/admin/ingredients/:id/reject (avec raison obligatoire)
- [x] Enrichir merge admin : gerer ProposalIngredient en plus de RecipeIngredient
- [x] Enrichir PATCH admin : gestion du defaultUnitId
- [x] Audit log : INGREDIENT_APPROVED, INGREDIENT_REJECTED
- [x] Protection suppression unite : verifier usage dans RecipeIngredient + ProposalIngredient
- [x] Tests unitaires + integration

## 11.4 - Backend Proposals + Ingredients

- [x] Adapter creation de proposal : stocker ProposalIngredient (ingredients proposes)
- [x] Adapter acceptation de proposal : remplacer RecipeIngredient par ProposalIngredient
- [x] Adapter rejet de proposal : cascade delete ProposalIngredient
- [x] Creation ingredient PENDING depuis une proposal (meme flow que recette)
- [x] Tests unitaires + integration

## 11.5 - Backend Notifications

- [x] Notification WebSocket : INGREDIENT_APPROVED (au createur)
- [x] Notification WebSocket : INGREDIENT_MODIFIED (au createur, avec newName)
- [x] Notification WebSocket : INGREDIENT_MERGED (au createur, avec targetName)
- [x] Notification WebSocket : INGREDIENT_REJECTED (au createur, avec reason)
- [x] Tests

## 11.6 - Frontend Units & Ingredients (refactoring formulaire)

- [x] Composant UnitSelector : dropdown groupee par categorie
- [x] Refactoring IngredientList : autocomplete + champ quantite numerique + UnitSelector
- [x] Pre-selection unite intelligente (appel suggested-unit au choix d'ingredient)
- [x] Badge "nouveau" sur ingredients PENDING dans l'autocomplete
- [x] Endpoint frontend API : GET /api/units, GET /api/ingredients/:id/suggested-unit
- [x] Types TypeScript : Unit, UnitCategory, IngredientStatus, ProposalIngredient
- [x] Tests composants

## 11.7 - Frontend Administration

- [x] Page admin units : liste, creation, modification, suppression
- [x] Page admin ingredients : filtre par status (APPROVED / PENDING / tous)
- [x] Actions admin ingredients : approuver, approuver + modifier, merger, rejeter (avec raison)
- [x] Affichage defaultUnit sur chaque ingredient, modification inline
- [x] Notifications toast : INGREDIENT_APPROVED, INGREDIENT_MODIFIED, INGREDIENT_MERGED, INGREDIENT_REJECTED
- [x] Tests

## 11.8 - Frontend Proposals + Ingredients

- [x] Formulaire de proposal : inclure la section ingredients (meme composant que creation recette)
- [x] Vue detail proposal : afficher les ingredients proposes vs actuels (diff)
- [x] Acceptation proposal : feedback visuel ingredients mis a jour
- [x] Tests

## 11.9 - Documentation & Tests manuels

- [ ] Mettre a jour docs/0 - brainstorming futur.md (cocher le point)
- [ ] Mettre a jour .claude/context/ (DB_MODELS, API_MAP, FILE_MAP, TESTS, PROGRESS)
- [ ] Tests manuels end-to-end (scenarios cles documentes)

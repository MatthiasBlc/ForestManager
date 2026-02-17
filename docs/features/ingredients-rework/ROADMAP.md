# Roadmap : Rework Ingredients (Phase 11)

> **Spec** : `docs/features/ingredients-rework/SPEC_INGREDIENTS_REWORK.md`
> **Branche** : `IngredientsRework`

---

## 11.1 - Schema & Migration

- [ ] Migration Prisma : creer table Unit (id, name, abbreviation, category, sortOrder)
- [ ] Migration Prisma : enrichir Ingredient (status, defaultUnitId, createdById, createdAt, updatedAt)
- [ ] Migration Prisma : modifier RecipeIngredient (quantity String? → Float?, ajout unitId)
- [ ] Migration Prisma : creer table ProposalIngredient
- [ ] Migration Prisma : relation ProposalIngredient sur RecipeUpdateProposal
- [ ] Nouveaux enums : UnitCategory, IngredientStatus
- [ ] Nouveaux types AdminActionType : INGREDIENT_APPROVED, INGREDIENT_REJECTED, UNIT_CREATED, UNIT_UPDATED, UNIT_DELETED
- [ ] Seed : unites standard (18 unites, 5 categories)
- [ ] Seed : mettre a jour les ingredients existants (status=APPROVED)
- [ ] Tests migration

## 11.2 - Backend Units (CRUD admin + lecture user)

- [ ] Endpoint user : GET /api/units (liste groupee par categorie)
- [ ] Endpoint admin : GET /api/admin/units
- [ ] Endpoint admin : POST /api/admin/units (creation + validation unicite)
- [ ] Endpoint admin : PATCH /api/admin/units/:id (modification)
- [ ] Endpoint admin : DELETE /api/admin/units/:id (avec protection si utilisee)
- [ ] Audit log : UNIT_CREATED, UNIT_UPDATED, UNIT_DELETED
- [ ] Tests unitaires + integration

## 11.3 - Backend Ingredients (gouvernance + moderation)

- [ ] Refactoring recipeService : upsertIngredients → gestion quantity Float + unitId + creation PENDING
- [ ] Endpoint GET /api/ingredients : enrichir avec status, filtrer APPROVED + PENDING
- [ ] Endpoint GET /api/ingredients/:id/suggested-unit (pre-selection intelligente)
- [ ] Adaptation endpoints admin existants : filtre par status, enrichir reponses
- [ ] Endpoint admin : POST /api/admin/ingredients/:id/approve (avec rename optionnel)
- [ ] Endpoint admin : POST /api/admin/ingredients/:id/reject (avec raison obligatoire)
- [ ] Enrichir merge admin : gerer ProposalIngredient en plus de RecipeIngredient
- [ ] Enrichir PATCH admin : gestion du defaultUnitId
- [ ] Audit log : INGREDIENT_APPROVED, INGREDIENT_REJECTED
- [ ] Protection suppression unite : verifier usage dans RecipeIngredient + ProposalIngredient
- [ ] Tests unitaires + integration

## 11.4 - Backend Proposals + Ingredients

- [ ] Adapter creation de proposal : stocker ProposalIngredient (ingredients proposes)
- [ ] Adapter acceptation de proposal : remplacer RecipeIngredient par ProposalIngredient
- [ ] Adapter rejet de proposal : cascade delete ProposalIngredient
- [ ] Creation ingredient PENDING depuis une proposal (meme flow que recette)
- [ ] Tests unitaires + integration

## 11.5 - Backend Notifications

- [ ] Notification WebSocket : INGREDIENT_APPROVED (au createur)
- [ ] Notification WebSocket : INGREDIENT_MODIFIED (au createur, avec newName)
- [ ] Notification WebSocket : INGREDIENT_MERGED (au createur, avec targetName)
- [ ] Notification WebSocket : INGREDIENT_REJECTED (au createur, avec reason)
- [ ] Tests

## 11.6 - Frontend Units & Ingredients (refactoring formulaire)

- [ ] Composant UnitSelector : dropdown groupee par categorie
- [ ] Refactoring IngredientList : autocomplete + champ quantite numerique + UnitSelector
- [ ] Pre-selection unite intelligente (appel suggested-unit au choix d'ingredient)
- [ ] Badge "nouveau" sur ingredients PENDING dans l'autocomplete
- [ ] Endpoint frontend API : GET /api/units, GET /api/ingredients/:id/suggested-unit
- [ ] Types TypeScript : Unit, UnitCategory, IngredientStatus, ProposalIngredient
- [ ] Tests composants

## 11.7 - Frontend Administration

- [ ] Page admin units : liste, creation, modification, suppression
- [ ] Page admin ingredients : filtre par status (APPROVED / PENDING / tous)
- [ ] Actions admin ingredients : approuver, approuver + modifier, merger, rejeter (avec raison)
- [ ] Affichage defaultUnit sur chaque ingredient, modification inline
- [ ] Notifications toast : INGREDIENT_APPROVED, INGREDIENT_MODIFIED, INGREDIENT_MERGED, INGREDIENT_REJECTED
- [ ] Tests

## 11.8 - Frontend Proposals + Ingredients

- [ ] Formulaire de proposal : inclure la section ingredients (meme composant que creation recette)
- [ ] Vue detail proposal : afficher les ingredients proposes vs actuels (diff)
- [ ] Acceptation proposal : feedback visuel ingredients mis a jour
- [ ] Tests

## 11.9 - Documentation & Tests manuels

- [ ] Mettre a jour docs/0 - brainstorming futur.md (cocher le point)
- [ ] Mettre a jour .claude/context/ (DB_MODELS, API_MAP, FILE_MAP, TESTS, PROGRESS)
- [ ] Tests manuels end-to-end (scenarios cles documentes)

# Avancement du projet

## MVP COMPLET

Phases 0 a 9.3 terminees.

## Phase 10 - Rework Tags : COMPLETE

- **Spec** : `docs/features/tags-rework/SPEC_TAGS_REWORK.md`
- **Roadmap** : `docs/features/tags-rework/ROADMAP.md`
- **Branche** : `TagsRework` (merged)
- **Tests** : 808 (326 frontend + 485 backend)

## Phase 11 - Rework Ingredients : COMPLETE

- **Spec** : `docs/features/ingredients-rework/SPEC_INGREDIENTS_REWORK.md`
- **Roadmap** : `docs/features/ingredients-rework/ROADMAP.md`
- **Tests manuels** : `docs/features/ingredients-rework/MANUAL_TESTS.md`
- **Branche** : `IngredientsRework` (merged)
- **Tests** : 544 backend + 370 frontend = 914 total

## Phase 12 - Rework Notifications : COMPLETE

- **Spec** : `docs/features/notifications-rework/SPEC_NOTIFICATIONS_REWORK.md`
- **Roadmap** : `docs/features/notifications-rework/ROADMAP.md`
- **Tests manuels** : `docs/features/notifications-rework/MANUAL_TESTS.md`
- **Branche** : `NotificationsUpgrade`
- **Tests** : 590 backend + 363 frontend = 953 total

## Phase 13 - Recipe Rework v2 : EN COURS

- **Spec** : `docs/features/recipe-rework-v2/SPEC_RECIPE_REWORK_V2.md`
- **Roadmap** : `docs/features/recipe-rework-v2/ROADMAP.md`
- **Branche** : `RecipePageV2`
- **Sous-phase 13.1** : Migration DB & modeles Prisma - COMPLETE
- **Sous-phase 13.2** : Backend services & helpers - COMPLETE
- **Sous-phase 13.3** : Backend controllers & routes - COMPLETE
- **Sous-phase 13.4** : Backend tests - COMPLETE (649 tests, 34 fichiers)
  - Tests integration adaptes : recipes, communityRecipes, proposals, share, variants
  - Tests auxiliaires adaptes : activity, members, communityTags, tagSuggestions, adminIngredients, adminUnits, notificationService, websocket
  - Tests unitaires ajoutes : validateServings, validateTime, validateSteps, formatSteps
- **Sous-phase 13.5** : Frontend types & API client - COMPLETE
  - Types mis a jour : RecipeStep, RecipeDetail, RecipeListItem, Proposal, ProposalInput, VariantListItem
  - RecipeInput API : content → servings + steps[]
  - Legacy Recipe interface supprimee
  - Adaptations minimales pages/composants pour compilation (rework complet en 13.7-13.9)
  - MSW handlers et tests mis a jour
- **Sous-phase 13.6** : Frontend composants utilitaires - COMPLETE
  - `formatDuration.ts` : 45→"45 min", 90→"1h30", 120→"2h"
  - `scaleQuantity.ts` : proportionnel avec arrondi 2 decimales
  - `TimeBadges.tsx` : badges prep/cuisson/repos/total avec icones
  - `ServingsSelector.tsx` : join -/input/+ avec label "personnes"
  - `StepEditor.tsx` : textareas numerotes avec reorder/delete
  - Tests unitaires : formatDuration (4 tests) + scaleQuantity (8 tests)
  - 375 tests frontend, 59 fichiers
- **Sous-phase 13.7** : Frontend RecipeDetailPage rework - COMPLETE
  - TimeBadges apres date/meta, tags apres temps
  - ServingsSelector en en-tete ingredients + scaleQuantity dynamique
  - Steps en blocs numerotes (badge + instruction)
- **Sous-phase 13.8** : Frontend RecipeFormPage rework - COMPLETE
  - Supprime content textarea, remplace par StepEditor
  - Champ servings obligatoire (input number 1-100)
  - 3 inputs temps optionnels responsive (prep/cook/rest en min)
  - loadRecipe pre-remplit tous les nouveaux champs en mode edition
  - onSubmit envoie servings + times + steps[]
- **Sous-phase 13.9** : Frontend Proposals rework - COMPLETE
  - ProposeModificationModal : StepEditor + servings + temps + detection changements granulaire
  - ProposalsList : affiche steps proposes + badges servings/temps

## Resume de reprise

Si une session precedente a ete interrompue, un fichier `.claude/context/RESUME.md` peut
contenir l'etat exact du travail en cours. Verifier son existence avant de demarrer.

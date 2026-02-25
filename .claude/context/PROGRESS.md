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
  - Migration `20260225093525_recipe_rework_v2` appliquee
  - Nouveaux modeles : RecipeStep, ProposalStep
  - Nouveaux champs Recipe : servings, prepTime, cookTime, restTime
  - Nouveaux champs RecipeUpdateProposal : proposedServings, proposedPrepTime, proposedCookTime, proposedRestTime
  - Donnees migrees : 12 recettes → 12 RecipeStep (content → step)
  - Anciens champs supprimes : Recipe.content, RecipeUpdateProposal.proposedContent

## Resume de reprise

Si une session precedente a ete interrompue, un fichier `.claude/context/RESUME.md` peut
contenir l'etat exact du travail en cours. Verifier son existence avant de demarrer.

# Refactoring Tracker

Derniere mise a jour : 2026-02-10

## Avancement global

| Groupe                    | Total  | Done  | Reste  |
| ------------------------- | ------ | ----- | ------ |
| Backend P1 (fondations)   | 11     | 10    | 1      |
| Backend P2 (services)     | 5      | 5     | 0      |
| Backend P3 (type safety)  | 6      | 0     | 6      |
| Frontend P1 (hooks/utils) | 6      | 0     | 6      |
| Frontend P2 (composants)  | 6      | 0     | 6      |
| Frontend P3 (qualite)     | 7      | 0     | 7      |
| **TOTAL**                 | **41** | **15** | **26** |

---

## Backend - Priorite 1 (Fondations)

- [x] B1.1 - Extraire constantes de validation partagees
- [x] B1.2 - Extraire utilitaire de pagination
- [x] B1.3 - Creer service de verification membership
- [x] B1.4 - Extraire Prisma select constants
- [x] B1.5 - Extraire service de formatage response recipe
- [x] B1.6 - Extraire tag/ingredient normalization
- [ ] B1.7 - Fusionner controllers tags et ingredients (SKIPPED - abstraction prematuree, ~60 lignes chacun)
- [x] B1.8 - Fix securite : autorisation cancelInvite
- [x] B1.9 - Fix securite : rate limiting auth user
- [x] B1.10 - Fix securite : validation imageUrl
- [x] B1.11 - Supprimer dead code orphanHandling

## Backend - Priorite 2 (Services)

- [x] B2.1 - Creer recipeService.ts
- [x] B2.2 - Creer communityRecipeService.ts
- [x] B2.3 - Creer proposalService.ts
- [x] B2.4 - Creer shareService.ts
- [x] B2.5 - Fix N+1 queries dans orphanHandling

## Backend - Priorite 3 (Type safety)

- [ ] B3.1 - Remplacer `any` par types Prisma
- [ ] B3.2 - Remplacer non-null assertions par guards
- [ ] B3.3 - Typer RequestHandler avec generics
- [ ] B3.4 - Standardiser les codes erreur
- [ ] B3.5 - Trim consistant sur tous les inputs
- [ ] B3.6 - Pagination bounds dans admin controllers

## Frontend - Priorite 1 (Hooks & utils)

- [ ] F1.1 - Creer hook useClickOutside
- [ ] F1.2 - Creer hook useDebounce
- [ ] F1.3 - Creer utilitaire buildQueryString
- [ ] F1.4 - Centraliser le formatage de dates
- [ ] F1.5 - Supprimer dead code (Recipe.tsx, AddEditRecipeDialog.tsx, CSS modules)
- [ ] F1.6 - Standardiser error handling dans api.ts

## Frontend - Priorite 2 (Composants)

- [ ] F2.1 - Fusionner ShareRecipeModal et SharePersonalRecipeModal
- [ ] F2.2 - Factoriser RecipeCard et RecipeListRow
- [ ] F2.3 - Creer composants UI reutilisables (ErrorAlert, LoadingSpinner, EmptyState, StatusBadge)
- [ ] F2.4 - Extraire hook usePaginatedList
- [ ] F2.5 - Remplacer window.confirm par modal custom
- [ ] F2.6 - Factoriser invite response handlers

## Frontend - Priorite 3 (Qualite)

- [ ] F3.1 - Remplacer anti-pattern key pour force re-render
- [ ] F3.2 - Remplacer window.dispatchEvent par state/context
- [ ] F3.3 - Fix index comme key dans IngredientList
- [ ] F3.4 - Retirer console.error du code production
- [ ] F3.5 - Decomposer les pages trop grosses
- [ ] F3.6 - Consolider states lies en objets
- [ ] F3.7 - Ajouter aria-label manquants

---

## Notes de session

### Session 1 - 2026-02-10

**Fichiers crees:**
- `backend/src/util/validation.ts` - Constantes de validation + normalizeNames + isValidHttpUrl
- `backend/src/util/pagination.ts` - parsePagination + buildPaginationMeta
- `backend/src/util/prismaSelects.ts` - RECIPE_TAGS_SELECT, RECIPE_INGREDIENTS_SELECT, RECIPE_DETAIL_INCLUDE
- `backend/src/services/membershipService.ts` - requireMembership, requireRecipeAccess, requireRecipeOwnership

**Fichiers modifies (14):**
- Controllers: auth, users, communities, recipes, communityRecipes, recipeVariants, proposals, invites, tags, ingredients, activity
- Middleware: security.ts (ajout authRateLimiter, skip en mode test)
- Routes: auth.ts (ajout authRateLimiter sur signup/login)
- Services: orphanHandling.ts (suppression dead code)
- Tests: variants.test.ts (correction code erreur COMMUNITY_001 -> RECIPE_002)

**Decision:** B1.4 (Prisma selects) applique partiellement - uniquement la ou le select est identique. Les selects qui incluent des champs extra (community, sharedFromCommunity) sont laisses inline pour eviter les bugs.

**Tests:** 332/332 passent apres modifications.

### Session 2 - 2026-02-10

**B1.5 termine:**
- Cree `backend/src/util/responseFormatters.ts` (formatTags, formatIngredients)
- Applique dans: recipes.ts, communityRecipes.ts, recipeVariants.ts, recipeShare.ts

**B1.7 skipped:** Controllers tags/ingredients trop petits (~60 lignes) pour justifier une abstraction generique. Risque de sur-ingenierie.

### Session 3 - 2026-02-10

**B2 (Services) complete:**
- `backend/src/services/recipeService.ts` - createRecipe, updateRecipe, syncLinkedRecipes, upsertTags, upsertIngredients
- `backend/src/services/communityRecipeService.ts` - createCommunityRecipe (dual personal+community)
- `backend/src/services/proposalService.ts` - acceptProposal (avec propagation), rejectProposal (avec variante)
- `backend/src/services/shareService.ts` - forkRecipe, publishRecipe, getRecipeFamilyCommunities

**B2.5:** Optimise orphanHandling : batch updateMany pour proposals, batch createMany pour activity logs

**Reduction controllers:**
- recipes.ts: 637 -> 366 (-42%)
- communityRecipes.ts: 320 -> 210 (-34%)
- proposals.ts: 616 -> 434 (-30%)
- recipeShare.ts: 569 -> 262 (-54%)

**Tests:** 332/332 passent apres modifications.

---

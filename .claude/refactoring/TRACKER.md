# Refactoring Tracker

Derniere mise a jour : 2026-02-10

## Avancement global

| Groupe                    | Total  | Done  | Reste  |
| ------------------------- | ------ | ----- | ------ |
| Backend P1 (fondations)   | 11     | 10    | 1      |
| Backend P2 (services)     | 5      | 5     | 0      |
| Backend P3 (type safety)  | 6      | 6     | 0      |
| Frontend P1 (hooks/utils) | 6      | 6     | 0      |
| Frontend P2 (composants)  | 6      | 4     | 2      |
| Frontend P3 (qualite)     | 7      | 7     | 0      |
| **TOTAL**                 | **41** | **38** | **3**  |

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

- [x] B3.1 - Remplacer `any` par types Prisma
- [x] B3.2 - Remplacer non-null assertions par guards
- [x] B3.3 - Typer RequestHandler avec generics
- [x] B3.4 - Standardiser les codes erreur
- [x] B3.5 - Trim consistant sur tous les inputs
- [x] B3.6 - Pagination bounds dans admin controllers

## Frontend - Priorite 1 (Hooks & utils)

- [x] F1.1 - Creer hook useClickOutside
- [x] F1.2 - Creer hook useDebouncedEffect
- [x] F1.3 - Creer utilitaire buildQueryString
- [x] F1.4 - Centraliser le formatage de dates
- [x] F1.5 - Supprimer dead code (Recipe.tsx, AddEditRecipeDialog.tsx, CSS modules)
- [x] F1.6 - Standardiser error handling dans api.ts

## Frontend - Priorite 2 (Composants)

- [x] F2.1 - Fusionner ShareRecipeModal et SharePersonalRecipeModal
- [x] F2.2 - Factoriser RecipeCard et RecipeListRow
- [ ] F2.3 - Creer composants UI reutilisables (SKIPPED - one-liners JSX, abstraction prematuree)
- [x] F2.4 - Extraire hook usePaginatedList
- [x] F2.5 - Remplacer window.confirm par modal custom
- [ ] F2.6 - Factoriser invite response handlers (SKIPPED - logique trop differente entre les 2 composants)

## Frontend - Priorite 3 (Qualite)

- [x] F3.1 - Remplacer anti-pattern key pour force re-render
- [x] F3.2 - Remplacer window.dispatchEvent par event module
- [x] F3.3 - Fix index comme key dans IngredientList
- [x] F3.4 - Retirer console.error du code production
- [x] F3.5 - Decomposer les pages trop grosses
- [x] F3.6 - Consolider states lies en objets
- [x] F3.7 - Ajouter aria-label manquants

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

**Tests:** 332/332 backend passent apres modifications.

### Session 4 - 2026-02-10

**B3 (Type safety) complete:**
- B3.1: Remplace `whereClause: any` par `Prisma.RecipeWhereInput` / `Prisma.RecipeUpdateProposalWhereInput` dans 4 controllers
- B3.2: Remplace 14 `req.session.adminId!` par pattern `assertIsDefine(adminId)` dans 4 admin controllers
- B3.3: Ajoute RequestHandler generics dans members.ts (3 handlers) et invites.ts (6 handlers), supprime les casts `as`
- B3.4: Ajoute codes erreur manquants: MEMBER_001-004, PROPOSAL_004, INVITE_004-006, USER_001
- B3.5: Ajoute `.trim()` sur email/username/userId dans invites.ts createInvite
- B3.6: Applique parsePagination/buildPaginationMeta dans admin activityController.ts

**Tests:** 332/332 backend passent apres modifications.

### Session 5 - 2026-02-10

**F1 (Hooks & utils) complete:**

**Fichiers crees:**
- `frontend/src/hooks/useClickOutside.ts` - hook reutilisable pour fermer dropdowns au clic exterieur
- `frontend/src/hooks/useDebouncedEffect.ts` - hook reutilisable pour debounce dans useEffect

**F1.1:** Applique useClickOutside dans 6 composants (IngredientList, TagSelector, IngredientSelector, VariantsDropdown, NotificationDropdown, NavBarLoggedInView)
**F1.2:** Applique useDebouncedEffect dans 3 composants (IngredientList, TagSelector, IngredientSelector). InviteUserModal avait deja un pattern inline plus simple (setTimeout dans useEffect), non modifie.
**F1.3:** Cree `buildQueryString()` dans api.ts, remplace 7 blocs URLSearchParams manuels
**F1.4:** Ajoute `formatDateShort()` dans format.Date.ts, remplace implementations locales dans VariantsDropdown et ProposalsList
**F1.5:** Supprime 6 fichiers dead code: Recipe.tsx, AddEditRecipeDialog.tsx, Recipe.module.css, RecipesPage.module.css, App.module.css, utils.module.css
**F1.6:** Cree `handleApiErrorWith()` factory dans api.ts, remplace 11 error handlers inline. Supprime aussi `console.error` du handler generique.

**Tests:** 332/332 backend + 167/167 frontend passent.

### Session 6 - 2026-02-10

**F2 (Composants) - 4/6 fait, 2 skipped:**

**Fichiers crees:**
- `frontend/src/components/share/ShareModal.tsx` - modal unifiee avec mode "community" | "personal"
- `frontend/src/hooks/useRecipeActions.ts` - logique commune RecipeCard/RecipeListRow
- `frontend/src/hooks/usePaginatedList.ts` - hook generique pagination + load more
- `frontend/src/hooks/useConfirm.tsx` - modal de confirmation custom (remplace window.confirm)

**F2.1:** Fusionne ShareRecipeModal + SharePersonalRecipeModal en un seul ShareModal. Wrappers backwards-compatible preserves pour les imports existants. Supprime les 2 anciens fichiers.
**F2.2:** Cree useRecipeActions hook, deduplique ~50 lignes de logique identique entre RecipeCard et RecipeListRow.
**F2.3 SKIPPED:** ErrorAlert/LoadingSpinner/EmptyState/StatusBadge sont des one-liners JSX. Les wrapper dans des composants ajoute de l'indirection sans gain reel.
**F2.4:** Cree usePaginatedList hook, applique dans RecipesPageLoggedInView et CommunityRecipesList. Elimine ~30 lignes dupliquees par composant.
**F2.5:** Cree useConfirm hook, applique dans MembersList (3 confirms) et useRecipeActions (delete). Plus de window.confirm dans le code.
**F2.6 SKIPPED:** InviteCard et NotificationDropdown ont des callbacks trop differents (navigate vs filter list + navigate). Un hook partage ajouterait de la complexite sans benefice.

**Tests mis a jour:** RecipeCard.test.tsx et MembersList.test.tsx adaptes au nouveau confirm dialog.
**Tests:** 332/332 backend + 167/167 frontend passent.

### Session 7 - 2026-02-10

**F3 (Qualite) complete - 7/7:**

**Fichiers crees:**
- `frontend/src/utils/communityEvents.ts` - module subscribe/notify (remplace window.dispatchEvent)
- `frontend/src/components/communities/CommunityEditForm.tsx` - formulaire edit extrait de CommunityDetailPage

**F3.1:** ProposalsList accepte `refreshSignal` prop, RecipeDetailPage utilise `refreshSignal={proposalsRefresh}` au lieu de `key={proposalsKey}`. Plus de remount complet.
**F3.2:** Cree `communityEvents` module (subscribe/notify pattern). Remplace `window.dispatchEvent(new Event("community-updated"))` dans CommunityDetailPage et `window.addEventListener` dans Sidebar.
**F3.3:** IngredientList utilise `useRef` counter pour generer des IDs stables. `key={itemIds[index]}` remplace `key={index}`.
**F3.4:** Supprime 9 `console.error` dans 8 fichiers (AuthContext, AdminAuthContext, RecipeDetailPage, RecipeFormPage, RecipesPageLoggedInView, NavBarLoggedInView, CommunityRecipesList). ErrorBoundary conserve (last-resort logger).
**F3.5:** Extrait CommunityEditForm de CommunityDetailPage (4 useState + handler deplaces). CommunityDetailPage: 311 -> 238 lignes.
**F3.6:** RecipeDetailPage: 3 booleans `showProposeModal/showShareModal/showPublishModal` remplaces par `openModal: "propose" | "share" | "publish" | null`.
**F3.7:** Ajoute aria-labels: RecipeDetailPage (5 boutons), TagSelector (remove tag), IngredientList (remove ingredient).

**Tests:** 332/332 backend + 167/167 frontend passent.

---

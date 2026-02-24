# Tests - Infrastructure & Reference

## Commandes

```bash
# Depuis la racine (via docker)
npm test                          # Backend + Frontend
npm run test:backend              # Backend seul
npm run test:frontend             # Frontend seul
npm run test:coverage             # Couverture complete

# Depuis backend/ (hors docker, necessite DB test)
npm run test:db:up                # Demarrer DB test (port 5433)
npm run test:db:down              # Arreter DB test
npm run test:db:reset             # Reset DB test
DATABASE_URL=postgresql://test:test@localhost:5433/forestmanager_test?schema=public npx vitest run
npm run test:integration          # Flow complet (db:up + migrate + test + db:down)

# Depuis frontend/
npx vitest run                    # Tous les tests
npx vitest run src/__tests__/unit/NomFichier.test.tsx  # Un seul fichier
```

## Configuration

### Backend (backend/vitest.config.ts)
- Framework: Vitest + Supertest
- Environment: Node.js
- Setup: `__tests__/setup/globalSetup.ts`
- Pattern: `src/__tests__/**/*.test.ts`
- Timeout: 30s
- Pool: singleFork (DB partagee, cleanup afterEach)
- Helpers: `src/__tests__/setup/testHelpers.ts`

### Frontend (frontend/vitest.config.ts)
- Framework: Vitest + Testing Library + MSW
- Environment: jsdom
- Setup: `__tests__/setup/vitestSetup.ts`
- Pattern: `src/__tests__/**/*.test.{ts,tsx}`
- Mocks: `__tests__/setup/mswHandlers.ts`
- Utils: `__tests__/setup/testUtils.tsx`

## Inventaire des tests (~953 tests)

### Backend Integration (26 fichiers, ~539 tests)

| Fichier | Module | Tests |
|---------|--------|-------|
| activity.test.ts | Activity feed (community + personal) | 15 |
| auth.test.ts | User signup/login/logout/me | 16 |
| recipes.test.ts | CRUD recettes (perso + community access) | 32 |
| communityRecipes.test.ts | CRUD recettes communautaires (+ tags scope-aware) | 33 |
| proposals.test.ts | Propositions modifications (+ proposedIngredients) | 38 |
| variants.test.ts | Liste variantes recettes | 10 |
| tags.test.ts | Autocomplete tags (scope-aware) | 9 |
| ingredients.test.ts | Autocomplete ingredients + suggested-unit | 8 |
| communities.test.ts | CRUD communautes | 27 |
| invitations.test.ts | Workflow invitations | 35 |
| members.test.ts | Membres: list, promote, kick, orphan handling | 26 |
| adminAuth.test.ts | Auth 2FA admin | 14 |
| adminTags.test.ts | CRUD tags admin (+ scope filter) | 15 |
| adminIngredients.test.ts | CRUD + approve/reject/merge ingredients admin + notifications | 35 |
| adminUnits.test.ts | CRUD units admin + user endpoint | 25 |
| adminFeatures.test.ts | Features grant/revoke | 10 |
| adminCommunities.test.ts | Communities admin | 8 |
| adminDashboard.test.ts | Stats dashboard | 4 |
| adminActivity.test.ts | Logs activite | 4 |
| share.test.ts | Partage inter-communautes + publish + sync + fork tags | 31 |
| communityTags.test.ts | CRUD + approve/reject tags communaute (moderateur) | 26 |
| tagPreferences.test.ts | Tag visibility + notification preferences + getModeratorIds | 23 |
| notificationService.test.ts | Notification service (create, broadcast, preferences, templates) | 30 |
| notifications.test.ts | Notifications API (CRUD, grouping, batch, preferences) | 27 |
| websocket.test.ts | WebSocket (auth, rooms, notification:new, notification:count, persistence) | 8 |
| notificationCleanup.test.ts | Notification cleanup job (retention, batch, edge cases) | 6 |

### Backend Unit (7 fichiers, ~51 tests)


| Fichier | Module | Tests |
|---------|--------|-------|
| eventEmitter.test.ts | Event emitter | 3 |
| pagination.test.ts | parsePagination, buildPaginationMeta | 14 |
| validation.test.ts | normalizeNames, isValidHttpUrl, constants | 17 |
| responseFormatters.test.ts | formatTags, formatIngredients | 5 |
| middleware/auth.test.ts | requireAuth | 4 |
| middleware/requireSuperAdmin.test.ts | requireSuperAdmin, requireAdminSession | 6 |
| middleware/security.test.ts | requireHttps, rateLimiters, helmet | 5 |

### Frontend Unit (57 fichiers, ~363 tests)

| Fichier | Composant | Tests |
|---------|-----------|-------|
| AuthContext.test.tsx | Context auth user | 6 |
| AdminAuthContext.test.tsx | Context auth admin | 7 |
| LoginModal.test.tsx | Modal login | 6 |
| Modal.test.tsx | Composant modal | 4 |
| SignUpPage.test.tsx | Page inscription | 6 |
| ProtectedRoute.test.tsx | Guard user | 5 |
| NavBar.test.tsx | Navigation | 4 |
| AdminProtectedRoute.test.tsx | Guard admin | 4 |
| AdminLoginPage.test.tsx | Page login admin | 8 |
| AdminDashboardPage.test.tsx | Page dashboard | 4 |
| AdminLayout.test.tsx | Layout admin | 3 |
| pages/admin/AdminTagsPage.test.tsx | Page tags admin (+ scope filter) | 12 |
| pages/admin/AdminIngredientsPage.test.tsx | Page ingredients admin (status, approve/reject) | 17 |
| pages/admin/AdminUnitsPage.test.tsx | Page units admin (CRUD, category filter) | 10 |
| pages/admin/AdminFeaturesPage.test.tsx | Page features admin | 6 |
| pages/admin/AdminCommunitiesPage.test.tsx | Page communities admin | 8 |
| pages/admin/AdminActivityPage.test.tsx | Page activity admin | 5 |
| RecipeCard.test.tsx | Carte recette | 8 |
| RecipeFilters.test.tsx | Filtres recettes | 8 |
| TagSelector.test.tsx | Selecteur tags | 6 |
| IngredientList.test.tsx | Liste ingredients (autocomplete, units, PENDING) | 8 |
| UnitSelector.test.tsx | Selecteur unites par categorie | 7 |
| RecipesPage.test.tsx | Page recettes | 3 |
| MainLayout.test.tsx | Layout principal | 6 |
| Sidebar.test.tsx | Sidebar navigation | 10 |
| HomePage.test.tsx | Page accueil | 6 |
| CommunitiesPage.test.tsx | Page liste communautes | 7 |
| CommunityDetailPage.test.tsx | Page detail communaute | 11 |
| InviteCard.test.tsx | Carte invitation | 5 |
| communities/CommunityTagsList.test.tsx | Tags communaute moderateur (CRUD, approve/reject) | 8 |
| MembersList.test.tsx | Liste membres | 6 |
| InviteUserModal.test.tsx | Modal invitation | 5 |
| ActivityFeed.test.tsx | Feed activite | 8 |
| ShareRecipeModal.test.tsx | Modal partage recette | 7 |
| recipes/SuggestTagModal.test.tsx | Modal suggestion tag | 5 |
| recipes/TagSuggestionsList.test.tsx | Liste suggestions tags owner | 5 |
| profile/TagPreferencesSection.test.tsx | Toggle tag visibility per community | 5 |
| profile/NotificationPreferencesSection.test.tsx | Notification preferences (5 categories, global toggles, error states) | 5 |
| hooks/useClickOutside.test.ts | Hook click outside | 4 |
| hooks/useDebouncedEffect.test.ts | Hook debounce | 5 |
| hooks/useConfirm.test.tsx | Hook confirm dialog | 6 |
| hooks/useSocketEvent.test.ts | Hook socket event | 5 |
| hooks/useCommunityRoom.test.ts | Hook community room | 4 |
| hooks/useNotificationToasts.test.ts | Hook notification toasts (notification:new event) | 5 |
| hooks/usePaginatedList.test.ts | Hook paginated list | 6 |
| utils/formatDate.test.ts | Format date utils | 5 |
| utils/communityEvents.test.ts | Community events bus | 2 |
| pages/DashboardPage.test.tsx | Page dashboard user | 8 |
| pages/ProfilePage.test.tsx | Page profil user | 8 |
| pages/NotFoundPage.test.tsx | Page 404 | 2 |
| pages/RecipeFormPage.test.tsx | Page formulaire recette | 2 |
| proposals/ProposeModificationModal.test.tsx | Modal proposition avec ingredients | 7 |
| proposals/ProposalsList.test.tsx | Liste propositions (diff ingredients, accept/reject) | 7 |

## Couverture cible

- Backend: > 80% sur controllers/routes
- Frontend: > 70% sur composants critiques

## Template nouveau test

```typescript
// Backend: backend/src/__tests__/integration/example.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { testPrisma, createTestUser, cleanupTestData } from '../setup/testHelpers';

// Frontend: frontend/src/__tests__/unit/Example.test.tsx
import { render, screen } from '../setup/testUtils';
import { Example } from '../../components/Example';
```

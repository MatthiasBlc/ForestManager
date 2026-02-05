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

## Inventaire des tests (~436 tests)

### Backend Integration (17 fichiers, ~289 tests)

| Fichier | Module | Tests |
|---------|--------|-------|
| auth.test.ts | User signup/login/logout/me | 16 |
| recipes.test.ts | CRUD recettes (perso + community access) | 32 |
| communityRecipes.test.ts | CRUD recettes communautaires | 28 |
| proposals.test.ts | Propositions modifications | 31 |
| variants.test.ts | Liste variantes recettes | 10 |
| tags.test.ts | Autocomplete tags | 5 |
| ingredients.test.ts | Autocomplete ingredients | 5 |
| communities.test.ts | CRUD communautes | 27 |
| invitations.test.ts | Workflow invitations | 35 |
| members.test.ts | Membres: list, promote, kick, orphan handling | 26 |
| adminAuth.test.ts | Auth 2FA admin | 14 |
| adminTags.test.ts | CRUD tags admin | 12 |
| adminIngredients.test.ts | CRUD ingredients admin | 12 |
| adminFeatures.test.ts | Features grant/revoke | 10 |
| adminCommunities.test.ts | Communities admin | 8 |
| adminDashboard.test.ts | Stats dashboard | 4 |
| adminActivity.test.ts | Logs activite | 4 |

### Frontend Unit (24 fichiers, ~147 tests)

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
| AdminDashboardPage.test.tsx | Page dashboard | 6 |
| AdminLayout.test.tsx | Layout admin | 3 |
| RecipeCard.test.tsx | Carte recette | 8 |
| RecipeFilters.test.tsx | Filtres recettes | 8 |
| TagSelector.test.tsx | Selecteur tags | 6 |
| IngredientList.test.tsx | Liste ingredients | 6 |
| RecipesPage.test.tsx | Page recettes | 3 |
| MainLayout.test.tsx | Layout principal | 6 |
| Sidebar.test.tsx | Sidebar navigation | 10 |
| HomePage.test.tsx | Page accueil | 6 |
| CommunitiesPage.test.tsx | Page liste communautes | 7 |
| CommunityDetailPage.test.tsx | Page detail communaute | 8 |
| InviteCard.test.tsx | Carte invitation | 5 |
| MembersList.test.tsx | Liste membres | 6 |
| InviteUserModal.test.tsx | Modal invitation | 5 |

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

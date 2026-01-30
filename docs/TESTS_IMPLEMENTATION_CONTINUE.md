# Infrastructure de Tests Automatises - COMPLETE

## Statut: TERMINE

Implementation d'une infrastructure de tests automatises pour le backend et le frontend.

**Resultats:**
- Backend: 61 tests (auth, adminAuth, recipes)
- Frontend: 13 tests (AuthContext, AdminAuthContext)
- CI/CD: Jobs test-backend et test-frontend configures

---

## Backend (61 tests)

| Fichier | Description |
|---------|-------------|
| `backend/vitest.config.ts` | Config Vitest (pool: forks, singleFork: true, NODE_ENV: test) |
| `backend/src/__tests__/setup/globalSetup.ts` | Setup DB test + cleanup afterEach |
| `backend/src/__tests__/setup/testHelpers.ts` | Helpers: createTestUser, createTestAdmin, createTestRecipe, etc. |
| `backend/src/__tests__/integration/auth.test.ts` | 16 tests auth user |
| `backend/src/__tests__/integration/adminAuth.test.ts` | 14 tests admin 2FA |
| `backend/src/__tests__/integration/recipes.test.ts` | 31 tests CRUD recettes |

## Frontend (13 tests)

| Fichier | Description |
|---------|-------------|
| `frontend/vitest.config.ts` | Config Vitest avec jsdom + VITE_BACKEND_URL |
| `frontend/src/__tests__/setup/vitestSetup.ts` | Setup jest-dom + MSW server |
| `frontend/src/__tests__/setup/mswHandlers.ts` | Handlers mock API |
| `frontend/src/__tests__/setup/mswServer.ts` | MSW server setup |
| `frontend/src/__tests__/setup/testUtils.tsx` | Custom render avec providers |
| `frontend/src/__tests__/unit/contexts/AuthContext.test.tsx` | 6 tests AuthContext |
| `frontend/src/__tests__/unit/contexts/AdminAuthContext.test.tsx` | 7 tests AdminAuthContext |

## CI/CD

| Fichier | Description |
|---------|-------------|
| `.github/workflows/deploy.yml` | Jobs test-backend et test-frontend avant build |

---

## Commandes pour tester

```bash
# Dans Docker (recommande)
docker compose exec backend npm test
docker compose exec frontend npm test

# Avec coverage
docker compose exec backend npm run test:coverage
docker compose exec frontend npm run test:coverage
```

---

## Notes techniques

### Backend
- Tests executent sequentiellement (`singleFork: true`) pour eviter conflits DB
- `afterEach` nettoie toutes les tables dans le bon ordre (FK)
- Rate limiting admin desactive en mode test (`NODE_ENV=test`)

### Frontend
- MSW intercepte les appels API
- `resetAuthState()` a appeler dans `beforeEach` pour isoler les tests

### CI/CD
- `test-backend` demarre un service PostgreSQL
- `test-frontend` n'a pas besoin de DB (MSW mock)
- Les builds dependent des tests

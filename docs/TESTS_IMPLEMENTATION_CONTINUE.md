# Continuation - Infrastructure de Tests Automatises

## Contexte

Implementation d'une infrastructure de tests automatises pour le backend et le frontend.

## Etat actuel

### FAIT

1. **Backend - Configuration Vitest**
   - `backend/vitest.config.ts` - Configuration Vitest
   - `backend/src/__tests__/setup/globalSetup.ts` - Setup DB test + cleanup
   - `backend/src/__tests__/setup/testHelpers.ts` - Helpers (createTestUser, createTestAdmin, extractSessionCookie, generateTotpCode)
   - `backend/package.json` - Dependencies ajoutees (vitest, supertest, @vitest/coverage-v8)

2. **Backend - Tests integration**
   - `backend/src/__tests__/integration/auth.test.ts` - 12 tests auth user (signup, login, me, logout)
   - `backend/src/__tests__/integration/adminAuth.test.ts` - 10 tests admin 2FA (login step1, totp verify, me, logout)

3. **Frontend - Configuration Vitest + MSW**
   - `frontend/vitest.config.ts` - Configuration Vitest avec jsdom
   - `frontend/src/__tests__/setup/vitestSetup.ts` - Setup jest-dom + MSW
   - `frontend/src/__tests__/setup/mswHandlers.ts` - Handlers mock API (auth, admin, recipes, tags)
   - `frontend/src/__tests__/setup/mswServer.ts` - Setup MSW server
   - `frontend/src/__tests__/setup/testUtils.tsx` - Custom render avec providers
   - `frontend/package.json` - Dependencies ajoutees (vitest, testing-library, msw, jsdom)

4. **Frontend - Tests contexts**
   - `frontend/src/__tests__/unit/contexts/AuthContext.test.tsx` - 6 tests AuthContext

5. **CI/CD**
   - `.github/workflows/deploy.yml` - Jobs test-backend et test-frontend ajoutes avant build

---

## A FAIRE

### 1. Tests AdminAuthContext frontend
Creer `frontend/src/__tests__/unit/contexts/AdminAuthContext.test.tsx`:
```typescript
// Tests a implementer:
// - should start with loading then idle state
// - should restore admin session on mount if authenticated
// - should complete 2-step login flow (loginStep1 + loginStep2)
// - should show QR code for new admin (requiresTotpSetup)
// - should show error on invalid credentials
// - should logout admin
```

### 2. Tests integration CRUD recettes backend
Creer `backend/src/__tests__/integration/recipes.test.ts`:
```typescript
// Basé sur docs/test/2.0_test.md
// Tests a implementer:
// POST /api/recipes:
// - create minimal (title + content) -> 201
// - create complete (+ tags, ingredients) -> 201
// - sans titre -> 400 RECIPE_003
// - sans contenu -> 400 RECIPE_004
// - tags dedupliques (["a", "A", "a"] -> 1 tag)
// - tag creation on-the-fly

// GET /api/recipes:
// - liste par defaut (limit=20)
// - pagination (limit, offset)
// - filtre tags AND
// - recherche titre
// - limit max 100

// GET /api/recipes/:id:
// - recette existante -> 200
// - recette inexistante -> 404 RECIPE_001
// - recette autre user -> 403 RECIPE_002

// PATCH /api/recipes/:id:
// - modifier titre -> 200
// - modifier tags (remplacement) -> 200
// - vider tags -> 200
// - titre vide -> 400

// DELETE /api/recipes/:id:
// - soft delete -> 204
// - n'apparait plus dans liste
// - autre user -> 403
```

### 3. Tests composants frontend
Creer `frontend/src/__tests__/unit/components/LoginModal.test.tsx`:
```typescript
// Tests a implementer:
// - renders login form
// - shows error on invalid credentials
// - closes modal on successful login
// - closes modal on outside click
```

### 4. Mettre a jour documentation
Ajouter dans `docs/DEVELOPMENT_ROADMAP.md` une section "Phase 9.3: Tests automatises" ou integrer dans Phase 8.

---

## Commandes pour tester

```bash
# Backend (dans container ou local avec DB)
cd backend && npm install && npm test

# Frontend
cd frontend && npm install && npm test

# Avec coverage
npm run test:coverage
```

## Structure finale attendue

```
backend/src/__tests__/
  setup/
    globalSetup.ts      [FAIT]
    testHelpers.ts      [FAIT]
  integration/
    auth.test.ts        [FAIT]
    adminAuth.test.ts   [FAIT]
    recipes.test.ts     [A FAIRE]

frontend/src/__tests__/
  setup/
    vitestSetup.ts      [FAIT]
    mswHandlers.ts      [FAIT]
    mswServer.ts        [FAIT]
    testUtils.tsx       [FAIT]
  unit/
    contexts/
      AuthContext.test.tsx       [FAIT]
      AdminAuthContext.test.tsx  [A FAIRE]
    components/
      LoginModal.test.tsx        [A FAIRE]
```

## Notes importantes

- Les tests backend utilisent une vraie DB PostgreSQL (definie par DATABASE_URL)
- Le cleanup se fait dans afterEach de globalSetup.ts
- Les tests frontend utilisent MSW pour mocker l'API
- Les handlers MSW ont des fonctions setUserAuthenticated/setAdminAuthenticated pour controler l'etat

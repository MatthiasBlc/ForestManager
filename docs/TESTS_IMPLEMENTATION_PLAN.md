# Plan d'Implementation des Tests - ForestManager

## Objectif
Mettre en place un systeme de tests unitaires complet pour le backend et le frontend, integre au workflow CI/CD et au DEVELOPMENT_ROADMAP.md.

## Decisions
- **Priorite**: Phase 0.5 (Admin) d'abord
- **Couverture**: Exhaustive (~244 tests total)

---

## Etat Actuel (74 tests)

### Backend (61 tests existants)
| Fichier | Tests | Couverture |
|---------|-------|------------|
| `auth.test.ts` | 16 | User signup/login/logout/me |
| `adminAuth.test.ts` | 14 | Admin 2FA login flow |
| `recipes.test.ts` | 31 | CRUD complet recettes |

### Frontend (13 tests existants)
| Fichier | Tests | Couverture |
|---------|-------|------------|
| `AuthContext.test.tsx` | 6 | Context auth user |
| `AdminAuthContext.test.tsx` | 7 | Context admin 2FA |

### Infrastructure existante
- **Backend**: Vitest + Supertest + Prisma test DB + testHelpers
- **Frontend**: Vitest + MSW + Testing Library + testUtils
- **CI/CD**: Jobs `test-backend` et `test-frontend` dans deploy.yml

---

## Sprints d'Implementation

### Sprint 1: Backend Admin (Phase 0.5) - ~50 tests
- [ ] Ajouter helpers dans `testHelpers.ts`:
  - `createTestCommunity(creatorId, data?)`
  - `createTestFeature(data?)`
  - `loginAsAdmin(admin)` - Helper pour login complet 2FA
- [ ] `adminTags.test.ts` (12 tests)
  - GET /api/admin/tags - liste paginee
  - POST /api/admin/tags - creation
  - PATCH /api/admin/tags/:id - modification
  - DELETE /api/admin/tags/:id - suppression
  - POST /api/admin/tags/:id/merge - fusion
- [ ] `adminIngredients.test.ts` (12 tests)
  - GET /api/admin/ingredients - liste paginee
  - POST /api/admin/ingredients - creation
  - PATCH /api/admin/ingredients/:id - modification
  - DELETE /api/admin/ingredients/:id - suppression
  - POST /api/admin/ingredients/:id/merge - fusion
- [ ] `adminFeatures.test.ts` (10 tests)
  - GET /api/admin/features - liste
  - POST /api/admin/features - creation
  - PATCH /api/admin/features/:id - modification
  - POST /api/admin/communities/:cid/features/:fid - grant
  - DELETE /api/admin/communities/:cid/features/:fid - revoke
- [ ] `adminCommunities.test.ts` (8 tests)
  - GET /api/admin/communities - liste
  - GET /api/admin/communities/:id - detail
  - PATCH /api/admin/communities/:id - modification
  - DELETE /api/admin/communities/:id - suppression
- [ ] `adminDashboard.test.ts` (4 tests)
  - GET /api/admin/dashboard/stats - stats globales
- [ ] `adminActivity.test.ts` (4 tests)
  - GET /api/admin/activity - logs activite

### Sprint 2: Backend User Complet - ~10 tests
- [ ] `tags.test.ts` (5 tests)
  - GET /api/tags - recherche
  - Pagination, filtres, recipeCount
- [ ] `ingredients.test.ts` (5 tests)
  - GET /api/ingredients - recherche
  - Pagination, filtres, recipeCount

### Sprint 3: Frontend Admin (Phase 0.5) - ~20 tests
- [ ] Etendre `mswHandlers.ts` avec mocks admin API:
  - /api/admin/tags (CRUD)
  - /api/admin/ingredients (CRUD)
  - /api/admin/features (CRUD + grant/revoke)
  - /api/admin/communities (CRUD)
  - /api/admin/activity
- [ ] `AdminProtectedRoute.test.tsx` (4 tests)
  - Redirect si non authentifie
  - Redirect si TOTP non verifie
  - Affiche enfants si authentifie
  - Loading state
- [ ] `AdminLoginPage.test.tsx` (8 tests)
  - Formulaire email/password
  - Affichage QR code si nouvelle config
  - Champ TOTP
  - Validation erreurs
  - Redirect apres succes
- [ ] `AdminDashboardPage.test.tsx` (5 tests)
  - Affichage stats
  - Loading state
  - Error state
- [ ] `AdminLayout.test.tsx` (3 tests)
  - Render avec sidebar
  - Navigation

### Sprint 4: Frontend Auth (Phase 1.2) - ~25 tests
- [ ] `LoginModal.test.tsx` (6 tests)
  - Ouverture/fermeture modal
  - Formulaire validation
  - Login succes/erreur
- [ ] `Modal.test.tsx` (4 tests)
  - Click outside ferme
  - Escape ferme
  - Render children
- [ ] `SignUpPage.test.tsx` (6 tests)
  - Formulaire validation
  - Signup succes/erreur
  - Redirect si deja connecte
- [ ] `ProtectedRoute.test.tsx` (5 tests)
  - Redirect si non authentifie
  - Affiche enfants si authentifie
  - Loading state
- [ ] `NavBar.test.tsx` (4 tests)
  - Affichage connecte/deconnecte
  - Navigation links

### Sprint 5: Frontend Recipes (Phase 2.0) - ~40 tests
- [ ] `RecipeCard.test.tsx` (6 tests)
  - Affichage image, titre, tags
  - Click navigation
  - Boutons edit/delete
- [ ] `RecipeListRow.test.tsx` (4 tests)
  - Affichage row
  - Actions
- [ ] `RecipeFilters.test.tsx` (8 tests)
  - Recherche avec debounce
  - Filtre tags
  - Filtre ingredients
  - Reset filtres
  - URL sync
- [ ] `TagSelector.test.tsx` (6 tests)
  - Autocomplete
  - Selection/deselection
  - Creation on-the-fly
- [ ] `IngredientList.test.tsx` (6 tests)
  - Ajout/suppression ligne
  - Autocomplete
  - Quantite
- [ ] `RecipeFormPage.test.tsx` (10 tests)
  - Mode creation
  - Mode edition (pre-remplissage)
  - Validation
  - Submit succes/erreur

### Sprint 6: Frontend Pages & Layout - ~25 tests
- [ ] `RecipeDetailPage.test.tsx` (6 tests)
  - Affichage complet
  - Boutons actions
  - 404 handling
- [ ] `RecipesPage.test.tsx` (5 tests)
  - Liste recettes
  - Pagination
  - Empty state
- [ ] `MainLayout.test.tsx` (6 tests)
  - Responsive sidebar
  - Toggle compact
- [ ] `Sidebar.test.tsx` (5 tests)
  - Navigation items
  - Mode compact
- [ ] `HomePage.test.tsx` (3 tests)
  - Redirect selon auth

### Sprint 7: Documentation & DEVELOPMENT_ROADMAP.md
- [ ] Ajouter section "Tests" apres chaque phase dans DEVELOPMENT_ROADMAP.md
- [ ] Template pour futures fonctionnalites avec tests
- [ ] Checklist validation tests

---

## Fichiers a Creer

### Backend
```
backend/src/__tests__/integration/
  adminTags.test.ts
  adminIngredients.test.ts
  adminFeatures.test.ts
  adminCommunities.test.ts
  adminDashboard.test.ts
  adminActivity.test.ts
  tags.test.ts
  ingredients.test.ts
```

### Frontend
```
frontend/src/__tests__/
  unit/components/
    LoginModal.test.tsx
    Modal.test.tsx
    ProtectedRoute.test.tsx
    NavBar.test.tsx
    admin/
      AdminProtectedRoute.test.tsx
      AdminLayout.test.tsx
    recipes/
      RecipeCard.test.tsx
      RecipeListRow.test.tsx
      RecipeFilters.test.tsx
    form/
      TagSelector.test.tsx
      IngredientList.test.tsx
  unit/pages/
    SignUpPage.test.tsx
    HomePage.test.tsx
    RecipesPage.test.tsx
    RecipeDetailPage.test.tsx
    RecipeFormPage.test.tsx
    admin/
      AdminLoginPage.test.tsx
      AdminDashboardPage.test.tsx
  unit/layout/
    MainLayout.test.tsx
    Sidebar.test.tsx
```

---

## Fichiers a Modifier

1. `backend/src/__tests__/setup/testHelpers.ts` - Ajouter helpers
2. `frontend/src/__tests__/setup/mswHandlers.ts` - Ajouter mocks admin API
3. `docs/DEVELOPMENT_ROADMAP.md` - Ajouter sections tests

---

## Commandes de Verification

```bash
# Backend
cd backend && npm test
cd backend && npm run test:coverage

# Frontend
cd frontend && npm test
cd frontend && npm run test:coverage

# CI/CD (via GitHub Actions)
# Les jobs test-backend et test-frontend doivent etre verts
```

---

## Objectifs de Couverture

| Categorie | Cible |
|-----------|-------|
| Backend controllers/routes | > 80% |
| Frontend composants critiques | > 70% |

---

## Estimation Finale

| Categorie | Tests existants | Tests a ajouter | Total |
|-----------|-----------------|-----------------|-------|
| Backend | 61 | ~60 | ~121 |
| Frontend | 13 | ~110 | ~123 |
| **Total** | **74** | **~170** | **~244** |

---

## Criteres de Succes

- [ ] Tous les tests passent localement
- [ ] CI/CD `test-backend` et `test-frontend` verts
- [ ] Couverture backend > 80%
- [ ] Couverture frontend > 70%
- [ ] DEVELOPMENT_ROADMAP.md mis a jour avec sections tests
- [ ] Template de tests pour futures fonctionnalites documente

---

## Notes Techniques

### Backend
- Tests executent sequentiellement (`singleFork: true`) pour eviter conflits DB
- `afterEach` nettoie toutes les tables dans le bon ordre (FK)
- Rate limiting admin desactive en mode test (`NODE_ENV=test`)

### Frontend
- MSW intercepte les appels API
- `resetAuthState()` a appeler dans `beforeEach` pour isoler les tests
- Utiliser `renderWithUserAuth()` ou `renderWithAdminAuth()` selon le contexte

### CI/CD
- `test-backend` demarre un service PostgreSQL
- `test-frontend` n'a pas besoin de DB (MSW mock)
- Les builds dependent des tests

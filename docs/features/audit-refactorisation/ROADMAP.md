# Roadmap - Audit & Refactorisation Complete

## Phase A : Securite (Priorite critique)

### A1 - CSRF Protection ✅
- [x] Implementer le double-submit cookie pattern cote backend (`middleware/csrf.ts`)
- [x] Ajouter l'intercepteur Axios cote frontend pour envoyer le header CSRF
- [x] Desactive en test env (coherent avec rate limiters)
- [x] Test unitaire du middleware

### A2 - Audit IDOR ✅
- [x] Audit complet de tous les endpoints (21 user controllers + 9 admin controllers)
- [x] 1 issue trouvee et corrigee : `GET /api/recipes/:recipeId/communities` manquait `requireRecipeAccess`
- [x] Tous les autres endpoints correctement proteges (memberOf, requireCommunityRole, requireRecipeAccess/Ownership)

### A3 - Audit Mass Assignment ✅
- [x] Audit complet de tous les controllers (30 fichiers)
- [x] Aucune vulnerabilite trouvee : tous les controllers utilisent l'extraction explicite des champs
- [x] Pas de spread `req.body`, pas de passage direct a Prisma
- [x] Champs sensibles (role, deletedAt, password, totpSecret) jamais settables depuis le body

### A4 - Audit XSS ✅
- [x] Rechercher `dangerouslySetInnerHTML` dans le frontend → aucun usage
- [x] Rechercher `innerHTML`, `document.write`, `eval` → aucun usage (sauf assertions test)
- [x] Verifier la config CSP de Helmet → stricte (self-only, no object/frame)
- [x] Verifier la config CSP Nginx (frontend Dockerfile) → coherente avec Helmet
- [x] X-Content-Type-Options: nosniff active
- [x] Aucune correction necessaire

### A5 - Session Security ✅
- [x] Ajouter `req.session.regenerate()` apres login user (signup + login)
- [x] Ajouter `req.session.regenerate()` apres login admin (step1 + verifyTotp)
- [x] Verifier cookies secure + sameSite en production → OK (secure: prod, sameSite: lax/strict, httpOnly)
- [x] Verifier que logout detruit la session → OK (destroy + clearCookie)
- [x] Session fixation corrigee par regenerate()

### A6 - Upload Security
- [ ] Verifier validation type MIME
- [ ] Verifier taille max
- [ ] Verifier expiration des presigned URLs

### A7 - Logging & Secrets
- [ ] Rechercher les logs de donnees sensibles
- [ ] Verifier .gitignore pour .env
- [ ] Verifier qu'en production les stack traces ne sont pas exposees

---

## Phase B : NPM Audit & Dependencies

### B1 - Audit des dependances
- [ ] `npm audit` backend - corriger critical + high
- [ ] `npm audit` frontend - corriger critical + high
- [ ] Documenter les vulnerabilites non resolvables
- [ ] Mettre a jour les dependances majeures si necessaire

### B2 - CI Integration
- [ ] Ajouter `npm audit --audit-level=high` dans GitHub Actions
- [ ] Faire echouer le build si vulnerabilite high+

---

## Phase C : Lint & Formatage

### C1 - Prettier
- [ ] Installer Prettier (racine du projet)
- [ ] Creer `.prettierrc` avec les conventions du projet
- [ ] Installer `eslint-config-prettier`
- [ ] Ajouter scripts `format` et `format:check`
- [ ] Formater tout le codebase (`npx prettier --write .`)
- [ ] Commit unique "style: format codebase with Prettier"

### C2 - ESLint strict
- [ ] Backend : ajouter `no-explicit-any` (warn), `no-console` (warn)
- [ ] Frontend : ajouter `no-explicit-any` (warn), `self-closing-comp`
- [ ] Corriger les warnings existants progressivement
- [ ] Objectif : 0 warnings a terme

### C3 - Pre-commit hooks
- [ ] Installer Husky
- [ ] Installer lint-staged
- [ ] Configurer : ESLint + Prettier sur fichiers stages
- [ ] Tester le hook

### C4 - CI Lint
- [ ] Ajouter `npm run lint` dans GitHub Actions
- [ ] Ajouter `npm run format:check` dans GitHub Actions

---

## Phase D : DRY Backend

### D1 - Error Codes centralises
- [ ] Creer `constants/errorCodes.ts` avec tous les codes existants
- [ ] Migrer les controllers pour utiliser les constantes
- [ ] Verifier qu'aucun code n'est en string literal

### D2 - Rate Limiter Factory
- [ ] Creer `config/rateLimiter.ts` avec factory function
- [ ] Remplacer les 3 definitions existantes
- [ ] Tester que les rate limits fonctionnent toujours

### D3 - Extraction config app.ts
- [ ] Extraire session config dans `config/session.ts`
- [ ] Extraire error handler dans `middleware/errorHandler.ts`
- [ ] Verifier que app.ts est lisible (~50 lignes)

### D4 - Zod : Phase 1 (fondations)
- [ ] Installer Zod
- [ ] Creer le middleware `validateBody`
- [ ] Creer `schemas/common.schema.ts` (pagination, uuid)
- [ ] Creer `schemas/auth.schema.ts` (signup, login)
- [ ] Migrer auth controllers vers Zod
- [ ] Tests : verifier que la validation fonctionne

### D5 - Zod : Phase 2 (recipes)
- [ ] Creer `schemas/recipe.schema.ts`
- [ ] Migrer recipe create/update controllers
- [ ] Creer `schemas/proposal.schema.ts`
- [ ] Migrer proposal controllers
- [ ] Tests

### D6 - Zod : Phase 3 (reste)
- [ ] Migrer community, invite, user, tag, notification controllers
- [ ] Migrer admin controllers
- [ ] Supprimer les assertions devenues inutiles dans `validation.ts`
- [ ] Garder les constantes et regex dans `validation.ts` (reutilisees dans les schemas)

---

## Phase E : DRY Frontend

### E1 - useAsyncData hook
- [ ] Creer le hook `useAsyncData<T>(fetchFn, deps)`
- [ ] Migrer 2-3 pages pour valider le pattern
- [ ] Migrer le reste des pages progressivement

### E2 - DataContainer composant
- [ ] Creer le composant `DataContainer`
- [ ] Props : loading, error, empty, emptyMessage, children
- [ ] Migrer les pages qui repetent ce pattern

### E3 - SearchSelector generique
- [ ] Creer `SearchSelector<T>` a partir de TagSelector
- [ ] Refactorer TagSelector pour utiliser SearchSelector
- [ ] Refactorer IngredientSelector pour utiliser SearchSelector
- [ ] Verifier que le comportement est identique

### E4 - useImageUpload hook
- [ ] Creer le hook `useImageUpload(entityType, entityId)`
- [ ] Refactorer RecipeFormPage
- [ ] Refactorer CommunityEditPage
- [ ] Tester les deux flows d'upload

### E5 - Extraction routes App.tsx
- [ ] Creer `routes/userRoutes.tsx`
- [ ] Creer `routes/adminRoutes.tsx`
- [ ] Simplifier App.tsx
- [ ] Deplacer NotificationHandler dans MainLayout

---

## Phase F : Clean Code

### F1 - Code mort
- [ ] Scanner avec ESLint strict (no-unused-vars, no-unused-imports)
- [ ] Supprimer les imports inutilises
- [ ] Supprimer les fonctions non appelees
- [ ] Supprimer le code commente

### F2 - Fichiers longs
- [ ] Lister les fichiers >300 lignes
- [ ] Decouper les composants React trop gros
- [ ] Extraire les helpers de controllers vers des services

### F3 - Coherence patterns
- [ ] Verifier format de reponse uniforme (`{ data }` / `{ data, pagination }`)
- [ ] Verifier status codes coherents (201 create, 200 update, 204 delete)
- [ ] Verifier que tous les controllers suivent try/catch → next(error)

---

## Phase G : Tests

### G1 - Couverture actuelle
- [ ] Mesurer la couverture backend (`npm run test:backend -- --coverage`)
- [ ] Mesurer la couverture frontend (`npm run test:frontend -- --coverage`)
- [ ] Identifier les zones non couvertes

### G2 - Tests manquants
- [ ] Ajouter les tests d'integration pour les controllers non couverts
- [ ] Ajouter les tests unitaires pour les services non couverts
- [ ] Prioriser les flux critiques (auth, recipe CRUD, sharing, proposals)

### G3 - Seuil de couverture
- [ ] Definir le seuil dans vitest.config (80% statements, 70% branches)
- [ ] Ajouter la verification dans le CI

### G4 - Tests E2E (evaluation)
- [ ] Evaluer Playwright vs Cypress
- [ ] POC sur 1 flux critique (signup → create recipe)
- [ ] Decider si on integre dans le CI

---

## Phase H : Performances

### H1 - Backend performances
- [ ] Activer query logging Prisma en dev
- [ ] EXPLAIN ANALYZE sur les requetes critiques
- [ ] Ajouter les index manquants
- [ ] Evaluer Redis pour cache (tags globaux, unites)

### H2 - Frontend performances
- [ ] Analyse bundle size (vite-bundle-visualizer)
- [ ] React.lazy() sur pages admin + modales lourdes
- [ ] Profiler re-renders avec React DevTools
- [ ] Verifier lazy loading images

### H3 - Infrastructure
- [ ] Verifier Docker multi-stage build
- [ ] Verifier compression gzip/brotli
- [ ] Verifier health checks

---

## Resume par phase

| Phase | Chantier | Estimation |
|-------|----------|------------|
| A | Securite | Substanciel |
| B | NPM Audit | Rapide |
| C | Lint & Formatage | Rapide |
| D | DRY Backend + Zod | Substanciel |
| E | DRY Frontend | Moyen |
| F | Clean Code | Moyen |
| G | Tests | Substanciel |
| H | Performances | Moyen |

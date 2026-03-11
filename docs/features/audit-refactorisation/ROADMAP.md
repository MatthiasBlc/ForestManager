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

### A6 - Upload Security ✅

- [x] Verifier validation type MIME → OK (webp, jpeg, png via validateUploadedFile)
- [x] Verifier taille max → OK (2 MB verifie cote backend via headObject)
- [x] Verifier expiration des presigned URLs → OK (60 secondes)
- [x] ContentType force a image/webp dans le PutObjectCommand
- [x] Aucune correction necessaire

### A7 - Logging & Secrets ✅

- [x] Rechercher les logs de donnees sensibles → aucun (password/secret/token jamais loggues)
- [x] Verifier .gitignore pour .env → OK (.env et .env.\* ignores, sauf .env.example)
- [x] Verifier qu'en production les stack traces ne sont pas exposees → OK (error handler retourne { error: message } uniquement, stack loggue serveur-side via pino)
- [x] Aucune correction necessaire

---

## Phase B : NPM Audit & Dependencies

### B1 - Audit des dependances ✅

- [x] `npm audit` backend - 26 vulns (1 critical, 23 high) → toutes corrigees via `npm audit fix`
- [x] `npm audit` frontend - 3 vulns (2 high, 1 moderate) → toutes corrigees via `npm audit fix`
- [x] 0 vulnerabilites restantes (backend + frontend)
- [x] Principales corrections : fast-xml-parser (critical), express-rate-limit, minimatch, rollup, qs, ajv

### B2 - CI Integration ✅

- [x] Ajouter `npm audit --audit-level=high` dans GitHub Actions (backend + frontend)
- [x] Build echoue si vulnerabilite high+ detectee

---

## Phase C : Lint & Formatage

### C1 - Prettier ✅

- [x] Installer Prettier (racine du projet) → prettier 3.8.1
- [x] `.prettierrc` deja existant (semi, double quotes, tabWidth 2, trailing comma es5, printWidth 100)
- [x] Installer `eslint-config-prettier` (backend + frontend)
- [x] Creer `.prettierignore` (node_modules, dist, build, coverage, lockfiles, migrations)
- [x] Ajouter scripts `format` et `format:check` au root package.json
- [x] Formater tout le codebase + verifier format:check OK
- [x] Tests backend (802) + frontend (469) passent apres formatage

### C2 - ESLint strict ✅

- [x] Backend : ajouter `no-explicit-any` (warn), `no-console` (warn, avec exception scripts CLI)
- [x] Frontend : ajouter `no-explicit-any` (warn), `self-closing-comp` (warn)
- [x] Corriger 10 erreurs existantes (unused imports, useless escapes, unused vars)
- [x] Auto-fix 28 self-closing-comp warnings frontend
- [x] 0 errors, 0 warnings (backend + frontend)

### C3 - Pre-commit hooks ✅

- [x] Installer Husky 9 + lint-staged 15 (racine)
- [x] Configurer : Prettier sur fichiers stages (ESLint en CI uniquement, incompatible chemins Docker)
- [x] Tester le hook

### C4 - CI Lint ✅

- [x] Ajouter `npx eslint .` dans GitHub Actions (backend + frontend jobs)
- [x] Ajouter job `format-check` avec `npx prettier --check .` dans GitHub Actions

---

## Phase D : DRY Backend

### D1 - Error Codes centralises ✅

- [x] Creer `constants/errorCodes.ts` avec tous les codes existants (~90 constantes)
- [x] Migrer tous les controllers, middleware et services (32 fichiers)
- [x] 1 seul string literal restant volontairement (COMMUNITY_001 message different selon contexte)

### D2 - Rate Limiter Factory ✅

- [x] Creer `config/rateLimiter.ts` avec factory `createRateLimiter()` (bypass auto en test)
- [x] Remplacer les 3 definitions existantes (authRateLimiter, adminRateLimiter, adminAuthLimiter)
- [x] 802 tests passent

### D3 - Extraction config app.ts ✅

- [x] Extraire session config dans `config/session.ts`
- [x] Extraire error handler dans `middleware/errorHandler.ts`
- [x] Verifier que app.ts est lisible (~82 lignes, 50 sans imports)

### D4 - Zod : Phase 1 (fondations) ✅

- [x] Installer Zod (v4.3.6)
- [x] Creer le middleware `validateBody`
- [x] Creer `schemas/common.schema.ts` (pagination, uuid)
- [x] Creer `schemas/auth.schema.ts` (signup, login)
- [x] Migrer auth controllers vers Zod
- [x] Tests : 802/802 passent

### D5 - Zod : Phase 2 (recipes) ✅

- [x] Creer `schemas/recipe.schema.ts` (create + update)
- [x] Migrer recipe create/update controllers (recipes.ts + communityRecipes.ts)
- [x] Creer `schemas/proposal.schema.ts`
- [x] Migrer proposal controller (createProposal)
- [x] Tests : 802/802 passent

### D6a - Zod : User + Community ✅

- [x] Creer `schemas/user.schema.ts` (updateProfile)
- [x] Creer `schemas/community.schema.ts` (create, update)
- [x] Migrer `controllers/users.ts` et `controllers/communities.ts`
- [x] Tests (Docker requis)

### D6b - Zod : Invites + Members + Share ✅

- [x] Creer `schemas/invite.schema.ts` (createInvite)
- [x] Creer `schemas/member.schema.ts` (promoteMember)
- [x] Creer `schemas/recipeShare.schema.ts` (share, publish)
- [x] Migrer `controllers/invites.ts`, `controllers/members.ts`, `controllers/recipeShare.ts`
- [x] Tests (Docker requis)

### D6c - Zod : Tags + Notifications ✅

- [x] Creer `schemas/tag.schema.ts` (tagSuggestion, communityTag, tagPreference)
- [x] Creer `schemas/notification.schema.ts` (markBatch, markAll, updatePreference)
- [x] Migrer `controllers/tagSuggestions.ts`, `controllers/communityTags.ts`, `controllers/tagPreferences.ts`, `controllers/notifications.ts`
- [x] Tests (Docker requis)

### D6d - Zod : Import + Admin auth ✅

- [x] Creer `schemas/recipeImport.schema.ts` (importUrl)
- [x] Creer `admin/schemas/auth.schema.ts` (login, verifyTotp)
- [x] Migrer `controllers/recipeImport.ts`, `admin/controllers/authController.ts`
- [x] Tests (Docker requis)

### D6e - Zod : Admin CRUD simple ✅

- [x] Creer `admin/schemas/tag.schema.ts` (create, update, merge)
- [x] Creer `admin/schemas/community.schema.ts` (update)
- [x] Creer `admin/schemas/feature.schema.ts` (create, update)
- [x] Migrer `admin/controllers/tagsController.ts`, `admin/controllers/communitiesController.ts`, `admin/controllers/featuresController.ts`
- [x] Tests (Docker requis)

### D6f - Zod : Admin CRUD complexe ✅

- [x] Creer `admin/schemas/recipe.schema.ts` (update)
- [x] Creer `admin/schemas/ingredient.schema.ts` (create, update, approve, reject, merge)
- [x] Creer `admin/schemas/unit.schema.ts` (create, update)
- [x] Migrer `admin/controllers/recipesController.ts`, `admin/controllers/ingredientsController.ts`, `admin/controllers/unitsController.ts`
- [x] Tests (Docker requis)

### D6g - Zod : Nettoyage

- [ ] Supprimer les assertions devenues inutiles dans `validation.ts`
- [ ] Garder les constantes et regex dans `validation.ts` (reutilisees dans les schemas)

---

## Interlude

- [ ] A l'image de D6, Si d'autres taches de la roadmap sont trop conséquentes, décompose les en sous-taches

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

| Phase | Chantier          | Estimation  |
| ----- | ----------------- | ----------- |
| A     | Securite          | Substanciel |
| B     | NPM Audit         | Rapide      |
| C     | Lint & Formatage  | Rapide      |
| D     | DRY Backend + Zod | Substanciel |
| E     | DRY Frontend      | Moyen       |
| F     | Clean Code        | Moyen       |
| G     | Tests             | Substanciel |
| H     | Performances      | Moyen       |

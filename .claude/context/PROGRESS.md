# Avancement du projet

## Phases completees

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Setup & Infrastructure | DONE |
| 0.5 | SuperAdmin & Briques (2FA, Features, Admin API, Frontend admin) | DONE |
| 1 | Auth user (signup/login/logout, frontend auth, layout) | DONE |
| 2 | Catalogue personnel (CRUD recettes, autocomplete tags/ingredients, frontend) | DONE |
| 3.1 | Communities CRUD backend | DONE |
| 3.2 | Invitations backend | DONE |
| 3.3 | Members backend (list, promote, kick, leave) | DONE |
| 3.4 | Frontend Communities (pages, composants, sidebar Discord-style) | DONE |
| 3.5 | Frontend Invitations (pages, composants, notifications) | DONE |
| 3.6 | Frontend User Management (profil, menu, search) | DONE |
| 4.1 | Backend Recettes Communautaires (CRUD, copie perso, tests) | DONE |
| 4.2 | Frontend Recettes Communautaires (liste, creation, detail, permissions) | DONE |
| 5.1 | Backend Proposals (create, list, detail, accept, reject) | DONE |
| 5.2 | Backend Variants (list variants endpoint) | DONE |
| 5.3 | Frontend Proposals (modal, list, variants dropdown, RecipeDetailPage) | DONE |
| 5.4 | Backend Orphan Handling (auto-reject proposals on leave/kick) | DONE |
| 6.1 | Backend Activity Feed (community + personal endpoints) | DONE |
| 6.2 | Frontend Activity Feed (component, integration) | DONE |

## Phase en cours

**Phase 6 COMPLETE** - Activity Feed

### 6.1 Backend Activity - DONE
- [x] Controller `controllers/activity.ts` (getCommunityActivity, getMyActivity)
- [x] Route GET /api/communities/:communityId/activity (memberOf, paginated)
- [x] Route GET /api/users/me/activity (personal feed, paginated)
- [x] Tests `activity.test.ts` (15 tests)

### 6.2 Frontend Activity - DONE
- [x] Composant ActivityFeed avec icones par type
- [x] Integration dans page communaute (onglet Activity)
- [x] Section feed personnel sur Dashboard
- [x] Formatage des evenements (16 types supportes)
- [x] Liens vers recettes et communautes
- [x] Tests `ActivityFeed.test.tsx` (8 tests)

Prochaine etape: Phase 7 - Partage Inter-Communautes.

## Prochaines phases

| Phase | Description | Prerequis |
|-------|-------------|-----------|
| 5 | Propositions & Variantes (workflow accept/reject, forks) | Phase 4 |
| 6 | Activity Feed (communautaire + personnel) | Phase 5 |
| 7 | Partage inter-communautes (fork recettes) | Phase 3 |
| 8 | Finitions MVP (erreurs, loading, empty states) | Phases 4-7 |
| 9 | Post-MVP (analytics, notifications, PWA, admin pages) | Phase 8 |

## Maintenance technique en attente

- [ ] Fix 3 vulnerabilites npm "high severity"
- [ ] Migrer otplib v12 -> v13
- [ ] Mettre a jour ESLint (v8.57.1 deprecie)
- [ ] Migrer config Prisma vers prisma.config.ts (deprecie Prisma 7)
- [ ] Remplacer `npm prune --production` par `--omit=dev` dans Dockerfile

## Resume de reprise

Si une session precedente a ete interrompue, un fichier `.claude/context/RESUME.md` peut
contenir l'etat exact du travail en cours. Verifier son existence avant de demarrer.

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
| 7.1 | Backend Share (fork to other community, chain analytics) | DONE |
| 7.2 | Frontend Share (modal, badge "Shared from X") | DONE |
| 7.3 | Pre-Phase 8 corrections (13 fixes: bugs, UX, sync, side panel, publish) | DONE |

## Phase en cours

**Phase 8** - Finitions MVP

### 8.1 - A FAIRE
- [ ] Gestion erreurs globale (toast notifications, error boundaries)
- [ ] Loading states coherents
- [ ] Empty states (pas de recettes, pas de communautes, etc.)
- [ ] Validation formulaires cote client
- [ ] Messages d'erreur user-friendly

## Prochaines phases

| Phase | Description | Prerequis |
|-------|-------------|-----------|
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

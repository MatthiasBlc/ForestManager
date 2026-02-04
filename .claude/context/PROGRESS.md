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

## Detail Phase 3.4-3.6 (COMPLETE)

### 3.4 Frontend Communities
- [x] Page liste communautes (CommunitiesPage)
- [x] Page creation communaute (CommunityCreatePage)
- [x] Page detail communaute avec onglets (CommunityDetailPage)
- [x] Page edition communaute MODERATOR only (CommunityEditPage)
- [x] Composant CommunityCard
- [x] Composant MembersList (promotion, retrait, leave)
- [x] Dashboard page (communautes + recettes, page d'accueil)
- [x] Sidebar Discord-style avec avatars communautes (initiales)
- [x] Fix leave community (gestion 410, redirect, confirmation explicite)
- [x] Seed representatif (5 users, 3 communautes, 17 tags, 36 ingredients, 11 recettes)

### 3.5 Frontend Invitations
- [x] Page invitations recues (InvitationsPage)
- [x] Dropdown notifications dans navbar (NotificationDropdown)
- [x] Carte invitation avec Accept/Reject + redirect (InviteCard)
- [x] Modal invitation avec autocomplete username (InviteUserModal)
- [x] Liste invitations envoyees (SentInvitesList)

### 3.6 Frontend User Management
- [x] User menu dropdown (icone profil, navbar)
- [x] Page profil (modification username, email, mot de passe)
- [x] Backend PATCH /api/users/me
- [x] Backend GET /api/users/search (autocomplete usernames)

### Tests Phase 3 Frontend
- [x] CommunitiesPage.test.tsx (7 tests)
- [x] CommunityDetailPage.test.tsx (8 tests)
- [x] InviteCard.test.tsx (5 tests)
- [x] MembersList.test.tsx (6 tests)
- [x] InviteUserModal.test.tsx (5 tests)
- [x] MSW handlers pour communities, members, invitations

## Prochaines phases

| Phase | Description | Prerequis |
|-------|-------------|-----------|
| 4 | Recettes communautaires (POST dans communaute, copie perso) | Phase 3 |
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

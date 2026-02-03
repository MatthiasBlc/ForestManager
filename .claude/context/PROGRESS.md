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

## En cours

**Phase 3.4-3.5**: Frontend Communities & Invitations

### 3.4 Frontend Communities (A FAIRE)
- [ ] Page liste mes communautes
- [ ] Page creation communaute
- [ ] Page detail communaute (onglets: Recettes, Membres, Invitations, Activite)
- [ ] Composant MembersList (promotion, retrait)
- [ ] Bouton quitter

### 3.5 Frontend Invitations (A FAIRE)
- [ ] Page/Section invitations recues
- [ ] Badge notification nouvelles invitations
- [ ] Carte invitation (Accepter/Refuser)
- [ ] Modal recherche utilisateur pour inviter
- [ ] Liste invitations envoyees (onglet admin communaute)
- [ ] Bouton annuler invitation

### Tests Phase 3 Frontend (A FAIRE)
- [ ] CommunitiesPage.test.tsx (~6 tests)
- [ ] CommunityDetailPage.test.tsx (~8 tests)
- [ ] InvitationsSection.test.tsx (~8 tests)
- [ ] MembersList.test.tsx (~8 tests)

## Prochaines phases

| Phase | Description | Prerequis |
|-------|-------------|-----------|
| 4 | Recettes communautaires (POST dans communaute, copie perso) | Phase 3 |
| 5 | Propositions & Variantes (workflow accept/reject, forks) | Phase 4 |
| 6 | Activity Feed (communautaire + personnel) | Phase 5 |
| 7 | Partage inter-communautes (fork recettes) | Phase 3 |
| 8 | Finitions MVP (erreurs, loading, empty states) | Phases 4-7 |
| 9 | Post-MVP (analytics, notifications, PWA, admin pages) | Phase 8 |

## Fichiers non commites (travail en cours)

- `backend/src/controllers/members.ts` - NEW: controleur membres
- `backend/src/__tests__/integration/members.test.ts` - NEW: 22 tests membres
- `backend/src/routes/communities.ts` - MODIFIED: routes membres/invites
- `docs/DEVELOPMENT_ROADMAP.md` - MODIFIED: mise a jour avancement
- `.claude/CLAUDE.md` - MODIFIED: restructuration contexte
- `.claude/context/` - NEW: fichiers de contexte (PROGRESS, TESTS, API_MAP, DB_MODELS, FILE_MAP)

## Maintenance technique en attente

- [ ] Fix 3 vulnerabilites npm "high severity"
- [ ] Migrer otplib v12 → v13
- [ ] Mettre a jour ESLint (v8.57.1 deprecie)
- [ ] Migrer config Prisma vers prisma.config.ts (deprecie Prisma 7)
- [ ] Remplacer `npm prune --production` par `--omit=dev` dans Dockerfile

## Resume de reprise

Si une session precedente a ete interrompue, un fichier `.claude/context/RESUME.md` peut
contenir l'etat exact du travail en cours. Verifier son existence avant de demarrer.

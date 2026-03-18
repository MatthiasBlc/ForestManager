# Roadmap : Changelog Automatique

Spec : `docs/features/changelog/SPEC_CHANGELOG.md`

---

## Phase 1 — Modele de donnees & migration ✅

- [x] Ajouter l'enum `CHANGELOG_CREATED | CHANGELOG_UPDATED | CHANGELOG_DELETED` a `AdminActionType`
- [x] Creer le modele `ChangelogEntry` dans `schema.prisma`
- [x] Generer et appliquer la migration Prisma
- [x] Ajouter l'upsert `v1.0.0` dans le seed (idempotent, par version)
- [x] Verifier que le seed passe sans erreur

---

## Phase 2 — Backend API (Admin) ✅

- [x] Creer `admin/controllers/changelogController.ts`
- [x] Creer `admin/routes/changelogRoutes.ts`
- [x] `GET /api/admin/changelog` — liste paginee (includeDeleted optionnel)
- [x] `POST /api/admin/changelog` — creation manuelle (requireSuperAdmin)
- [x] `PATCH /api/admin/changelog/:id` — modification (title, content, version, publishedAt)
- [x] `DELETE /api/admin/changelog/:id` — soft delete
- [x] Validation : version semver, content JSON structure, title 1-200 chars
- [x] Audit log (`CHANGELOG_CREATED`, `CHANGELOG_UPDATED`, `CHANGELOG_DELETED`)
- [x] Codes erreur : CHANGELOG_001 a CHANGELOG_004
- [x] Tests integration admin CRUD (17 tests)

---

## Phase 3 — Backend API (User) ✅

- [x] Creer `controllers/changelog.ts`
- [x] Creer `routes/changelog.ts`
- [x] `GET /api/changelog` — liste paginee (requireAuth, deletedAt: null)
- [x] `GET /api/changelog/:id` — detail (requireAuth, deletedAt: null)
- [x] Brancher les routes dans `app.ts`
- [x] Tests integration user endpoints (7 tests)

---

## Phase 4 — Script de generation & script d'insertion ✅

- [x] Creer `scripts/generate-changelog.js` (JS pur, tourne dans le CI)
  - [x] Parser conventional commits (regex)
  - [x] Filtrer : exclure test/docs/ci/build/chore (sauf chore(deps))
  - [x] Exclure merge commits
  - [x] Categoriser : feat → features, fix → fixes, refactor/perf/style → improvements
  - [x] Calculer la prochaine version semver depuis le dernier tag
  - [x] Generer le titre auto (ex: "2 nouveautes et 3 corrections")
  - [x] Sortie JSON sur stdout, exit code 2 si rien a publier
- [x] Test du script en local (avec des commits de test)
- [x] Creer `backend/src/scripts/insertChangelog.ts` (compile dans dist/, tourne dans le container)
  - [x] Recoit JSON changelog en argument
  - [x] Validation : version semver, content structure
  - [x] Insert en DB via Prisma (`changelogEntry.create`)
  - [x] Gestion conflit version (erreur si doublon)
  - [x] Compile dans dist/scripts/insertChangelog.js (rootDir + include ajoutes au tsconfig)

---

## Phase 5 — Job CI (generate-changelog via Portainer exec)

- [ ] Ajouter le job `generate-changelog` dans `deploy.yml`
  - [ ] `needs: [deploy-prod]`, uniquement si deploy reussi
  - [ ] Checkout avec `fetch-depth: 0`
  - [ ] Determiner le dernier tag `v*`
  - [ ] Executer `scripts/generate-changelog.ts` pour parser les commits
  - [ ] Skip si aucun commit user-facing
  - [ ] Trouver le container backend via API Portainer (filtre par nom)
  - [ ] Executer `scripts/insert-changelog.ts` dans le container via Portainer exec
  - [ ] Creer et pousser le tag git `vX.Y.Z`
- [ ] Aucun nouveau secret GitHub necessaire (reutilise PORTAINER_URL, PORTAINER_API, ENDPOINT_ID)

---

## Phase 6 — Frontend User (page changelog)

- [ ] Creer `pages/ChangelogPage.tsx`
  - [ ] Liste de cartes empilees, du plus recent au plus ancien
  - [ ] Badge version colore
  - [ ] Date relative + absolue
  - [ ] 3 categories avec icone/couleur : Nouveautes (vert), Ameliorations (bleu), Corrections (rouge)
  - [ ] Pagination classique
- [ ] Ajouter la route `/changelog` (requireAuth)
- [ ] Service API : `getChangelog(page, limit)`, `getChangelogEntry(id)`
- [ ] Modifier `Sidebar.tsx` :
  - [ ] Version dynamique (derniere version du changelog)
  - [ ] Texte version cliquable → lien `/changelog`
  - [ ] Mode compact : icone avec tooltip "Changelog"
- [ ] Tests composant ChangelogPage

---

## Phase 7 — Frontend Admin (page CRUD)

- [ ] Creer `pages/admin/AdminChangelogPage.tsx`
  - [ ] Table : Version, Titre, Date, Status, Actions
  - [ ] Bouton "Nouvelle entree"
  - [ ] Filtre afficher/masquer supprimees
- [ ] Modal creation/edition :
  - [ ] Champs : version (semver), titre, date publication
  - [ ] Editeur structure : 3 sections (Nouveautes, Ameliorations, Corrections)
  - [ ] Ajout/suppression d'items par section
  - [ ] Bouton sauvegarder avec confirmation
- [ ] Modal suppression avec confirmation
- [ ] Ajouter dans `AdminLayout.tsx` : nav item "Changelog" (icone `FaNewspaper`)
- [ ] Ajouter la route `/admin/changelog` dans `adminRoutes.tsx`
- [ ] Service API admin : CRUD changelog
- [ ] Tests composant AdminChangelogPage

---

## Phase 8 — Mise a jour docs & contexte

- [ ] Mettre a jour `API_MAP.md` (nouveaux endpoints)
- [ ] Mettre a jour `DB_MODELS.md` (nouveau modele + enum)
- [ ] Mettre a jour `FILE_MAP.md` (nouveaux fichiers)
- [ ] Mettre a jour `PROGRESS.md` (feature terminee)
- [ ] Mettre a jour `CLAUDE.md` si necessaire (codes erreur)
- [ ] Cocher toutes les taches de cette roadmap

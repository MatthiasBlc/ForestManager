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

## Phase 5 — Job CI (generate-changelog via Portainer exec) ✅

- [x] Ajouter le job `generate-changelog` dans `deploy.yml`
  - [x] `needs: [deploy-prod]`, uniquement si deploy reussi
  - [x] Checkout avec `fetch-depth: 0`
  - [x] Determiner le dernier tag `v*`
  - [x] Executer `scripts/generate-changelog.js` pour parser les commits
  - [x] Skip si aucun commit user-facing (exit code 2)
  - [x] Trouver le container backend via API Portainer (filtre par nom)
  - [x] Executer `dist/scripts/insertChangelog.js` dans le container via Portainer exec
  - [x] Verifier exit code de l'exec
  - [x] Creer et pousser le tag git `vX.Y.Z`
- [x] Aucun nouveau secret GitHub necessaire (reutilise PORTAINER_URL, PORTAINER_API, ENDPOINT_ID)

---

## Phase 6 — Frontend User (page changelog) ✅

- [x] Creer `pages/ChangelogPage.tsx`
  - [x] Liste de cartes empilees, du plus recent au plus ancien
  - [x] Badge version colore
  - [x] Date relative + absolue
  - [x] 3 categories avec icone/couleur : Nouveautes (vert), Ameliorations (bleu), Corrections (rouge)
  - [x] Pagination classique (load more)
- [x] Ajouter la route `/changelog` (requireAuth)
- [x] Service API : `getChangelog(limit, offset)`, `getChangelogEntry(id)`
- [x] Modifier `Sidebar.tsx` :
  - [x] Version dynamique (derniere version du changelog)
  - [x] Texte version cliquable → lien `/changelog`
  - [x] Mode compact : version avec tooltip "Changelog"
- [x] Tests composant ChangelogPage (6 tests)

---

## Phase 7 — Frontend Admin (page CRUD) ✅

- [x] Creer `pages/admin/AdminChangelogPage.tsx`
  - [x] Table : Version, Titre, Date, Status, Actions
  - [x] Bouton "Nouvelle entree"
  - [x] Filtre afficher/masquer supprimees
- [x] Modal creation/edition :
  - [x] Champs : version (semver), titre, date publication
  - [x] Editeur structure : 3 sections (Nouveautes, Ameliorations, Corrections)
  - [x] Ajout/suppression d'items par section
  - [x] Bouton sauvegarder avec confirmation
- [x] Modal suppression avec confirmation
- [x] Ajouter dans `AdminLayout.tsx` : nav item "Changelog" (icone `FaNewspaper`)
- [x] Ajouter la route `/admin/changelog` dans `adminRoutes.tsx`
- [x] Service API admin : CRUD changelog
- [x] Tests composant AdminChangelogPage (10 tests)

---

## Phase 8 — Mise a jour docs & contexte ✅

- [x] Mettre a jour `API_MAP.md` (nouveaux endpoints: 6 user + 4 admin)
- [x] Mettre a jour `DB_MODELS.md` (ChangelogEntry model + CHANGELOG\_\* enum values)
- [x] Mettre a jour `FILE_MAP.md` (nouveaux fichiers backend + frontend)
- [x] Mettre a jour `PROGRESS.md` (feature terminee)
- [x] Mettre a jour `TESTS.md` (24 backend + 16 frontend tests)
- [x] Mettre a jour `CLAUDE.md` (codes erreur CHANGELOG_001-004)
- [x] Cocher toutes les taches de cette roadmap

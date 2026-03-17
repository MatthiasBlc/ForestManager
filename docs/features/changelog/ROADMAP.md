# Roadmap : Changelog Automatique

Spec : `docs/features/changelog/SPEC_CHANGELOG.md`

---

## Phase 1 — Modele de donnees & migration

- [ ] Ajouter l'enum `CHANGELOG_CREATED | CHANGELOG_UPDATED | CHANGELOG_DELETED` a `AdminActionType`
- [ ] Creer le modele `ChangelogEntry` dans `schema.prisma`
- [ ] Generer et appliquer la migration Prisma
- [ ] Ajouter l'upsert `v1.0.0` dans le seed (idempotent, par version)
- [ ] Verifier que le seed passe sans erreur

---

## Phase 2 — Backend API (Admin)

- [ ] Creer `admin/controllers/changelogController.ts`
- [ ] Creer `admin/routes/changelogRoutes.ts`
- [ ] `GET /api/admin/changelog` — liste paginee (includeDeleted optionnel)
- [ ] `POST /api/admin/changelog` — creation manuelle (requireSuperAdmin)
- [ ] `PATCH /api/admin/changelog/:id` — modification (title, content, version, publishedAt)
- [ ] `DELETE /api/admin/changelog/:id` — soft delete
- [ ] Validation : version semver, content JSON structure, title 1-200 chars
- [ ] Audit log (`CHANGELOG_CREATED`, `CHANGELOG_UPDATED`, `CHANGELOG_DELETED`)
- [ ] Codes erreur : CHANGELOG_001 a CHANGELOG_005
- [ ] Tests unitaires admin CRUD

---

## Phase 3 — Backend API (User)

- [ ] Creer `controllers/changelog.ts`
- [ ] Creer `routes/changelog.ts`
- [ ] `GET /api/changelog` — liste paginee (requireAuth, deletedAt: null)
- [ ] `GET /api/changelog/:id` — detail (requireAuth, deletedAt: null)
- [ ] Brancher les routes dans `app.ts`
- [ ] Tests unitaires user endpoints

---

## Phase 4 — Endpoint CI & middleware API key

- [ ] Ajouter variable d'env `CHANGELOG_API_KEY` dans la config backend
- [ ] Creer middleware `verifyChangelogApiKey` (header `X-Changelog-Api-Key`)
- [ ] `POST /api/admin/changelog/generate` — endpoint dedie (API key auth, pas session)
- [ ] Validation identique au POST admin + champ optionnel `commitRange`
- [ ] Test unitaire : rejet sans API key, rejet mauvaise key, succes avec bonne key
- [ ] Ajouter `CHANGELOG_API_KEY` dans docker-compose.dev.yml / .env.example

---

## Phase 5 — Script de generation & job CI

- [ ] Creer `scripts/generate-changelog.ts` (executable Node.js)
  - [ ] Parser conventional commits (regex)
  - [ ] Filtrer : exclure test/docs/ci/build/chore (sauf chore(deps))
  - [ ] Exclure merge commits
  - [ ] Categoriser : feat → features, fix → fixes, refactor/perf/style → improvements
  - [ ] Calculer la prochaine version semver depuis le dernier tag
  - [ ] Generer le titre auto (ex: "2 nouveautes et 3 corrections")
  - [ ] Sortie JSON sur stdout
- [ ] Test du script en local (avec des commits de test)
- [ ] Ajouter le job `generate-changelog` dans `deploy.yml`
  - [ ] Checkout avec `fetch-depth: 0`
  - [ ] Determiner le dernier tag `v*`
  - [ ] Executer le script
  - [ ] POST vers l'API backend prod
  - [ ] Creer et pousser le tag git `vX.Y.Z`
  - [ ] Skip si aucun commit user-facing
- [ ] Ajouter les secrets GitHub : `CHANGELOG_API_KEY`, `APP_URL` (URL publique frontend, proxy vers backend)

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

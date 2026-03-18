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

## Phase 4 — Script de generation & script d'insertion

- [ ] Creer `scripts/generate-changelog.ts` (executable Node.js, tourne dans le CI)
  - [ ] Parser conventional commits (regex)
  - [ ] Filtrer : exclure test/docs/ci/build/chore (sauf chore(deps))
  - [ ] Exclure merge commits
  - [ ] Categoriser : feat → features, fix → fixes, refactor/perf/style → improvements
  - [ ] Calculer la prochaine version semver depuis le dernier tag
  - [ ] Generer le titre auto (ex: "2 nouveautes et 3 corrections")
  - [ ] Sortie JSON sur stdout
- [ ] Test du script en local (avec des commits de test)
- [ ] Creer `scripts/insert-changelog.ts` (tourne dans le container backend via Portainer exec)
  - [ ] Recoit JSON changelog en argument
  - [ ] Validation : version semver, content structure
  - [ ] Insert en DB via Prisma (`changelogEntry.create`)
  - [ ] Gestion conflit version (erreur si doublon)
  - [ ] S'assurer que le script est inclus dans le build Docker (Dockerfile backend)

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

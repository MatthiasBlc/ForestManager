# Roadmap : Tests E2E (Playwright)

> **Spec** : `docs/features/e2e-testing/SPEC_E2E_TESTING.md`

---

## Phase A — Setup Playwright

### A.1 - Installation et config

- [ ] Installer Playwright (`npm init playwright@latest` dans un dossier `e2e/`)
- [ ] Creer `playwright.config.ts` (baseURL localhost:3000, timeout 30s, retries 1 en CI)
- [ ] Ajouter scripts npm racine : `test:e2e`, `test:e2e:ui`, `test:e2e:debug`
- [ ] Ajouter `e2e/` au `.prettierrc` et ESLint config
- [ ] Verifier que `npx playwright test` tourne (test placeholder)

### A.2 - Fixtures et Page Objects

- [ ] Creer `e2e/fixtures/auth.fixture.ts` (login + storageState)
- [ ] Creer Page Objects de base :
  - `LoginPage.ts` (email, password, submit)
  - `SignUpPage.ts` (username, email, password, submit)
- [ ] Ajouter `data-testid` sur les elements critiques du frontend (boutons submit, inputs, liens nav)

### A.3 - Global setup/teardown

- [ ] Creer `e2e/global-setup.ts` (verifier que Docker est up, seed DB test)
- [ ] Creer `e2e/global-teardown.ts` (cleanup)
- [ ] Seed E2E minimal et deterministe (users de test, 1 communaute, 1 recette)

---

## Phase B — Flux Auth + Recettes

### B.1 - Tests auth

- [ ] `auth.spec.ts` : signup → redirect dashboard
- [ ] Login → session → refresh page → toujours connecte
- [ ] Logout → redirect home
- [ ] Acces page protegee sans auth → redirect login

### B.2 - Tests recettes

- [ ] Page Object `RecipeFormPage.ts`, `RecipeDetailPage.ts`, `RecipesPage.ts`
- [ ] `recipes.spec.ts` : creer recette (titre, 2 etapes, 1 ingredient) → voir dans la liste
- [ ] Voir detail recette → verifier contenu
- [ ] Editer recette (modifier titre) → verifier mise a jour
- [ ] Supprimer recette → disparait de la liste

---

## Phase C — Flux Communautes + Partage

### C.1 - Tests communautes

- [ ] Page Object `CommunityPage.ts`, `CommunityCreatePage.ts`
- [ ] `communities.spec.ts` : creer communaute → visible dans la liste
- [ ] Inviter un membre (2e user) → accepter → membre visible

### C.2 - Tests partage

- [ ] `sharing.spec.ts` : publier recette perso vers communaute → visible dans recettes communaute
- [ ] Forker recette vers autre communaute

### C.3 - Tests propositions

- [ ] `proposals.spec.ts` : membre propose modification → owner voit la proposition
- [ ] Owner accepte → recette mise a jour
- [ ] Owner rejette → variante creee

---

## Phase D — Flux Import + Upload

### D.1 - Tests import

- [ ] `import.spec.ts` : ouvrir modale import → coller texte brut → analyser → formulaire pre-rempli
- [ ] Sauvegarder la recette importee → verifier en detail

### D.2 - Tests upload

- [ ] `upload.spec.ts` : uploader image sur recette → image affichee
- [ ] Remplacer image → nouvelle image affichee
- [ ] Supprimer image → placeholder affiche

---

## Phase E — CI Integration

### E.1 - GitHub Actions

- [ ] Ajouter job `e2e` dans `.github/workflows/deploy.yml`
- [ ] Docker Compose up complet (backend, frontend, postgres, minio)
- [ ] Wait-on health checks (backend /health, frontend /)
- [ ] `npx playwright test` headless
- [ ] Upload artifacts (traces, screenshots) en cas d'echec

### E.2 - Optimisation

- [ ] Evaluer sharding (2 workers) si temps > 3 min
- [ ] Evaluer si le job doit etre bloquant ou informatif (allow-failure)

---

## Resume

| Phase | Scope                 | Dependances |
| ----- | --------------------- | ----------- |
| **A** | Setup Playwright      | Aucune      |
| **B** | Auth + Recettes       | A           |
| **C** | Communautes + Partage | B           |
| **D** | Import + Upload       | B           |
| **E** | CI                    | B+C+D       |

Phases C et D sont independantes et peuvent etre developpees en parallele.

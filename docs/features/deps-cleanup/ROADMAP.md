# Roadmap : Nettoyage des dependances

Spec : `docs/features/deps-cleanup/SPEC_DEPS_CLEANUP.md`

Ordre choisi : du plus simple/sans risque au plus consequent.

---

## Phase 1 — Suppression des packages completement inutilises

Risque : zero. Aucun code a modifier.

- [ ] Desinstaller `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
  - `npm uninstall @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` dans le container frontend
  - Verifier qu'aucun import residuel n'existe (`grep -r dnd-kit src/`)
- [ ] Verifier que les tests frontend passent
- [ ] Verifier que le build frontend passe (`npm run build`)

---

## Phase 2 — Suppression `classnames`

Risque : faible. 1 fichier impacte.

- [ ] Creer `src/utils/cn.ts` avec la fonction utilitaire (ou remplacer inline si trivial)
- [ ] Mettre a jour `src/components/Modal.tsx` — remplacer l'import et l'appel
- [ ] Desinstaller `classnames` dans le container frontend
- [ ] Verifier que les tests frontend passent

---

## Phase 3 — Suppression `usehooks-ts`

Risque : faible. 1 fichier impacte.

- [ ] Creer `src/hooks/useOnClickOutside.ts` (implementation native `mousedown`/`touchstart`)
- [ ] Mettre a jour `src/components/Modal.tsx` — remplacer l'import
- [ ] Desinstaller `usehooks-ts` dans le container frontend
- [ ] Tester manuellement le comportement du modal (fermeture au clic exterieur)
- [ ] Verifier que les tests frontend passent

---

## Phase 4 — Backend : deplacement `@types/helmet` + suppression `read`

Risque : faible. Changements isoles.

- [ ] Verifier si `helmet` embarque ses propres types (`npm info helmet` ou `ls node_modules/helmet/dist/*.d.ts`)
  - Si oui : supprimer `@types/helmet` completement
  - Si non : deplacer dans `devDependencies`
- [ ] Reediter `src/scripts/createAdmin.ts` — remplacer `read` par `readline` stdlib
  - Reimplementer `ask(prompt)` et `ask(prompt, silent: true)` avec `readline`
  - Tester manuellement le script (`npx ts-node src/scripts/createAdmin.ts`)
- [ ] Desinstaller `read` dans le container backend
- [ ] Verifier que les tests backend passent

---

## Phase 5 — Backend : remplacement `envalid` → `zod`

Risque : faible. 1 fichier impacte, Zod deja present.

- [ ] Reediter `src/util/validateEnv.ts` — remplacer `cleanEnv` par `z.object().parse()`
  - Reproduire exactement les memes variables et types
  - Verifier que les messages d'erreur en cas de variable manquante sont clairs
- [ ] Desinstaller `envalid` dans le container backend
- [ ] Redemarrer le backend, verifier le demarrage (`npm run docker:logs`)
- [ ] Verifier que les tests backend passent

---

## Phase 6 — Frontend : remplacement `axios` → `fetch` natif

Risque : moyen. Changement du client HTTP central, impacte tous les appels API.

- [ ] Creer le nouveau `src/network/apiClient.ts` base sur `fetch`
  - Fonction `apiFetch(path, options?)` avec `credentials: "include"`, baseURL, Content-Type, CSRF
  - Classe `ApiError` avec `status` et `message`
  - Reimplementer `handleApiError` et `handleApiErrorWith` avec la meme signature externe
- [ ] Mettre a jour `src/network/api.ts`
  - Remplacer tous les appels `API.get/post/patch/delete` par `apiFetch`
  - Remplacer les types `AxiosError` par `ApiError`
- [ ] Desinstaller `axios` dans le container frontend
- [ ] Verifier que les tests frontend passent (MSW supporte fetch natif)
- [ ] **Tester manuellement les flux critiques** :
  - [ ] Login / logout
  - [ ] Chargement des recettes
  - [ ] Creation / edition de recette
  - [ ] Upload d'image (presigned URL)
  - [ ] Flux CSRF (verifier que le header `X-XSRF-TOKEN` est bien envoye)
  - [ ] Gestion des erreurs 401 (redirect logout) et 409 (conflict)

---

## Phase 7 — Mise a jour docs & contexte

- [ ] Mettre a jour `CLAUDE.md` si necessaire
- [ ] Mettre a jour `docs/features/deps-cleanup/ROADMAP.md` (cocher les taches)
- [ ] Mettre a jour `.claude/context/PROGRESS.md`

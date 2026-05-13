# Roadmap : Nettoyage des dependances

Spec : `docs/features/deps-cleanup/SPEC_DEPS_CLEANUP.md`

Ordre choisi : du plus simple/sans risque au plus consequent.

---

## Phase 1 — Suppression `classnames`

Risque : faible. 1 fichier impacte.

- [ ] Creer `src/utils/cn.ts` avec la fonction utilitaire (ou remplacer inline si trivial)
- [ ] Mettre a jour `src/components/Modal.tsx` — remplacer l'import et l'appel
- [ ] Desinstaller `classnames` dans le container frontend
- [ ] Verifier que les tests frontend passent

---

## Phase 2 — Suppression `usehooks-ts`

Risque : faible. 1 fichier impacte.

Note : `src/hooks/useClickOutside.ts` existe deja dans le projet avec ses propres tests.
Brancher `Modal.tsx` dessus est suffisant. La seule difference : `touchstart` n'est pas couvert
par ce hook ni par les tests existants — comportement identique a l'actuel en production
(usehooks-ts gerait touchstart, le hook interne non). A documenter.

- [ ] Mettre a jour `src/components/Modal.tsx` — remplacer l'import `usehooks-ts` par `useClickOutside`
- [ ] Desinstaller `usehooks-ts` dans le container frontend
- [ ] Verifier que les tests frontend passent

---

## Phase 3 — Backend : deplacement `@types/helmet` + suppression `read`

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

## Phase 4 — Backend : remplacement `envalid` → `zod`

Risque : faible. 1 fichier impacte, Zod deja present.

- [ ] Reediter `src/util/validateEnv.ts` — remplacer `cleanEnv` par `z.object().parse()`
  - Reproduire exactement les memes variables et types
  - Verifier que les messages d'erreur en cas de variable manquante sont clairs
- [ ] Desinstaller `envalid` dans le container backend
- [ ] Redemarrer le backend, verifier le demarrage (`npm run docker:logs`)
- [ ] Verifier que les tests backend passent

---

## Phase 5 — Tests manquants avant remplacement axios

Prerequis obligatoire avant Phase 6. Ces tests doivent passer avec axios, puis continuer
a passer apres le remplacement par fetch — c'est le filet de securite.

### 5a — Tests unitaires `apiClient`

Fichier : `src/__tests__/unit/network/apiClient.test.ts`

- [ ] `apiFetch` envoie bien `credentials: "include"` sur chaque requete
- [ ] `apiFetch` prefixe l'URL avec `VITE_BACKEND_URL`
- [ ] `apiFetch` envoie le header `Content-Type: application/json`
- [ ] `apiFetch` lit le cookie `XSRF-TOKEN` et l'injecte dans `X-XSRF-TOKEN`
- [ ] `apiFetch` ne plante pas si le cookie `XSRF-TOKEN` est absent
- [ ] `apiFetch` leve une erreur sur status >= 400 (avec `status` et `message` corrects)
- [ ] `apiFetch` retourne le body parse en JSON sur status 2xx

### 5b — Tests unitaires `handleApiError` / `handleApiErrorWith`

Fichier : `src/__tests__/unit/network/apiClient.test.ts` (meme fichier)

- [ ] `handleApiError` leve `UnauthorizedError` sur 401
- [ ] `handleApiError` leve `ConflictError` sur 409
- [ ] `handleApiError` leve une `Error` generique sur autre status (avec le message du body)
- [ ] `handleApiError` leve `Error("Network error...")` si pas de response
- [ ] `handleApiErrorWith` applique l'override sur le status specifie
- [ ] `handleApiErrorWith` tombe en fallback sur `handleApiError` si status non override

---

## Phase 6 — Frontend : remplacement `axios` → `fetch` natif

Risque : moyen. Changement du client HTTP central, impacte tous les appels API.
Prerequis : Phase 5 completement verte.

- [ ] Creer le nouveau `src/network/apiClient.ts` base sur `fetch`
  - Fonction `apiFetch(path, options?)` avec `credentials: "include"`, baseURL, Content-Type, CSRF
  - Classe `ApiError` avec `status` et `message`
  - Reimplementer `handleApiError` et `handleApiErrorWith` avec la meme signature externe
- [ ] Mettre a jour `src/network/api.ts`
  - Remplacer tous les appels `API.get/post/patch/delete` par `apiFetch`
  - Remplacer les types `AxiosError` par `ApiError`
- [ ] Desinstaller `axios` dans le container frontend
- [ ] Verifier que les tests frontend passent (MSW supporte fetch natif, aucune modification des tests requise)
- [ ] **Tester manuellement les flux critiques** :
  - [ ] Login / logout
  - [ ] Chargement des recettes
  - [ ] Creation / edition de recette
  - [ ] Upload d'image (presigned URL)
  - [ ] Flux CSRF (verifier dans les DevTools que le header `X-XSRF-TOKEN` est bien envoye)
  - [ ] Gestion des erreurs 401 (redirect logout) et 409 (conflict)

---

## Phase 7 — Mise a jour docs & contexte

- [ ] Mettre a jour `CLAUDE.md` si necessaire
- [ ] Mettre a jour `docs/features/deps-cleanup/ROADMAP.md` (cocher les taches)
- [ ] Mettre a jour `.claude/context/PROGRESS.md`

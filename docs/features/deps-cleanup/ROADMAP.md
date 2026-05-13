# Roadmap : Nettoyage des dependances

Spec : `docs/features/deps-cleanup/SPEC_DEPS_CLEANUP.md`

Ordre choisi : du plus simple/sans risque au plus consequent.

---

## Phase 1 — Suppression `classnames`

Risque : faible. 1 fichier impacte.

Attention : l'usage est avec l'API objet (`cn({ "classe": true })`), pas avec des strings.
Pas besoin d'utilitaire — remplacer par des strings/template literals directement.

- [x] Mettre a jour `src/components/Modal.tsx` :
  - Remplacer `cn({ "modal modal-bottom sm:modal-middle": true, "modal-open": true })` par la string constante `"modal modal-bottom sm:modal-middle modal-open"`
  - Remplacer `cn("modal-box", className)` par `` `modal-box${className ? ` ${className}` : ""}` ``
  - Supprimer l'import `classnames`
- [x] Desinstaller `classnames` dans le container frontend
- [x] Verifier que les tests frontend passent (le test "should have modal-open class" valide le rendu)

---

## Phase 2 — Suppression `usehooks-ts`

Risque : faible. 1 fichier impacte.

`src/hooks/useClickOutside.ts` existe deja mais n'ecoute que `mousedown`.
`usehooks-ts` ecoutait aussi `touchstart` — regression mobile si on branche sans enrichir.
Enrichir le hook existant et ajouter un test `touchstart` avant de modifier Modal.

- [x] Ajouter `touchstart` dans `src/hooks/useClickOutside.ts` (en plus de `mousedown` existant)
- [x] Ajouter un test `touchstart` dans `useClickOutside.test.ts` :
  - "should call callback when touching outside the ref element" (`TouchEvent` / `fireEvent.touchStart`)
  - "should not call callback when touching inside the ref element"
- [x] Mettre a jour `src/components/Modal.tsx` — remplacer l'import `usehooks-ts` par `useClickOutside`
- [x] Desinstaller `usehooks-ts` dans le container frontend
- [x] Verifier que les tests frontend passent

---

## Phase 3 — Backend : deplacement `@types/helmet` + suppression `read`

Risque : faible. Changements isoles.

- [x] Verifier si `helmet` embarque ses propres types (`npm info helmet` ou `ls node_modules/helmet/dist/*.d.ts`)
  - Si oui : supprimer `@types/helmet` completement
  - Si non : deplacer dans `devDependencies`
- [x] Reediter `src/scripts/createAdmin.ts` — remplacer `read` par `readline` stdlib
  - Reimplementer `ask(prompt)` et `ask(prompt, silent: true)` avec `readline`
  - Tester manuellement le script (`npx ts-node src/scripts/createAdmin.ts`)
- [x] Desinstaller `read` dans le container backend
- [x] Verifier que les tests backend passent

---

## Phase 4 — Backend : remplacement `envalid` → `zod`

Risque : faible. 1 fichier impacte, Zod deja present.

- [x] Reediter `src/util/validateEnv.ts` — remplacer `cleanEnv` par `z.object().parse()`
  - Reproduire exactement les memes variables et types
  - Verifier que les messages d'erreur en cas de variable manquante sont clairs
- [x] Desinstaller `envalid` dans le container backend
- [ ] Redemarrer le backend, verifier le demarrage (`npm run docker:logs`)
- [x] Verifier que les tests backend passent

---

## Phase 5 — Tests manquants avant remplacement axios

Prerequis obligatoire avant Phase 6. Ces tests doivent passer avec axios, puis continuer
a passer apres le remplacement par fetch — c'est le filet de securite.

### 5a — Tests unitaires `apiClient`

Fichier : `src/__tests__/unit/network/apiClient.test.ts`

- [x] `apiFetch` envoie bien `credentials: "include"` sur chaque requete
- [x] `apiFetch` prefixe l'URL avec `VITE_BACKEND_URL`
- [x] `apiFetch` envoie le header `Content-Type: application/json`
- [x] `apiFetch` lit le cookie `XSRF-TOKEN` et l'injecte dans `X-XSRF-TOKEN`
- [x] `apiFetch` ne plante pas si le cookie `XSRF-TOKEN` est absent
- [x] `apiFetch` leve une `ApiError` sur status >= 400 (avec `status` et `message` corrects)
- [x] `apiFetch` retourne `{ data }` parse en JSON sur status 2xx
- [x] `apiFetch` retourne `{ data: undefined }` sur status 204 sans appeler `.json()`

### 5b — Tests unitaires `handleApiError` / `handleApiErrorWith`

Fichier : `src/__tests__/unit/network/apiClient.test.ts` (meme fichier)

- [x] `handleApiError` leve `UnauthorizedError` sur 401
- [x] `handleApiError` leve `ConflictError` sur 409
- [x] `handleApiError` leve une `Error` generique sur autre status (avec le message du body)
- [x] `handleApiError` leve `Error("Network error...")` si pas de response
- [x] `handleApiErrorWith` applique l'override sur le status specifie
- [x] `handleApiErrorWith` tombe en fallback sur `handleApiError` si status non override

### 5c — Test du cas special 410 dans `removeMember`

Fichier : `src/__tests__/unit/network/apiClient.test.ts` ou test dedie

- [x] Le handler inline de `removeMember` retourne correctement sur status 410 (sans lever d'erreur)

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

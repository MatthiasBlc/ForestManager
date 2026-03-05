# Roadmap : Input Validation & Security Hardening

> **Spec** : `docs/features/input-validation-security/SPEC_INPUT_VALIDATION.md`
> **Branche** : `Developement`

---

## Phase A — Fondations (utilitaires + middleware)

### A.1 - Middleware validation UUID

- [x] Creer `backend/src/middleware/validateUUID.ts`
  - Regex UUID v4
  - Retourne 400 `{ error: "Invalid UUID format", code: "VALIDATION_001" }`
- [x] Appliquer le middleware sur toutes les routes avec `:id`, `:communityId`, `:recipeId`, `:proposalId`, `:tagId`, `:inviteId`, `:ingredientId`, `:unitId`
- [x] Verifier que les tests existants passent toujours

### A.2 - Enrichir validation.ts (constantes + type guards + helpers)

- [x] Ajouter constantes maxLength :
  - `MAX_USERNAME_LENGTH = 30`
  - `MAX_PASSWORD_LENGTH = 128`
  - `MAX_TITLE_LENGTH = 200`
  - `MAX_NAME_LENGTH = 100`
  - `MAX_REASON_LENGTH = 500`
  - `MAX_URL_LENGTH = 2048`
  - `MAX_FILTER_ITEMS = 20`
  - `MAX_TAGS_PER_RECIPE = 10` (deja existant, a reutiliser)
- [x] Ajouter type guards :
  - `assertString(value, fieldName)` → throw ValidationError si pas string
  - `assertOptionalString(value, fieldName)` → null/undefined OK, sinon doit etre string
  - `assertArray(value, fieldName)` → throw si pas array
  - `assertNumber(value, fieldName)` → throw si pas number ou NaN/Infinity
  - `assertOptionalNumber(value, fieldName)` → null/undefined OK
- [x] Ajouter `validateQuantity(val)` : null OK, sinon > 0, <= 99999, isFinite, isNumber
- [x] Ajouter `validateStringLength(val, field, min, max)` : centralise les checks min/max
- [x] Creer classe `ValidationError` (ou reutiliser le pattern existant) pour retourner 400

### A.3 - Error handler : catch ValidationError → 400

- [x] Mettre a jour le global error handler pour catcher `ValidationError` et retourner 400
- [x] Verifier qu'aucun autre type d'erreur n'est accidentellement converti en 400

---

## Phase B — Backend : controllers User/Auth (fix H1, M4, M7, M8, L2)

### B.1 - auth.ts : signup + login

- [x] `signup` : assertString sur username, email, password
- [x] `signup` : validateStringLength password (8, 128)
- [x] `signup` : validateStringLength username (3, 30)
- [x] `login` : assertString sur username, password
- [x] Tests : envoyer des payloads avec types incorrects (number, object, array) → 400

### B.2 - users.ts : update profil + change password

- [x] `updateProfile` : assertOptionalString sur username, email, currentPassword, newPassword
- [x] `updateProfile` : validateStringLength username (3, 30)
- [x] `changePassword` : assertString sur currentPassword, newPassword
- [x] `changePassword` : validateStringLength newPassword (8, 128)
- [x] Tests : payloads types incorrects

### B.3 - invites.ts : validation email

- [x] Ajouter validation format email (reutiliser EMAIL_REGEX) sur `POST /invites`
- [x] Test : email invalide → 400

---

## Phase C — Backend : controllers Recipe (fix C1, H2, H3, M1, M2, M3, M6)

### C.1 - recipes.ts : create + update

- [x] assertString sur title, validateStringLength (1, 200)
- [x] assertArray sur tags, limit tags.length <= MAX_TAGS_PER_RECIPE
- [x] assertArray sur ingredients
- [x] Pour chaque ingredient : validateQuantity, assertString name, assert unitId si present
- [x] Renforcer isValidHttpUrl : rejeter data:, javascript:, ftp: — accepter uniquement http(s)
- [x] validateStringLength sur imageUrl (max 2048)
- [x] Tests : titre trop long, tags pas un array, quantity negative, imageUrl javascript:

### C.2 - recipes.ts + communityRecipes.ts : filtres GET

- [x] Limiter tags split a MAX_FILTER_ITEMS (20)
- [x] Limiter ingredients split a MAX_FILTER_ITEMS (20)
- [x] Limiter search query length (max 200 chars)
- [x] Tests : filtres avec 100 tags → 400 ou tronques silencieusement

### C.3 - communityRecipes.ts : create + update

- [x] Memes validations que C.1 (factoriser si possible dans une fonction commune)

### C.4 - proposals.ts : create

- [x] assertString sur proposedTitle, validateStringLength (1, 200)
- [x] assertArray sur proposedIngredients (deja max 50, OK)
- [x] validateQuantity sur chaque ingredient
- [x] Tests

### C.5 - admin/recipesController.ts : update (fix C1)

- [x] assertString title si present, validateStringLength (1, 200)
- [x] assertNumber servings si present, validateServings (1-100)
- [x] assertOptionalNumber prepTime/cookTime/restTime, validateTime (0-10000)
- [x] Tests : payloads invalides → 400

---

## Phase D — Backend : controllers Admin (fix M9)

### D.1 - admin/unitsController.ts

- [x] create/update : validateStringLength name (1, 50)
- [x] create/update : validateStringLength abbreviation (1, 10)
- [x] sortOrder : assertNumber + Number.isInteger + range (0, 9999)
- [x] Tests

### D.2 - admin/ingredientsController.ts

- [x] create/update : validateStringLength name (1, 100)
- [x] reject : validateStringLength reason (1, 500)
- [x] Tests (couverts par tests existants)

### D.3 - admin/communitiesController.ts

- [x] update : validateStringLength name (3, 100), description (0, 1000)
- [x] Tests (couverts par tests existants)

### D.4 - admin/authController.ts

- [x] login : assertString email, password
- [x] Tests

---

## Phase E — Backend : notifications + express config (fix L4)

### E.1 - notifications.ts

- [ ] `markAsRead` : valider que chaque element de ids[] est un string
- [ ] Tests

### E.2 - Express body limit

- [ ] Configurer `express.json({ limit: '50kb' })` dans app.ts
- [ ] Verifier que les tests existants passent (aucun payload > 50kb attendu)

---

## Phase F — Frontend : validation forms + headers nginx

### F.1 - ProfilePage : aligner validation avec SignUpPage

- [ ] Ajouter regex USERNAME_REGEX sur champ username
- [ ] Ajouter regex email sur champ email
- [ ] Ajouter minLength/maxLength sur password change
- [ ] Utiliser react-hook-form au lieu de controlled inputs (optionnel, hors scope si trop lourd)

### F.2 - RecipeFormPage : ajouter maxLength

- [ ] Title : maxLength 200
- [ ] ImageUrl : maxLength 2048
- [ ] Steps : afficher compteur caracteres (deja max 5000 backend)

### F.3 - ProposeModificationModal : maxLength titre

- [ ] proposedTitle : maxLength 200

### F.4 - api.ts : encoder les query params

- [ ] Remplacer les 4 template literals `?status=${status}` par `buildQueryString` ou `encodeURIComponent`

### F.5 - Nginx security headers

- [ ] Ajouter dans le Dockerfile frontend (stage nginx) :
  ```
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none';" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  ```
- [ ] Tester que le frontend charge correctement avec les nouveaux headers
- [ ] Verifier que le inline script theme dans index.html est compatible (sinon nonce ou externaliser)

---

## Phase G — Tests de non-regression

### G.1 - Run complet des tests existants

- [ ] `npm run test:backend` — tous les tests passent
- [ ] `npm run test:frontend` — tous les tests passent

### G.2 - Tests manuels

- [ ] Signup/login avec payloads malformes (Postman/curl)
- [ ] Creation recette avec titre geant, tags non-array, quantity negative
- [ ] Admin recipe update avec types invalides
- [ ] Verifier les headers CSP dans le navigateur (onglet Network)
- [ ] Verifier que les images recette s'affichent toujours (pas casse par le CSP)

---

## Resume par phase et estimation

| Phase | Scope | Fixes couverts |
|-------|-------|----------------|
| **A** | Fondations (middleware UUID, validation.ts, error handler) | M5, base pour tout |
| **B** | Controllers Auth/Users/Invites | H1, M4, M8, L2 |
| **C** | Controllers Recipe/Proposals/Admin recipes | C1, H2, H3, M1, M2, M3, M6 |
| **D** | Controllers Admin (units, ingredients, communities) | M9 |
| **E** | Notifications + Express config | L4 |
| **F** | Frontend forms + nginx headers | H4, M7, L3 |
| **G** | Non-regression | Verification globale |

---

## Notes pour la reprise

Si le contexte est perdu en cours de route :
1. Consulter cette roadmap pour voir les cases cochees
2. Consulter `.claude/context/RESUME.md` si genere
3. Les phases sont independantes (B, C, D, E peuvent etre faites dans n'importe quel ordre apres A)
4. Chaque sous-phase est autonome : on peut s'arreter entre B.1 et B.2 sans probleme
5. Toujours lancer les tests apres chaque sous-phase pour detecter les regressions tot

# Spec : Securisation des entrees (Input Validation & Injection Protection)

> **Contexte** : Audit de securite realise le 2026-03-04. Aucune faille d'injection SQL
> detectee (Prisma parametre tout). Les problemes identifies concernent principalement
> l'absence de validation/sanitisation des entrees utilisateur au niveau backend et
> l'absence de headers de securite sur le frontend servi par nginx.

---

## 1. Principes directeurs

1. **Defense en profondeur** : valider cote frontend ET backend, ne jamais faire confiance au client
2. **Fail-fast avec 400** : rejeter les entrees invalides le plus tot possible avec un code 400 clair
3. **Centraliser** : un middleware/utilitaire commun plutot que des checks eparpilles dans chaque controller
4. **Ne pas casser l'existant** : les validations ajoutees doivent etre compatibles avec les donnees deja en base

---

## 2. Inventaire des failles par severite

### CRITIQUE

| ID | Description | Fichier(s) |
|----|-------------|------------|
| C1 | Admin recipe update : zero validation sur title, servings, times | `admin/controllers/recipesController.ts:107-111` |

### HIGH

| ID | Description | Fichier(s) |
|----|-------------|------------|
| H1 | Pas de `typeof === 'string'` sur password avant `.length` et `bcrypt` | `auth.ts:80`, `users.ts:83-93` |
| H2 | Tableaux de filtres `?tags=...&ingredients=...` illimites → DoS query | `recipes.ts:26`, `communityRecipes.ts:147` |
| H3 | `ingredients[].quantity` accepte negatif, Infinity, NaN | `recipes.ts:210`, `communityRecipes.ts:16`, `proposals.ts:21` |
| H4 | Frontend SPA servie par nginx sans CSP ni headers securite | `frontend/Dockerfile` (nginx config) |

### MEDIUM

| ID | Description | Fichier(s) |
|----|-------------|------------|
| M1 | Pas de maxLength sur recipe title (backend + frontend) | `recipes.ts:233`, `RecipeFormPage.tsx:176` |
| M2 | Pas de type-check array sur tags/ingredients body | `recipes.ts:227`, `communityRecipes.ts:38` |
| M3 | MAX_TAGS_PER_RECIPE non applique a la creation/update | `recipes.ts` |
| M4 | Pas de validation email dans invite | `invites.ts:36` |
| M5 | Pas de validation UUID format sur les route params → 500 au lieu de 400 | Tous les controllers |
| M6 | imageUrl sans allowlist de scheme (accepte data:, javascript:) | `validation.ts:30`, `RecipeFormPage.tsx` |
| M7 | ProfilePage : pas de validation format username/email | `ProfilePage.tsx:101-126` |
| M8 | Password sans maxLength → CPU exhaustion bcrypt | `auth.ts:80` |
| M9 | Admin name/reason fields sans maxLength | `admin/controllers/unitsController.ts`, `ingredientsController.ts` |

### LOW

| ID | Description | Fichier(s) |
|----|-------------|------------|
| L1 | Email regex faible (accepte `a@b.c`) | `validation.ts:5` |
| L2 | Username sans maxLength | `validation.ts:7` |
| L3 | Status query params non encodes dans api.ts frontend | `api.ts:166,230,427,446` |
| L4 | express.json() sans limit explicite | `app.ts:52` |
| L5 | styleSrc unsafe-inline dans CSP backend | `security.ts` |

---

## 3. Strategie de fix

### 3.1 Middleware de validation UUID (fix M5)

Creer `backend/src/middleware/validateUUID.ts` :
- Fonction middleware qui valide tout `req.params` matching un pattern `*Id` ou `id`
- Regex : `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
- Retourne 400 avec message clair si invalide
- Applique sur toutes les routes avec params UUID

### 3.2 Fonctions de validation centralisees (fix H1, M1, M2, M8, M9, L2)

Enrichir `backend/src/util/validation.ts` avec :

```typescript
// Type guards
function assertString(value: unknown, field: string): asserts value is string
function assertArray(value: unknown, field: string): asserts value is unknown[]
function assertNumber(value: unknown, field: string): asserts value is number

// Constantes maxLength
MAX_USERNAME_LENGTH = 30
MAX_PASSWORD_LENGTH = 128
MAX_TITLE_LENGTH = 200
MAX_NAME_LENGTH = 100
MAX_REASON_LENGTH = 500
MAX_URL_LENGTH = 2048
MAX_FILTER_ITEMS = 20

// Validation quantity
function validateQuantity(val: unknown): number | null
// → doit etre null, ou number > 0, <= 99999, Number.isFinite()
```

### 3.3 Validation imageUrl scheme (fix M6)

Dans `isValidHttpUrl()` : renforcer pour n'accepter que `https://` en prod (+ `http://` en dev).
Rejeter explicitement `data:`, `javascript:`, `ftp:`, etc.

### 3.4 Application des validations dans les controllers

Chaque controller sera mis a jour pour utiliser les fonctions centralisees.
Pas de changement de logique metier, uniquement ajout de guards en debut de handler.

### 3.5 Headers securite nginx (fix H4)

Ajouter dans la config nginx du frontend Dockerfile :
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### 3.6 Frontend : validation formulaires (fix M7)

Aligner ProfilePage avec SignUpPage : memes regex username/email.
Ajouter maxLength sur les champs titre recette, etc.

### 3.7 Express body limit (fix L4)

```typescript
app.use(express.json({ limit: '50kb' }));
```

### 3.8 Frontend api.ts : encoder les query params (fix L3)

Utiliser `buildQueryString` ou `encodeURIComponent` partout.

---

## 4. Ce qui ne sera PAS change

- **Email regex (L1)** : la regex actuelle est suffisante pour l'usage. Une validation stricte RFC 5322 apporterait plus de faux positifs que de securite.
- **styleSrc unsafe-inline (L5)** : necessaire pour Tailwind/DaisyUI, pas de contournement simple.
- **Migration vers Zod** : hors scope de cette phase. Les validations manuelles centralisees suffisent. A envisager dans une future phase de refactoring.

# Specification - Audit & Refactorisation Complete

## Objectif

Amener le projet a un niveau de qualite production : code propre, DRY, performant, securise, bien teste. Chaque chantier est defini avec son scope, sa justification, et les actions concretes.

---

## 1. Audit Securite

### 1.1 CSRF Protection

**Constat :** Aucune protection CSRF en place. L'app utilise des sessions cookie-based (`connect.sid`, `admin.sid`) avec `credentials: include` cote Axios. Un site tiers pourrait forger des requetes POST/PATCH/DELETE avec le cookie de session.

**Solution :** Double-submit cookie pattern.
- Le serveur genere un token CSRF et le place dans un cookie (`XSRF-TOKEN`, httpOnly: false)
- Le client lit ce cookie et l'envoie dans un header (`X-XSRF-TOKEN`) a chaque requete mutante
- Le serveur verifie que cookie et header correspondent
- Alternative : library `csrf-csrf` (maintenue, compatible express-session)

**Scope :**
- Backend : middleware CSRF sur toutes les routes POST/PATCH/PUT/DELETE
- Frontend : intercepteur Axios pour lire le cookie et ajouter le header
- Exclure : routes publiques (login, signup), health check

### 1.2 IDOR (Insecure Direct Object Reference)

**Constat :** La plupart des endpoints verifient l'ownership/membership via `memberOf` middleware ou `requireRecipeAccess`. A auditer systematiquement.

**Actions :**
- [ ] Lister tous les endpoints qui prennent un ID en parametre
- [ ] Verifier pour chacun que l'utilisateur a le droit d'acceder/modifier la ressource
- [ ] Points sensibles : PATCH/DELETE sur recipes, communities, proposals, invites, notifications
- [ ] Verifier que les soft-deleted entities ne sont pas accessibles

### 1.3 Mass Assignment

**Constat :** Verifier qu'aucun controller ne passe `req.body` directement a Prisma sans filtrage explicite des champs.

**Actions :**
- [ ] Auditer chaque `prisma.create()` et `prisma.update()` dans les controllers
- [ ] S'assurer que seuls les champs explicites sont passes dans `data: { ... }`
- [ ] Attention aux champs sensibles : `role`, `deletedAt`, `isVerified`, `totpSecret`

### 1.4 XSS

**Constat :** React echappe par defaut le contenu rendu. Verifier les exceptions.

**Actions :**
- [ ] Rechercher `dangerouslySetInnerHTML` dans le frontend
- [ ] Verifier que les donnees utilisateur (titres, descriptions, noms) ne sont jamais injectees dans des attributs HTML sans echappement
- [ ] Verifier le CSP Helmet (script-src, style-src)

### 1.5 Session Security

**Actions :**
- [ ] Verifier `req.session.regenerate()` apres login (previent session fixation)
- [ ] Verifier que les cookies ont `secure: true` en production
- [ ] Verifier `sameSite` stricte sur les cookies admin
- [ ] Verifier que logout detruit bien la session (`req.session.destroy()`)

### 1.6 Upload Security

**Actions :**
- [ ] Verifier la validation du type MIME a l'upload (pas juste l'extension)
- [ ] Verifier la taille max par fichier
- [ ] Verifier que les fichiers uploades ne sont pas executables
- [ ] Verifier les presigned URLs : expiration, scope, permissions

### 1.7 Logging & Secrets

**Actions :**
- [ ] Verifier qu'aucun mot de passe, token, ou secret n'apparait dans les logs Pino
- [ ] Verifier que les .env ne sont pas commites (check .gitignore)
- [ ] Verifier que les error responses ne leakent pas de stack traces en production

---

## 2. NPM Audit

**Actions :**
- [ ] `cd backend && npm audit` - corriger critical + high
- [ ] `cd frontend && npm audit` - corriger critical + high
- [ ] Documenter les vulnerabilites low/moderate non resolvables (dependances transitives)
- [ ] Mettre a jour les dependances majeures si necessaire (verifier les breaking changes)
- [ ] Ajouter `npm audit` dans le CI (fail on high+)

---

## 3. Lint & Formatage

### 3.1 ESLint - Regles strictes

**Etat actuel :** Config minimale (recommended + no-unused-vars).

**Regles a ajouter :**

Backend (`eslint.config.mjs`) :
```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "warn",      // Puis "error" progressivement
  "@typescript-eslint/no-non-null-assertion": "warn",
  "@typescript-eslint/prefer-const": "error",
  "@typescript-eslint/no-floating-promises": "error", // Requiert parserOptions.project
  "no-console": "warn",                               // Utiliser Pino
}
```

Frontend (`eslint.config.mjs`) :
```javascript
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "react/self-closing-comp": "error",
  "react/jsx-no-target-blank": "error",
}
```

### 3.2 Prettier

**Action :** Ajouter Prettier pour le formatage automatique.
- Config : `.prettierrc` a la racine (tabs vs spaces, trailing commas, etc.)
- Integration ESLint : `eslint-config-prettier` pour desactiver les regles conflictuelles
- Scripts : `format`, `format:check`

### 3.3 Pre-commit hooks

**Action :** Installer Husky + lint-staged.
- Pre-commit : `lint-staged` execute ESLint + Prettier sur les fichiers stages
- Config dans `package.json` ou `.lintstagedrc`
- Garantit qu'aucun code non conforme n'est commite

### 3.4 CI Integration

- [ ] Verifier que GitHub Actions execute `npm run lint` et `npm run format:check`
- [ ] Faire echouer le build si lint ou format non conforme

---

## 4. DRY Backend

### 4.1 Error Codes centralises

**Actuellement :** Codes erreur en strings dans les controllers (`"AUTH_001: ..."`, `"RECIPE_003: ..."`).

**Solution :** Fichier `constants/errorCodes.ts` :
```typescript
export const ERROR_CODES = {
  AUTH_001: "AUTH_001: You are not authenticated",
  AUTH_002: "AUTH_002: Invalid credentials",
  // ...
} as const;
```
- Autocompletion dans les controllers
- Impossible de faire une typo
- Source unique de verite pour les messages

### 4.2 Rate Limiter Factory

**Actuellement :** 3 definitions quasi identiques.

**Solution :** `config/rateLimiter.ts` :
```typescript
export function createRateLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({ windowMs, max, message, standardHeaders: true, legacyHeaders: false });
}
```

### 4.3 Middleware validateBody

**Solution :** Si Zod adopte :
```typescript
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: formatZodError(result.error) });
    }
    req.body = result.data;
    next();
  };
}
```
Permet de declarer la validation au niveau de la route :
```typescript
router.post("/", validateBody(createRecipeSchema), RecipesController.createRecipe);
```

### 4.4 Extraction config session

Extraire la configuration des deux sessions (user + admin) de `app.ts` vers `config/session.ts`.

---

## 5. DRY Frontend

### 5.1 SearchSelector generique

**Actuellement :** `TagSelector` et `IngredientSelector` partagent ~80% de logique (recherche debounced, dropdown, multi-select, keyboard, badges).

**Solution :** Composant `SearchSelector<T>` parametrable :
```tsx
<SearchSelector<Tag>
  searchFn={(q) => APIManager.searchTags(q)}
  renderItem={(tag) => tag.name}
  getKey={(tag) => tag.id}
  allowCreate={true}
  onCreateNew={(name) => ...}
  selected={selectedTags}
  onChange={setSelectedTags}
/>
```

### 5.2 useAsyncData hook

**Pattern repete dans chaque page :**
```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
useEffect(() => { fetchData().then(setData).catch(setError).finally(() => setLoading(false)); }, []);
```

**Solution :**
```typescript
const { data, loading, error, refetch } = useAsyncData(() => APIManager.getRecipe(id), [id]);
```

### 5.3 useImageUpload hook

**Logique dupliquee :** get presigned URL → upload to MinIO → confirm upload.

**Solution :**
```typescript
const { upload, uploading, imageUrl, error } = useImageUpload("recipe", recipeId);
// upload(file) gere tout le flow
```

### 5.4 DataContainer composant

**Pattern repete :** loading spinner → error alert → empty state → contenu.

**Solution :**
```tsx
<DataContainer loading={loading} error={error} empty={!data?.length} emptyMessage="Aucune recette">
  {data.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
</DataContainer>
```

### 5.5 AdminListPage generique

**3+ pages admin avec le meme pattern :** fetch pagine, table, modal create/edit, search, delete.

**Solution :** Composant configurable ou hook `useAdminCrud<T>()` qui gere le state CRUD complet.

---

## 6. Clean Code

### 6.1 Fichiers longs (>300 lignes)

- [ ] Auditer et decouper les fichiers les plus longs
- [ ] Extraire les sous-composants React dans des fichiers separes
- [ ] Extraire les helpers de controllers dans des services

### 6.2 Code mort

- [ ] Scanner avec `ts-prune` ou ESLint `no-unused-vars` strict
- [ ] Supprimer les imports inutilises
- [ ] Supprimer les fonctions non appelees
- [ ] Supprimer le code commente

### 6.3 Coherence des patterns

- [ ] Verifier que tous les controllers suivent le meme pattern (try/catch → next)
- [ ] Verifier que toutes les reponses suivent le format `{ data: ... }` ou `{ data: ..., pagination: ... }`
- [ ] Verifier la coherence des status codes (201 pour create, 200 pour update, 204 pour delete)

---

## 7. Tests

### 7.1 Couverture

- [ ] Mesurer la couverture actuelle (`npm run test -- --coverage`)
- [ ] Definir un seuil minimum : 80% statements, 70% branches
- [ ] Ajouter la verification de couverture dans le CI

### 7.2 Tests manquants

- [ ] Identifier les controllers/services sans tests d'integration
- [ ] Prioriser les flux critiques : auth, recipe CRUD, community membership, sharing
- [ ] Ajouter des tests pour les cas limites (permissions, soft delete, concurrence)

### 7.3 Tests E2E

- [ ] Evaluer Playwright pour les flux critiques
- [ ] Flux minimum : signup → login → create community → invite → create recipe → share
- [ ] Integrer dans le CI (sur un environment de test docker)

### 7.4 Qualite des tests existants

- [ ] Verifier que les tests sont independants (pas d'ordre d'execution requis)
- [ ] Verifier que les tests nettoient bien leurs donnees (afterEach)
- [ ] Verifier qu'il n'y a pas de tests flaky

---

## 8. Performances

### 8.1 Backend

- [ ] Activer les logs de requetes Prisma lentes en dev
- [ ] `EXPLAIN ANALYZE` sur les requetes frequentes (getRecipes, getCommunityRecipes, searchTags)
- [ ] Verifier les index manquants
- [ ] Evaluer un cache Redis pour les donnees quasi-statiques (unites, tags globaux)
- [ ] Verifier les payloads JSON (pas de champs inutiles retournes)

### 8.2 Frontend

- [ ] Analyse du bundle (`npx vite-bundle-visualizer`)
- [ ] `React.lazy()` pour les pages admin, les modales lourdes (ImportRecipeModal, ShareModal)
- [ ] Profiler les re-renders avec React DevTools
- [ ] Verifier le lazy loading des images
- [ ] Verifier que les listes longues sont paginées cote UI aussi

### 8.3 Infrastructure

- [ ] Verifier la config Docker (multi-stage build, layer caching)
- [ ] Verifier les health checks
- [ ] Evaluer la compression gzip/brotli sur les reponses API

---

## 9. App.ts & App.tsx - Lisibilite

### 9.1 app.ts (backend)

- [ ] Extraire la config sessions dans `config/session.ts`
- [ ] Extraire le error handler dans `middleware/errorHandler.ts`
- [ ] Regrouper les middlewares de securite (helmet, cors, https) dans `middleware/security.ts`
- [ ] Objectif : `app.ts` ne fait que composer les middlewares et monter les routes, ~50 lignes max

### 9.2 App.tsx (frontend)

- [ ] Extraire les definitions de routes dans `routes/userRoutes.tsx` et `routes/adminRoutes.tsx`
- [ ] Deplacer `NotificationHandler` dans `MainLayout`
- [ ] Objectif : `App.tsx` ne fait que le provider stack + le router switch, ~40 lignes max

---

## 10. Zod (Migration Progressive)

### 10.1 Strategie de migration

- **Phase 1 :** Installer Zod, creer le middleware `validateBody`, migrer 2-3 endpoints simples (auth signup/login, user profile update)
- **Phase 2 :** Migrer les schemas recipe (create, update) - plus complexes avec ingredients/steps/tags
- **Phase 3 :** Migrer les schemas community, invite, proposal
- **Phase 4 :** Migrer les schemas admin
- **Phase 5 :** Supprimer les anciennes assertions devenues inutiles

### 10.2 Organisation des schemas

```
backend/src/schemas/
  auth.schema.ts        # signupSchema, loginSchema
  recipe.schema.ts      # createRecipeSchema, updateRecipeSchema
  community.schema.ts   # createCommunitySchema, updateCommunitySchema
  proposal.schema.ts    # createProposalSchema
  invite.schema.ts      # sendInviteSchema
  admin.schema.ts       # admin-specific schemas
  common.schema.ts      # schemas partages (pagination, uuid, etc.)
```

### 10.3 Coexistence

Pendant la migration, les deux systemes coexistent :
- Nouveaux endpoints : Zod + `validateBody` middleware
- Anciens endpoints : assertions existantes, migres progressivement
- `validation.ts` conserve les constantes (longueurs, regex) utilisables dans les schemas Zod

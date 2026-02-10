# Backend Refactoring

## PRIORITE 1 - Fondations (DRY, Services, Securite)

### B1.1 - Extraire constantes de validation partagees

**Probleme**: Regex et constantes dupliquees entre `auth.ts` et `users.ts`
**Action**: Creer `src/utils/validation.ts` avec les constantes partagees
**Fichiers concernes**:
- `src/controllers/auth.ts` (lignes 6-10) - EMAIL_REGEX, USERNAME_REGEX, MIN_USERNAME_LENGTH
- `src/controllers/users.ts` (lignes 6-9) - memes constantes copiees
- `src/controllers/communities.ts` (lignes 8-12) - objet VALIDATION
**Resultat attendu**: Un seul fichier source pour toutes les regles de validation
**Status**: TODO

---

### B1.2 - Extraire utilitaire de pagination

**Probleme**: Parsing limit/offset repete 6+ fois avec la meme logique
**Action**: Creer `src/utils/pagination.ts` avec `parsePagination(query)` et `formatPaginatedResponse(data, total, limit, offset)`
**Fichiers concernes**:
- `src/controllers/recipes.ts` (lignes 16-17)
- `src/controllers/communityRecipes.ts` (lignes 229-233)
- `src/controllers/recipeVariants.ts` (lignes 24-25)
- `src/controllers/proposals.ts` (lignes 148-152)
- `src/controllers/activity.ts` (lignes 22-23, 100)
- `src/controllers/tags.ts` (ligne 13)
- `src/controllers/ingredients.ts` (ligne 13)
**Pattern a extraire**:
```typescript
const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
```
**Resultat attendu**: Appel unique `const { limit, offset } = parsePagination(req.query)`
**Status**: TODO

---

### B1.3 - Creer service de verification membership

**Probleme**: Verification membership copiee 15+ fois dans les controllers
**Action**: Creer `src/services/membershipService.ts` avec :
- `verifyMembership(userId, communityId)` -> retourne membership ou throw 403
- `verifyMembershipRole(userId, communityId, role)` -> idem avec check role
- `verifyRecipeAccess(userId, recipe)` -> gere personal vs community
**Fichiers concernes**:
- `src/controllers/recipes.ts` (lignes 196-215, 444-454, 698-708)
- `src/controllers/recipeVariants.ts` (lignes 47-66)
- `src/controllers/proposals.ts` (lignes 62-72, 182-192, 301-312)
- `src/controllers/recipeShare.ts` (lignes 93-107)
- `src/controllers/invites.ts` (ligne 77)
- `src/controllers/members.ts` (ligne 79)
**Pattern a extraire**:
```typescript
const membership = await prisma.userCommunity.findFirst({
  where: { userId, communityId, deletedAt: null }
});
if (!membership) throw createHttpError(403, "COMMUNITY_001: Not a member");
```
**Status**: TODO

---

### B1.4 - Extraire Prisma select constants

**Probleme**: Memes objets `select` / `include` Prisma repetes dans 4+ controllers
**Action**: Creer `src/utils/prismaSelects.ts` avec les selects reutilisables
**Fichiers concernes**:
- `src/controllers/recipes.ts` - select tags/ingredients (multiple handlers)
- `src/controllers/communityRecipes.ts` - idem
- `src/controllers/recipeVariants.ts` - idem
- `src/controllers/recipeShare.ts` - idem
**Objets a extraire**:
- `RECIPE_TAGS_SELECT` (tag id + name)
- `RECIPE_INGREDIENTS_SELECT` (id, quantity, order, ingredient name)
- `RECIPE_WITH_RELATIONS_SELECT` (combinaison complete)
**Status**: TODO

---

### B1.5 - Extraire service de formatage response recipe

**Probleme**: Mapping `recipe -> response` duplique dans tous les controllers recipe
**Action**: Creer `src/utils/responseFormatters.ts` avec `formatRecipeResponse(recipe)`, `formatRecipeListItem(recipe)`
**Fichiers concernes**:
- `src/controllers/recipes.ts` (lignes 98-105, 217-240, 373-389, 648-664)
- `src/controllers/communityRecipes.ts`
- `src/controllers/recipeVariants.ts`
- `src/controllers/recipeShare.ts`
**Pattern a extraire**:
```typescript
tags: recipe.tags.map((rt) => rt.tag)
ingredients: recipe.ingredients.map((ri) => ({
  id: ri.id, name: ri.ingredient.name, ingredientId: ri.ingredient.id,
  quantity: ri.quantity, order: ri.order
}))
```
**Status**: TODO

---

### B1.6 - Extraire tag/ingredient normalization

**Probleme**: Normalisation des noms (trim + lowercase + dedupe) repetee 3+ fois
**Action**: Ajouter `normalizeNames(items: string[]): string[]` dans `src/utils/validation.ts`
**Fichiers concernes**:
- `src/controllers/recipes.ts` (lignes 287, 472)
- `src/controllers/communityRecipes.ts` (ligne 67)
- `src/controllers/recipeShare.ts`
**Pattern a extraire**:
```typescript
[...new Set(items.map((t) => t.trim().toLowerCase()).filter(Boolean))]
```
**Status**: TODO

---

### B1.7 - Fusionner controllers tags et ingredients

**Probleme**: `tags.ts` et `ingredients.ts` sont quasi-identiques (60 lignes chacun, 90% copie-colle)
**Action**: Creer un controller generique ou factoriser la logique commune
**Fichiers concernes**:
- `src/controllers/tags.ts` (60 lignes)
- `src/controllers/ingredients.ts` (60 lignes)
**Status**: TODO

---

### B1.8 - Fix securite : autorisation cancelInvite

**Probleme**: N'importe quel membre peut annuler l'invite d'un autre membre
**Action**: Ajouter verification `userId === invite.inviterId || role === "MODERATOR"`
**Fichier**: `src/controllers/invites.ts` (lignes 215-295)
**Status**: TODO

---

### B1.9 - Fix securite : rate limiting auth user

**Probleme**: Pas de rate limiting sur signup/login user (admin en a)
**Action**: Ajouter `authRateLimiter` sur les routes auth user
**Fichier**: `src/routes/auth.ts`
**Status**: TODO

---

### B1.10 - Fix securite : validation imageUrl

**Probleme**: `imageUrl` accepte n'importe quelle string (risque XSS via `javascript:` URLs)
**Action**: Valider que l'URL commence par `http://` ou `https://`
**Fichiers concernes**:
- `src/controllers/recipes.ts`
- `src/controllers/communityRecipes.ts` (ligne 25)
**Status**: TODO

---

### B1.11 - Supprimer dead code

**Probleme**: Fonction exportee mais jamais importee
**Action**: Supprimer `handleOrphanedRecipesWithTransaction()` de `src/services/orphanHandling.ts` (lignes 121-128)
**Status**: TODO

---

## PRIORITE 2 - Refactoring controllers (extraire business logic)

### B2.1 - Creer recipeService.ts

**Probleme**: `recipes.ts` (721 lignes) contient toute la logique metier
**Action**: Creer `src/services/recipeService.ts` avec :
- `createRecipe(data, userId)` - creation + tags/ingredients
- `updateRecipe(recipeId, data, userId)` - update + sync logic
- `deleteRecipe(recipeId, userId)` - soft delete
- `syncLinkedRecipes(recipe, updatedFields)` - logique de synchronisation bidirectionnelle (actuellement lignes 518-602)
**Fichier source**: `src/controllers/recipes.ts`
**Status**: TODO

---

### B2.2 - Creer communityRecipeService.ts

**Probleme**: Logique metier dans controller communityRecipes
**Action**: Extraire la logique de creation/listing de recettes communautaires
**Fichier source**: `src/controllers/communityRecipes.ts` (363 lignes)
**Status**: TODO

---

### B2.3 - Creer proposalService.ts

**Probleme**: Business logic complexe dans proposals controller
**Action**: Extraire accept/reject/create proposal logic
**Fichier source**: `src/controllers/proposals.ts` (657 lignes)
**Status**: TODO

---

### B2.4 - Creer shareService.ts

**Probleme**: Chain traversal logic complexe dans controller
**Action**: Extraire logique de share + parent chain
**Fichier source**: `src/controllers/recipeShare.ts` (575 lignes)
**Status**: TODO

---

### B2.5 - Fix N+1 queries dans orphanHandling

**Probleme**: Boucle avec 3 requetes DB par proposal
**Action**: Utiliser des operations batch (`createMany`, `updateMany`) au lieu de boucles individuelles
**Fichier**: `src/services/orphanHandling.ts` (lignes 67-107)
**Status**: TODO

---

## PRIORITE 3 - Type safety & qualite

### B3.1 - Remplacer `any` par types Prisma

**Probleme**: 4 `whereClause: any` qui perdent le type checking
**Action**: Utiliser `Prisma.XxxWhereInput` pour chaque cas
**Fichiers concernes**:
- `src/controllers/recipes.ts` (ligne 26) -> `Prisma.RecipeWhereInput`
- `src/controllers/communityRecipes.ts` (ligne 248) -> `Prisma.RecipeWhereInput`
- `src/controllers/recipeVariants.ts` (ligne 70) -> `Prisma.RecipeWhereInput`
- `src/controllers/proposals.ts` (ligne 196) -> `Prisma.RecipeUpdateProposalWhereInput`
**Status**: TODO

---

### B3.2 - Remplacer non-null assertions par guards

**Probleme**: 14 `req.session.adminId!` dans admin controllers
**Action**: Remplacer par `const adminId = req.session.adminId; if (!adminId) return next(...)`
**Fichiers concernes**:
- `src/admin/controllers/featuresController.ts` (lignes 43, 96, 148, 208)
- `src/admin/controllers/tagsController.ts` (lignes 42, 86, 137, 171)
- `src/admin/controllers/ingredientsController.ts` (lignes 42, 86, 137, 170)
- `src/admin/controllers/communitiesController.ts` (lignes 128, 168)
**Status**: TODO

---

### B3.3 - Typer RequestHandler avec generics

**Probleme**: `RequestHandler` sans type params = `any` pour params/body/query
**Action**: Ajouter les generics `RequestHandler<Params, ResBody, ReqBody, Query>`
**Fichiers concernes**: Tous les controllers (prioriser `members.ts`, `invites.ts`)
**Status**: TODO

---

### B3.4 - Standardiser les codes erreur

**Probleme**: Certains endpoints n'ont pas de code erreur (invites, users, activity)
**Action**: Ajouter les codes erreur manquants selon la convention existante
**Fichiers concernes**:
- `src/controllers/invites.ts` (ligne 47 : "One of email..." sans code)
- `src/controllers/users.ts` (ligne 53 : "User not found" sans code)
- `src/controllers/activity.ts` (aucun code erreur)
**Status**: TODO

---

### B3.5 - Trim consistant sur tous les inputs

**Probleme**: Certains controllers trim les inputs, d'autres non
**Action**: Ajouter `.trim()` sur tous les `req.body` string fields
**Fichiers concernes**: `invites.ts` (lignes 31-55), verifier les autres
**Status**: TODO

---

### B3.6 - Pagination bounds dans admin controllers

**Probleme**: Admin activity controller ne valide pas offset >= 0
**Action**: Appliquer `parsePagination()` (cree en B1.2) aux routes admin aussi
**Fichier**: `src/admin/controllers/activityController.ts` (ligne 14)
**Status**: TODO

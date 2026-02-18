# Specification : Rework du systeme d'Ingredients

> **Statut** : SPEC VALIDEE - En attente d'implementation
> **Date** : 2026-02-17
> **Prerequis** : MVP complet (phases 0-8), Tags Rework (phase 10)
> **Roadmap** : `ROADMAP.md` (meme dossier)

---

## 1. Vue d'ensemble

Le systeme actuel d'ingredients est minimaliste : un `name` unique, une `quantity` texte libre, aucune unite structuree, creation implicite a la volee sans controle qualite. Ce rework introduit **un systeme d'unites structure**, une **gouvernance hybride** (creation immediate + moderation admin), et l'**integration des ingredients dans les propositions de modification de recettes**.

### 1.1 Objectifs

| Objectif | Description |
|----------|-------------|
| **Unites structurees** | Quantites numeriques + unites de mesure standardisees (g, cl, l...) |
| **Qualite des donnees** | Moderation admin pour eviter doublons, typos, ingredients fantaisistes |
| **UX fluide** | Creation immediate en PENDING, aucun blocage pour l'utilisateur |
| **Unite favorite** | Pre-selection intelligente de l'unite la plus pertinente par ingredient |
| **Proposals completes** | Les propositions de modification incluent les ingredients |
| **Base pour le futur** | Quantites numeriques = prerequis pour le scaling par portions (Rework recettes v2) |

### 1.2 Perimetre

- **Inclus** : Unites, ingredients (gouvernance + moderation), RecipeIngredient, ProposalIngredient, notifications, admin CRUD
- **Exclus** : Conversion d'unites, categories d'ingredients (legumes, epices...), donnees nutritionnelles, allergenes, substitutions

### 1.3 Scope

Tout est **global a la plateforme**. Les ingredients et unites n'ont aucune portee communautaire. Seuls les **SuperAdmin** gerent la moderation. Les moderateurs de communaute n'ont aucun role dans ce systeme.

---

## 2. Schema de donnees

### 2.1 Nouveau modele : Unit

Table de reference pour les unites de mesure.

```
Unit
  id            String       @id @default(uuid())
  name          String       @unique       -- "gramme", "centilitre", "piece"...
  abbreviation  String       @unique       -- "g", "cl", "pc"...
  category      UnitCategory              -- WEIGHT | VOLUME | SPOON | COUNT | QUALITATIVE
  sortOrder     Int          @default(0)   -- Tri dans les dropdowns

  // Relations
  recipeIngredients   RecipeIngredient[]
  proposalIngredients ProposalIngredient[]
  defaultIngredients  Ingredient[]          -- Ingredients ayant cette unite par defaut

  @@index([category, sortOrder])
```

### 2.2 Enum : UnitCategory

```
UnitCategory: WEIGHT | VOLUME | SPOON | COUNT | QUALITATIVE
```

### 2.3 Modele modifie : Ingredient

```
Ingredient (modifie)
  id            String           @id @default(uuid())
  name          String           @unique         -- Normalise en lowercase
  status        IngredientStatus @default(APPROVED)
  defaultUnitId String?                          -- NOUVEAU - FK vers Unit
  createdById   String?                          -- NOUVEAU - FK vers User (null = admin)
  createdAt     DateTime         @default(now()) -- NOUVEAU
  updatedAt     DateTime         @updatedAt      -- NOUVEAU

  // Relations
  defaultUnit   Unit?      @relation(fields: [defaultUnitId], references: [id])
  createdBy     User?      @relation(fields: [createdById], references: [id])
  recipes       RecipeIngredient[]
  proposals     ProposalIngredient[]

  @@index([name])
  @@index([status])
```

### 2.4 Nouvel enum : IngredientStatus

```
IngredientStatus: APPROVED | PENDING
```

- `APPROVED` : Ingredient valide (cree par admin ou valide par admin)
- `PENDING` : Cree par un utilisateur, en attente de review admin

### 2.5 Modele modifie : RecipeIngredient

```
RecipeIngredient (modifie)
  id            String  @id @default(uuid())
  recipeId      String
  ingredientId  String
  quantity      Float?              -- MODIFIE : etait String?, devient Float?
  unitId        String?             -- NOUVEAU - FK vers Unit
  order         Int     @default(0)

  recipe        Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  ingredient    Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  unit          Unit?      @relation(fields: [unitId], references: [id])

  @@unique([recipeId, ingredientId])
  @@index([recipeId])
```

### 2.6 Nouveau modele : ProposalIngredient

Table pivot pour les ingredients dans les propositions de modification de recettes.

```
ProposalIngredient
  id            String  @id @default(uuid())
  proposalId    String
  ingredientId  String
  quantity      Float?
  unitId        String?
  order         Int     @default(0)

  proposal      RecipeUpdateProposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  ingredient    Ingredient           @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  unit          Unit?                @relation(fields: [unitId], references: [id])

  @@unique([proposalId, ingredientId])
  @@index([proposalId])
```

### 2.7 Modele modifie : RecipeUpdateProposal

Ajout de la relation vers ProposalIngredient :

```
RecipeUpdateProposal (modifie)
  ... champs existants (proposedTitle, proposedContent, status, etc.) ...
  proposedIngredients ProposalIngredient[]   -- NOUVEAU
```

---

## 3. Systeme d'unites

### 3.1 Seed initial

Les unites sont seedees au deploiement. Le SuperAdmin peut en ajouter/modifier/supprimer ensuite.

| Categorie | name | abbreviation | sortOrder |
|-----------|------|-------------|-----------|
| **WEIGHT** | gramme | g | 1 |
| **WEIGHT** | kilogramme | kg | 2 |
| **VOLUME** | millilitre | ml | 1 |
| **VOLUME** | centilitre | cl | 2 |
| **VOLUME** | decilitre | dl | 3 |
| **VOLUME** | litre | l | 4 |
| **SPOON** | cuillere a cafe | cac | 1 |
| **SPOON** | cuillere a soupe | cas | 2 |
| **COUNT** | piece | pc | 1 |
| **COUNT** | tranche | tr | 2 |
| **COUNT** | gousse | gse | 3 |
| **COUNT** | botte | bte | 4 |
| **COUNT** | feuille | fle | 5 |
| **COUNT** | brin | brn | 6 |
| **QUALITATIVE** | pincee | pincee | 1 |
| **QUALITATIVE** | a gout | a gout | 2 |
| **QUALITATIVE** | selon besoin | selon besoin | 3 |

### 3.2 Regles

- Les noms et abbreviations sont **uniques**
- Les unites sont **globales** (pas de scope communaute)
- Tri dans les dropdowns : par categorie puis par `sortOrder`
- Les unites QUALITATIVE peuvent avoir `quantity = null` (ex: "a gout") ou un nombre (ex: "2 pincees")

---

## 4. Gouvernance des ingredients

### 4.1 Principe : creation hybride

L'utilisateur peut creer un ingredient a la volee lors de l'ajout a une recette. L'ingredient est utilisable immediatement mais en attente de review admin.

| Createur | Status initial | Utilisable immediatement | Review necessaire |
|----------|---------------|-------------------------|-------------------|
| **SuperAdmin** | APPROVED | Oui | Non |
| **Utilisateur** (via recette) | PENDING | **Oui** | Oui (admin async) |

### 4.2 Flow utilisateur : ajout d'ingredient a une recette

```
1. L'utilisateur tape dans l'autocomplete
2. Recherche parmi les ingredients existants (APPROVED + PENDING)
3. CAS A : Ingredient trouve → selection directe
4. CAS B : Ingredient non trouve → option "Suggerer : [nom]"
   a. Clic → Ingredient cree en PENDING, createdById = userId
   b. L'ingredient est immediatement associe a la recette
   c. L'ingredient PENDING apparait dans la file de review admin
5. L'utilisateur choisit la quantite (champ numerique libre)
6. L'utilisateur choisit l'unite (dropdown avec pre-selection intelligente)
```

### 4.3 Reutilisation d'un ingredient PENDING

Si un ingredient PENDING existe deja (cree par un autre user) :
- L'autocomplete le propose normalement
- L'utilisateur peut l'utiliser sans re-creer
- Pas de doublon

### 4.4 Affichage des ingredients PENDING

| Contexte | Style |
|----------|-------|
| Dans une recette (vue lecture) | Style normal (l'ingredient est un ingredient, pending ou pas) |
| Dans l'autocomplete | Badge "nouveau" ou icone distincte pour les PENDING |
| Dans le panneau admin | Badge "en attente" avec nombre de recettes utilisant l'ingredient |

> **Difference avec les tags** : un tag PENDING a un style visuel different sur la recette car la "categorisation" est sujette a validation. Un ingredient PENDING est un fait ("poire" c'est "poire"), donc il s'affiche normalement sur la recette.

---

## 5. Moderation admin (SuperAdmin)

### 5.1 File de review

Le panneau admin affiche les ingredients PENDING avec :
- Nom de l'ingredient
- Createur (username)
- Nombre de recettes utilisant cet ingredient
- Date de creation

### 5.2 Actions de moderation

| Action | Effet sur l'ingredient | Effet sur les recettes | Notification |
|--------|----------------------|----------------------|-------------|
| **Approuver** | `status` → `APPROVED` | Aucun changement | Optionnelle au createur |
| **Approuver + modifier** | Rename + `status` → `APPROVED` | Suivent automatiquement (FK) | Createur informe du renommage |
| **Merger** | Supprime le PENDING, rattache les RecipeIngredient au target | Les recettes pointent vers l'ingredient cible | Createur informe du merge |
| **Rejeter** | Hard delete de l'ingredient | Cascade : suppression des RecipeIngredient | **Obligatoire** : createur notifie avec raison + demande de correction |

### 5.3 Rejet : detail du flow

```
1. Admin rejette l'ingredient avec une raison obligatoire (champ texte)
2. Hard delete de l'Ingredient → cascade supprime les RecipeIngredient associes
3. Notification WebSocket au createur :
   - type: "INGREDIENT_REJECTED"
   - metadata: { ingredientName, reason }
4. Les recettes concernees perdent cet ingredient
5. L'utilisateur doit corriger sa recette (choisir un autre ingredient ou en proposer un nouveau)
```

### 5.4 Merge : detail du flow

```
1. Admin choisit un ingredient cible (APPROVED existant)
2. Pour chaque recette utilisant l'ingredient source :
   a. Si la recette n'a PAS l'ingredient cible → mettre a jour le RecipeIngredient (ingredientId → targetId)
   b. Si la recette a DEJA l'ingredient cible → supprimer le RecipeIngredient source (doublon)
3. Meme logique pour les ProposalIngredient
4. Hard delete de l'ingredient source
5. AdminActivityLog : INGREDIENT_MERGED
```

---

## 6. Unite favorite / pre-selection

### 6.1 Mecanisme de pre-selection

Quand l'utilisateur selectionne un ingredient dans le formulaire de recette, l'unite est pre-selectionnee dans le dropdown selon cette logique :

```
1. SI ingredient.defaultUnitId existe (defini par admin)
   → Pre-selectionner cette unite
2. SINON, SI des RecipeIngredient existent pour cet ingredient avec une unite
   → Calculer l'unite la plus utilisee (COUNT par unitId)
   → Pre-selectionner cette unite
3. SINON (ingredient tout neuf, aucune donnee)
   → Aucune pre-selection, dropdown vide
```

### 6.2 Endpoint pour recuperer l'unite suggeree

```
GET /api/ingredients/:id/suggested-unit
```

**Reponse :**
```json
{
  "suggestedUnitId": "uuid-or-null",
  "source": "default" | "popular" | null
}
```

- `source: "default"` → vient du `defaultUnitId` de l'ingredient
- `source: "popular"` → calculee depuis les recettes existantes
- `source: null` → aucune suggestion disponible

### 6.3 Default unit admin

Le SuperAdmin peut definir/modifier le `defaultUnitId` d'un ingredient via le panneau admin. Ce default a priorite sur le calcul dynamique.

---

## 7. Propositions de modification (Proposals) et ingredients

### 7.1 Principe

Une proposition de modification de recette (`RecipeUpdateProposal`) inclut desormais les ingredients proposes via la table pivot `ProposalIngredient`.

### 7.2 Creation d'une proposal

```
1. L'utilisateur propose une modification de recette
2. Il peut modifier : titre, contenu, ET ingredients
3. Les ingredients proposes sont stockes dans ProposalIngredient
   (meme structure que RecipeIngredient : ingredientId, quantity, unitId, order)
4. Si l'utilisateur propose un nouvel ingredient inconnu → creation en PENDING (meme flow que 4.2)
```

### 7.3 Acceptation d'une proposal

```
1. Le proprietaire de la recette accepte la proposal
2. proposedTitle → recipe.title (si modifie)
3. proposedContent → recipe.content (si modifie)
4. ProposalIngredient → remplace les RecipeIngredient de la recette
   a. Suppression de tous les RecipeIngredient existants
   b. Creation des nouveaux RecipeIngredient depuis ProposalIngredient
5. Proposal.status = ACCEPTED
```

### 7.4 Rejet d'une proposal

```
1. Le proprietaire rejette la proposal
2. ProposalIngredient cascade-delete (via Proposal)
3. Les ingredients PENDING crees pour cette proposal restent en base
   (ils peuvent etre utilises par d'autres recettes ou etre review par admin)
```

---

## 8. API Endpoints

### 8.1 User API : Ingredients

```
GET  /api/ingredients?search=X&limit=20
```
Recherche d'ingredients (APPROVED + PENDING). Reponse enrichie avec recipeCount.

```
GET  /api/ingredients/:id/suggested-unit
```
Retourne l'unite suggeree pour un ingredient (voir section 6.2).

### 8.2 User API : Units

```
GET  /api/units
```
Liste toutes les unites, groupees par categorie, triees par sortOrder.

### 8.3 Admin API : Units (NOUVEAU)

```
GET    /api/admin/units                → Liste toutes les unites
POST   /api/admin/units                → Creer une unite
PATCH  /api/admin/units/:id            → Modifier une unite
DELETE /api/admin/units/:id            → Supprimer une unite
```

**Contraintes de suppression :** une unite ne peut pas etre supprimee si elle est utilisee dans des RecipeIngredient ou ProposalIngredient. L'admin doit d'abord migrer les recettes vers une autre unite.

### 8.4 Admin API : Ingredients (existant, etendu)

```
GET    /api/admin/ingredients?search=X&status=PENDING
```
Filtre par status ajoute. Reponse enrichie avec `status`, `createdBy`, `defaultUnit`.

```
POST   /api/admin/ingredients
```
Creation d'un ingredient APPROVED (inchange).

```
PATCH  /api/admin/ingredients/:id
```
Modification du nom et/ou du `defaultUnitId`. Peut aussi changer le status (approuver un PENDING).

```
DELETE /api/admin/ingredients/:id
```
Suppression (inchange, cascade sur RecipeIngredient).

```
POST   /api/admin/ingredients/:id/merge
```
Merge (logique enrichie pour gerer ProposalIngredient, voir section 5.4).

```
POST   /api/admin/ingredients/:id/approve
```
**NOUVEAU** - Approuver un ingredient PENDING. Optionnel : renommer en meme temps.

```json
{
  "newName": "poire"  // optionnel, pour corriger typo/nom
}
```

```
POST   /api/admin/ingredients/:id/reject
```
**NOUVEAU** - Rejeter un ingredient PENDING.

```json
{
  "reason": "Ingredient trop vague, precisez le type"  // obligatoire
}
```

---

## 9. Notifications (WebSocket)

Integration dans le systeme existant via `appEvents.emitActivity()`.

### 9.1 Evenements emis

| Evenement | Destinataire | Declencheur |
|-----------|-------------|-------------|
| `INGREDIENT_APPROVED` | Createur de l'ingredient | Admin approuve un ingredient PENDING |
| `INGREDIENT_MODIFIED` | Createur de l'ingredient | Admin approuve avec modification (rename) |
| `INGREDIENT_MERGED` | Createur de l'ingredient | Admin merge un ingredient PENDING |
| `INGREDIENT_REJECTED` | Createur de l'ingredient | Admin rejette un ingredient PENDING |

### 9.2 Payload des notifications

```typescript
appEvents.emitActivity({
  type: "INGREDIENT_REJECTED",  // ou APPROVED, MODIFIED, MERGED
  userId: adminId,
  communityId: null,            // global, pas de communaute
  targetUserIds: [ingredient.createdById],
  metadata: {
    ingredientName: "poire",
    reason: "...",              // uniquement pour REJECTED
    newName: "...",             // uniquement pour MODIFIED
    targetName: "...",          // uniquement pour MERGED
  },
});
```

### 9.3 Messages toast (frontend)

| Type | Message |
|------|---------|
| `INGREDIENT_APPROVED` | "Votre ingredient '[name]' a ete valide" |
| `INGREDIENT_MODIFIED` | "Votre ingredient a ete valide sous le nom '[newName]'" |
| `INGREDIENT_MERGED` | "Votre ingredient '[name]' a ete fusionne avec '[targetName]'" |
| `INGREDIENT_REJECTED` | "Votre ingredient '[name]' a ete rejete : [reason]" |

---

## 10. Validation

### 10.1 Ingredient

```typescript
{
  name: string, min: 2, max: 80, normalise (trim + lowercase)
}
```

### 10.2 Unit

```typescript
{
  name: string, min: 1, max: 50, unique
  abbreviation: string, min: 1, max: 20, unique
  category: UnitCategory (enum)
  sortOrder: int, default 0
}
```

### 10.3 RecipeIngredient / ProposalIngredient

```typescript
{
  ingredientId: UUID, required (FK vers Ingredient existant ou PENDING)
  quantity: float, optional, > 0 si present
  unitId: UUID, optional (FK vers Unit)
  order: int, >= 0
}
```

### 10.4 Limites

- Max **50 ingredients** par recette (eviter les abus)
- Pas de limite sur le nombre total d'ingredients (gere par admin)
- Pas de limite sur le nombre d'unites (gere par admin)

---

## 11. Migration de l'existant

### 11.1 Strategie

Comme seules des donnees de seed existent en production, la migration est simple :

```
1. Creer la table Unit et seeder les unites standard (section 3.1)
2. Ajouter les champs sur Ingredient : status (default APPROVED), defaultUnitId, createdById, createdAt, updatedAt
3. Modifier RecipeIngredient : quantity de String? a Float? (reset a null), ajouter unitId
4. Creer la table ProposalIngredient
5. Ajouter la relation ProposalIngredient sur RecipeUpdateProposal
6. Mettre a jour le seed des ingredients existants (status=APPROVED)
```

### 11.2 Donnees existantes

- Les ingredients seeds existants deviennent `status=APPROVED`, `createdById=null`
- Les `quantity` existantes (String) sont resetees a `null` (pas de parsing necessaire)
- Les RecipeIngredient existants ont `unitId=null` apres migration

---

## 12. Codes d'erreur (NOUVEAUX)

| Code | Message | Contexte |
|------|---------|----------|
| `INGREDIENT_001` | Ingredient non trouve | ID invalide ou supprime |
| `INGREDIENT_002` | Nom d'ingredient deja utilise | Unicite violee |
| `INGREDIENT_003` | Limite d'ingredients atteinte | >50 sur une recette |
| `INGREDIENT_004` | Unite non trouvee | unitId invalide |
| `INGREDIENT_005` | Unite en cours d'utilisation | Suppression d'une unite utilisee |
| `INGREDIENT_006` | Raison de rejet obligatoire | Admin rejette sans raison |
| `INGREDIENT_007` | Quantite invalide | Quantite <= 0 |
| `INGREDIENT_008` | Ingredient deja approuve | Tentative d'approuver un APPROVED |

---

## 13. Audit (AdminActivityLog)

### 13.1 Actions tracees

| Type (existant) | Usage |
|-----------------|-------|
| `INGREDIENT_CREATED` | Admin cree un ingredient |
| `INGREDIENT_UPDATED` | Admin modifie nom ou defaultUnitId |
| `INGREDIENT_DELETED` | Admin supprime un ingredient |
| `INGREDIENT_MERGED` | Admin merge deux ingredients |

| Type (nouveau) | Usage |
|----------------|-------|
| `INGREDIENT_APPROVED` | Admin approuve un PENDING (metadata: ingredientName, newName si modifie) |
| `INGREDIENT_REJECTED` | Admin rejette un PENDING (metadata: ingredientName, reason) |
| `UNIT_CREATED` | Admin cree une unite |
| `UNIT_UPDATED` | Admin modifie une unite |
| `UNIT_DELETED` | Admin supprime une unite |

---

## 14. Synchronisation (rappel)

Les ingredients sont synchronises lors du partage de recettes entre communautes (fork). Comme les ingredients sont globaux, il n'y a pas de probleme de portee : l'ingredient "poire" est le meme partout.

Lors d'un fork :
- Les RecipeIngredient sont copies tels quels (ingredientId, quantity, unitId, order)
- Aucune creation de doublon, aucune validation supplementaire

---

## 15. Impact sur les fonctionnalites existantes

### 15.1 Creation/edition de recette

- Le formulaire d'ingredients evolue : autocomplete + champ quantite numerique + dropdown unite
- L'upsert d'ingredients (`upsertIngredients`) est mis a jour pour gerer `quantity: Float`, `unitId`, et la creation en PENDING

### 15.2 Filtrage de recettes par ingredients

- Inchange : filtre par nom d'ingredient (query param `ingredients=poire,lait`)
- Les ingredients PENDING sont inclus dans le filtre (ils sont sur des recettes)

### 15.3 Panneau admin ingredients

- Evolue : ajout du filtre par status, actions approve/reject, affichage defaultUnit
- Ajout de la gestion des unites (nouveau panneau ou section)

### 15.4 Partage / Fork de recettes

- Les RecipeIngredient sont copies avec quantity + unitId (au lieu de quantity String)

### 15.5 Recettes orphelines

```
SI une recette devient orpheline (createur parti) :
  - Les ingredients restent sur la recette (APPROVED et PENDING)
  - Les ingredients PENDING restent dans la file admin
  - Le createdById de l'ingredient pointe vers un user soft-deleted (pas de cascade)
```

# Database Schema - Forest Manager

## Vue d'ensemble

Ce document décrit le schéma complet de la base de données PostgreSQL utilisée par Forest Manager, implémenté via Prisma ORM.

---

## Entités principales

### User (Utilisateur)

Représente un utilisateur de l'application.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `email` | String | Email unique |
| `username` | String | Nom d'utilisateur unique |
| `password` | String | Mot de passe hashé (bcrypt) |
| `createdAt` | DateTime | Date de création |
| `updatedAt` | DateTime | Dernière mise à jour |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- `userCommunities` → UserCommunity[] (communautés rejointes)
- `recipes` → Recipe[] (recettes personnelles)
- `proposals` → RecipeUpdateProposal[] (propositions faites)
- `activities` → ActivityLog[] (activités)
- `recipeViews` → RecipeView[] (vues de recettes)

---

### Community (Communauté)

Représente une communauté de partage de recettes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `name` | String | Nom de la communauté |
| `description` | String? | Description |
| `visibility` | Enum | Toujours "INVITE_ONLY" |
| `createdAt` | DateTime | Date de création |
| `updatedAt` | DateTime | Dernière mise à jour |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- `userCommunities` → UserCommunity[] (membres)
- `recipes` → Recipe[] (recettes partagées)
- `activities` → ActivityLog[] (activités)

---

### UserCommunity (Table pivot User-Community)

Lie les utilisateurs aux communautés avec leur rôle.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `userId` | UUID | FK vers User |
| `communityId` | UUID | FK vers Community |
| `role` | Enum | MEMBER ou ADMIN |
| `joinedAt` | DateTime | Date d'adhésion |
| `deletedAt` | DateTime? | Soft delete (quitter) |

**Contraintes:**
- Unique: (userId, communityId)

---

### Recipe (Recette)

Représente une recette de cuisine.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `title` | String | Titre de la recette |
| `content` | String | Contenu (markdown/rich text) |
| `imageUrl` | String? | URL de l'image (optionnel) |
| `creatorId` | UUID | FK vers User (créateur) |
| `communityId` | UUID? | FK vers Community (null = catalogue personnel) |
| `originRecipeId` | UUID? | FK vers Recipe (recette d'origine si fork/variante) |
| `sharedFromCommunityId` | UUID? | FK vers Community (communauté d'origine si partagé) |
| `isVariant` | Boolean | True si c'est une variante |
| `createdAt` | DateTime | Date de création |
| `updatedAt` | DateTime | Dernière mise à jour |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- `creator` → User
- `community` → Community?
- `originRecipe` → Recipe?
- `sharedFromCommunity` → Community?
- `variants` → Recipe[] (variantes de cette recette)
- `tags` → RecipeTag[]
- `proposals` → RecipeUpdateProposal[]
- `analytics` → RecipeAnalytics?
- `views` → RecipeView[]

---

### RecipeUpdateProposal (Proposition de mise à jour)

Stocke les propositions de modification de recettes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe (cible) |
| `proposerId` | UUID | FK vers User (proposant) |
| `proposedTitle` | String | Nouveau titre proposé |
| `proposedContent` | String | Nouveau contenu proposé |
| `status` | Enum | PENDING, ACCEPTED, REJECTED |
| `createdAt` | DateTime | Date de proposition |
| `decidedAt` | DateTime? | Date de décision |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- `recipe` → Recipe
- `proposer` → User

---

### Tag (Étiquette)

Représente un tag pour catégoriser les recettes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `name` | String | Nom du tag (unique) |

**Relations:**
- `recipes` → RecipeTag[]

---

### RecipeTag (Table pivot Recipe-Tag)

Lie les recettes aux tags (many-to-many).

| Champ | Type | Description |
|-------|------|-------------|
| `recipeId` | UUID | FK vers Recipe |
| `tagId` | UUID | FK vers Tag |

**Contraintes:**
- PK composite: (recipeId, tagId)

---

### Ingredient (Ingrédient)

Représente un ingrédient utilisé dans les recettes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `name` | String | Nom de l'ingrédient |

**Relations:**
- `recipeIngredients` → RecipeIngredient[]

---

### RecipeIngredient (Table pivot Recipe-Ingredient)

Lie les recettes aux ingrédients avec quantités.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe |
| `ingredientId` | UUID | FK vers Ingredient |
| `quantity` | String? | Quantité (ex: "200g", "2 cuillères") |
| `order` | Int | Ordre d'affichage |

---

### ActivityLog (Journal d'activité)

Stocke les événements pour le feed d'activité.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `type` | Enum | Type d'événement |
| `userId` | UUID | FK vers User (acteur) |
| `communityId` | UUID? | FK vers Community |
| `recipeId` | UUID? | FK vers Recipe |
| `metadata` | Json? | Données additionnelles |
| `createdAt` | DateTime | Date de l'événement |

**Types d'activité:**
- `RECIPE_CREATED` - Nouvelle recette créée
- `RECIPE_SHARED` - Recette partagée dans une communauté
- `VARIANT_PROPOSED` - Proposition de variante
- `VARIANT_CREATED` - Variante créée (après refus)
- `PROPOSAL_ACCEPTED` - Proposition acceptée
- `PROPOSAL_REJECTED` - Proposition refusée
- `USER_JOINED` - Utilisateur rejoint la communauté
- `USER_LEFT` - Utilisateur quitte la communauté
- `USER_PROMOTED` - Utilisateur promu admin

---

### RecipeAnalytics (Analytiques par recette)

Stocke les statistiques agrégées par recette.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe (unique) |
| `views` | Int | Nombre de vues |
| `shares` | Int | Nombre de partages |
| `forks` | Int | Nombre de forks |
| `lastUpdatedAt` | DateTime | Dernière mise à jour |

---

### RecipeView (Vue de recette)

Stocke les vues individuelles pour tracking détaillé.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe |
| `userId` | UUID? | FK vers User (null si anonyme) |
| `viewedAt` | DateTime | Date de vue |

---

## Enums

### Role (Rôle dans une communauté)
```
MEMBER  - Membre standard
ADMIN   - Administrateur
```

### Visibility (Visibilité de communauté)
```
INVITE_ONLY - Sur invitation uniquement (défaut et seule option MVP)
```

### ProposalStatus (Statut de proposition)
```
PENDING   - En attente de décision
ACCEPTED  - Acceptée
REJECTED  - Refusée
```

### ActivityType (Type d'activité)
```
RECIPE_CREATED
RECIPE_SHARED
VARIANT_PROPOSED
VARIANT_CREATED
PROPOSAL_ACCEPTED
PROPOSAL_REJECTED
USER_JOINED
USER_LEFT
USER_PROMOTED
```

---

## Diagramme des relations

```
User ─────────────────────────────────────────────────────┐
  │                                                       │
  │ 1:N                                                   │
  ▼                                                       │
UserCommunity ◄─────────── N:1 ──────────► Community      │
  │                                            │          │
  │ (role: MEMBER|ADMIN)                       │          │
  │                                            │ 1:N      │
  │                                            ▼          │
  │                                         Recipe ◄──────┘
  │                                            │   (creator)
  │                                            │
  │                                            │ 1:N (origin)
  │                                            ▼
  │                                      Recipe (variants)
  │                                            │
  │                                            │ N:M
  │                                            ▼
  │                                       RecipeTag ◄──► Tag
  │                                            │
  │                                            │ 1:N
  │                                            ▼
  │                              RecipeUpdateProposal
  │                                            │
  │                                            │ 1:1
  │                                            ▼
  │                                   RecipeAnalytics
  │
  └──────────────────────────────────► ActivityLog
```

---

## Index recommandés

```sql
-- Performance queries communes
CREATE INDEX idx_recipe_community ON Recipe(communityId);
CREATE INDEX idx_recipe_creator ON Recipe(creatorId);
CREATE INDEX idx_recipe_origin ON Recipe(originRecipeId);
CREATE INDEX idx_usercommunity_user ON UserCommunity(userId);
CREATE INDEX idx_usercommunity_community ON UserCommunity(communityId);
CREATE INDEX idx_activity_community ON ActivityLog(communityId);
CREATE INDEX idx_activity_created ON ActivityLog(createdAt);
CREATE INDEX idx_proposal_recipe ON RecipeUpdateProposal(recipeId);
CREATE INDEX idx_proposal_status ON RecipeUpdateProposal(status);

-- Soft delete filtering
CREATE INDEX idx_recipe_deleted ON Recipe(deletedAt) WHERE deletedAt IS NULL;
CREATE INDEX idx_community_deleted ON Community(deletedAt) WHERE deletedAt IS NULL;
```

---

## Notes d'implémentation

### Soft Delete
Toutes les entités principales utilisent un champ `deletedAt` pour le soft delete. Les queries doivent filtrer `WHERE deletedAt IS NULL` par défaut.

### UUID
Tous les identifiants sont des UUIDs v4 générés par Prisma (`@default(uuid())`).

### Timestamps
- `createdAt`: Auto-généré à la création
- `updatedAt`: Auto-mis à jour via `@updatedAt`

### Cascade Delete
Quand une communauté est supprimée (soft ou hard):
- Les UserCommunity associés sont marqués deletedAt
- Les recettes de la communauté sont marquées deletedAt
- Les ActivityLog sont conservés pour historique

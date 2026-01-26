# Database Schema - Forest Manager

## Vue d'ensemble

Ce document decrit le schema complet de la base de donnees PostgreSQL utilisee par Forest Manager, implemente via Prisma ORM.

**Strategie de suppression :** Soft delete gere cote applicatif (pas de cascade automatique sur les entites principales).

---

## Entites Techniques (Sessions)

### Session (Session Utilisateur)

Session pour les utilisateurs standard, geree via `@quixo3/prisma-session-store`.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant (PK) |
| `sid` | String | Session ID (unique) |
| `data` | String | Donnees serialisees |
| `expiresAt` | DateTime | Date d'expiration |

**Configuration:**
- Cookie: `connect.sid`
- Duree: 1h
- Secret: `SESSION_SECRET`

---

## Entites SuperAdmin (Isolees)

### AdminUser (Super Administrateur)

Compte administrateur plateforme, completement isole du systeme User.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `email` | String | Email unique |
| `username` | String | Nom d'utilisateur unique |
| `password` | String | Mot de passe hashe (bcrypt) |
| `totpSecret` | String | Secret TOTP pour 2FA |
| `totpEnabled` | Boolean | True apres configuration 2FA |
| `createdAt` | DateTime | Date de creation |
| `updatedAt` | DateTime | Derniere mise a jour |
| `lastLoginAt` | DateTime? | Derniere connexion |

**Relations:**
- `featuresGranted` -> CommunityFeature[] (features attribuees)
- `activities` -> AdminActivityLog[] (actions effectuees)

**Securite:**
- Authentification 2FA TOTP obligatoire (Google Authenticator)
- Session isolee (`AdminSession`)
- Cree uniquement via CLI serveur (`npm run admin:create`)

---

### AdminSession (Session Admin Isolee)

Session pour les SuperAdmin, completement separee des sessions utilisateurs.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant (PK) |
| `sid` | String | Session ID (unique) |
| `data` | String | Donnees serialisees |
| `expiresAt` | DateTime | Date d'expiration |

**Securite:**
- Cookie distinct: `admin.sid` (vs `connect.sid` pour users)
- Duree plus courte: 30 min (vs 1h pour users)
- Secret different: `ADMIN_SESSION_SECRET`

---

### Feature (Brique/Module)

Represente une fonctionnalite attribuable aux communautes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `code` | String | Code unique (ex: "MVP", "MEAL_PLANNER") |
| `name` | String | Nom affichable |
| `description` | String? | Description de la feature |
| `isDefault` | Boolean | Attribuee auto a la creation communaute |
| `createdAt` | DateTime | Date de creation |

**Relations:**
- `communities` -> CommunityFeature[] (communautes ayant cette feature)

**Features prevues:**
| Code | Nom | Default |
|------|-----|---------|
| `MVP` | Fonctionnalites de base | Oui |
| `MEAL_PLANNER` | Planificateur de repas | Non |

---

### CommunityFeature (Attribution Feature-Communaute)

Table pivot liant les features aux communautes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `communityId` | UUID | FK vers Community |
| `featureId` | UUID | FK vers Feature |
| `grantedAt` | DateTime | Date d'attribution |
| `grantedById` | UUID? | FK vers AdminUser (null si auto) |
| `revokedAt` | DateTime? | Date de revocation (soft) |

**Contraintes:**
- Unique: (communityId, featureId)

**Relations:**
- `community` -> Community
- `feature` -> Feature
- `grantedBy` -> AdminUser?

---

### AdminActivityLog (Audit Admin)

Journal des actions effectuees par les SuperAdmin.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `type` | Enum | Type d'action |
| `adminId` | UUID | FK vers AdminUser |
| `targetType` | String? | Type de cible ("Tag", "Community", etc.) |
| `targetId` | UUID? | ID de la cible |
| `metadata` | Json? | Donnees additionnelles |
| `createdAt` | DateTime | Date de l'action |

**Relations:**
- `admin` -> AdminUser

---

## Entites principales

### User (Utilisateur)

Represente un utilisateur de l'application.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `email` | String | Email unique |
| `username` | String | Nom d'utilisateur unique |
| `password` | String | Mot de passe hashe (bcrypt) |
| `createdAt` | DateTime | Date de creation |
| `updatedAt` | DateTime | Derniere mise a jour |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- `communities` -> UserCommunity[] (communautes rejointes)
- `recipes` -> Recipe[] (recettes personnelles)
- `proposals` -> RecipeUpdateProposal[] (propositions faites)
- `activities` -> ActivityLog[] (activites)
- `recipeViews` -> RecipeView[] (vues de recettes)
- `invitesSent` -> CommunityInvite[] (invitations envoyees)
- `invitesReceived` -> CommunityInvite[] (invitations recues)

---

### Community (Communaute)

Represente une communaute de partage de recettes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `name` | String | Nom de la communaute |
| `description` | String? | Description |
| `visibility` | Enum | Toujours "INVITE_ONLY" |
| `createdAt` | DateTime | Date de creation |
| `updatedAt` | DateTime | Derniere mise a jour |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- `members` -> UserCommunity[] (membres)
- `recipes` -> Recipe[] (recettes partagees)
- `activities` -> ActivityLog[] (activites)
- `invites` -> CommunityInvite[] (invitations en cours)
- `features` -> CommunityFeature[] (briques attribuees)

---

### UserCommunity (Table pivot User-Community)

Lie les utilisateurs aux communautes avec leur role.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `userId` | UUID | FK vers User |
| `communityId` | UUID | FK vers Community |
| `role` | Enum | MEMBER ou ADMIN |
| `joinedAt` | DateTime | Date d'adhesion |
| `deletedAt` | DateTime? | Soft delete (quitter/kick) |

**Contraintes:**
- Unique: (userId, communityId)

**Note:** Pas de cascade - soft delete gere cote applicatif.

---

### CommunityInvite (Invitation a une communaute)

Gere le systeme d'invitation avec acceptation explicite.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `communityId` | UUID | FK vers Community |
| `inviterId` | UUID | FK vers User (admin qui invite) |
| `inviteeId` | UUID | FK vers User (utilisateur invite) |
| `status` | Enum | PENDING, ACCEPTED, REJECTED, CANCELLED |
| `createdAt` | DateTime | Date d'envoi |
| `respondedAt` | DateTime? | Date de reponse |
| `deletedAt` | DateTime? | Soft delete |

**Contraintes:**
- Pas de contrainte unique DB (historique des invitations conserve)
- Contrainte "une seule PENDING par user/community" geree cote applicatif
- Index composite: (communityId, inviteeId, status) pour verification rapide

**Relations:**
- `community` -> Community
- `inviter` -> User (admin)
- `invitee` -> User (invite)

---

### Recipe (Recette)

Represente une recette de cuisine.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `title` | String | Titre de la recette |
| `content` | String | Contenu (markdown/rich text) |
| `imageUrl` | String? | URL de l'image (optionnel, V1) |
| `creatorId` | UUID | FK vers User (createur) |
| `communityId` | UUID? | FK vers Community (null = catalogue personnel) |
| `originRecipeId` | UUID? | FK vers Recipe (recette d'origine) |
| `sharedFromCommunityId` | UUID? | FK vers Community (origine si fork) |
| `isVariant` | Boolean | True si c'est une variante |
| `createdAt` | DateTime | Date de creation |
| `updatedAt` | DateTime | Derniere mise a jour |
| `deletedAt` | DateTime? | Soft delete |

**Interpretation de originRecipeId :**
- Si `originRecipe.communityId == null` -> lien vers recette personnelle
- Si `isVariant == true` -> c'est une variante (proposition refusee)
- Si `sharedFromCommunityId != null` -> c'est un fork inter-communautes

**Relations:**
- `creator` -> User
- `community` -> Community?
- `originRecipe` -> Recipe?
- `sharedFromCommunity` -> Community?
- `variants` -> Recipe[] (variantes de cette recette)
- `tags` -> RecipeTag[]
- `ingredients` -> RecipeIngredient[]
- `proposals` -> RecipeUpdateProposal[]
- `analytics` -> RecipeAnalytics?
- `views` -> RecipeView[]

---

### RecipeUpdateProposal (Proposition de mise a jour)

Stocke les propositions de modification de recettes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe (cible) |
| `proposerId` | UUID | FK vers User (proposant) |
| `proposedTitle` | String | Nouveau titre propose |
| `proposedContent` | String | Nouveau contenu propose |
| `status` | Enum | PENDING, ACCEPTED, REJECTED |
| `createdAt` | DateTime | Date de proposition |
| `decidedAt` | DateTime? | Date de decision |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- `recipe` -> Recipe
- `proposer` -> User

**Note:** Les deux champs `proposedTitle` et `proposedContent` sont obligatoires. Une proposition est une version complete suggeree, pas une modification partielle.

---

### Tag (Etiquette)

Represente un tag pour categoriser les recettes.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `name` | String | Nom du tag (unique) |

**Relations:**
- `recipes` -> RecipeTag[]

---

### RecipeTag (Table pivot Recipe-Tag)

Lie les recettes aux tags (many-to-many).

| Champ | Type | Description |
|-------|------|-------------|
| `recipeId` | UUID | FK vers Recipe |
| `tagId` | UUID | FK vers Tag |

**Contraintes:**
- PK composite: (recipeId, tagId)

**Note:** Cascade OK - hard delete quand la recette est supprimee.

---

### Ingredient (Ingredient)

Represente un ingredient utilise dans les recettes. Cree a la volee comme les tags.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `name` | String | Nom de l'ingredient (unique) |

**Relations:**
- `recipes` -> RecipeIngredient[]

---

### RecipeIngredient (Table pivot Recipe-Ingredient)

Lie les recettes aux ingredients avec quantites.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe |
| `ingredientId` | UUID | FK vers Ingredient |
| `quantity` | String? | Quantite (ex: "200g", "2 cuilleres") |
| `order` | Int | Ordre d'affichage |

**Contraintes:**
- Unique: (recipeId, ingredientId)

**Note:** Cascade OK - hard delete quand la recette est supprimee.

---

### ActivityLog (Journal d'activite)

Stocke les evenements pour le feed d'activite (communautaire et personnel).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `type` | Enum | Type d'evenement |
| `userId` | UUID | FK vers User (acteur) |
| `communityId` | UUID? | FK vers Community |
| `recipeId` | UUID? | FK vers Recipe |
| `metadata` | Json? | Donnees additionnelles |
| `createdAt` | DateTime | Date de l'evenement |

**Types d'activite:**

| Type | Description |
|------|-------------|
| `RECIPE_CREATED` | Nouvelle recette creee |
| `RECIPE_UPDATED` | Recette mise a jour |
| `RECIPE_DELETED` | Recette supprimee |
| `RECIPE_SHARED` | Recette partagee (fork) |
| `VARIANT_PROPOSED` | Proposition de variante |
| `VARIANT_CREATED` | Variante creee (apres refus) |
| `PROPOSAL_ACCEPTED` | Proposition acceptee |
| `PROPOSAL_REJECTED` | Proposition refusee |
| `USER_JOINED` | Utilisateur rejoint (invitation acceptee) |
| `USER_LEFT` | Utilisateur quitte |
| `USER_KICKED` | Membre retire par admin |
| `USER_PROMOTED` | Utilisateur promu admin |
| `INVITE_SENT` | Invitation envoyee |
| `INVITE_ACCEPTED` | Invitation acceptee |
| `INVITE_REJECTED` | Invitation refusee |
| `INVITE_CANCELLED` | Invitation annulee par admin |

---

### RecipeAnalytics (Analytiques par recette)

Stocke les statistiques agregees par recette. Prepare pour le futur.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe (unique) |
| `views` | Int | Nombre de vues |
| `shares` | Int | Nombre de partages |
| `forks` | Int | Nombre de forks |
| `lastUpdatedAt` | DateTime | Derniere mise a jour |

---

### RecipeView (Vue de recette)

Stocke les vues individuelles pour tracking detaille.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique (PK) |
| `recipeId` | UUID | FK vers Recipe |
| `userId` | UUID? | FK vers User (null si anonyme) |
| `viewedAt` | DateTime | Date de vue |

---

## Enums

### Role (Role dans une communaute)
```
MEMBER  - Membre standard
ADMIN   - Administrateur
```

### Visibility (Visibilite de communaute)
```
INVITE_ONLY - Sur invitation uniquement (defaut et seule option MVP)
```

### InviteStatus (Statut d'invitation)
```
PENDING   - En attente de reponse
ACCEPTED  - Acceptee (utilisateur rejoint)
REJECTED  - Refusee par l'invite
CANCELLED - Annulee par l'admin
```

### ProposalStatus (Statut de proposition)
```
PENDING   - En attente de decision
ACCEPTED  - Acceptee
REJECTED  - Refusee
```

### ActivityType (Type d'activite)
```
// Recettes
RECIPE_CREATED
RECIPE_UPDATED
RECIPE_DELETED
RECIPE_SHARED

// Variantes et propositions
VARIANT_PROPOSED
VARIANT_CREATED
PROPOSAL_ACCEPTED
PROPOSAL_REJECTED

// Membres
USER_JOINED
USER_LEFT
USER_KICKED
USER_PROMOTED

// Invitations
INVITE_SENT
INVITE_ACCEPTED
INVITE_REJECTED
INVITE_CANCELLED
```

### AdminActionType (Type d'action admin)
```
// Tags
TAG_CREATED
TAG_UPDATED
TAG_DELETED
TAG_MERGED

// Ingredients
INGREDIENT_CREATED
INGREDIENT_UPDATED
INGREDIENT_DELETED
INGREDIENT_MERGED

// Communities
COMMUNITY_RENAMED
COMMUNITY_DELETED

// Features
FEATURE_CREATED
FEATURE_UPDATED
FEATURE_GRANTED
FEATURE_REVOKED

// Admin auth
ADMIN_LOGIN
ADMIN_LOGOUT
ADMIN_TOTP_SETUP
```

---

## Diagramme des relations

### Sessions (Technique)

```
Session ──────────── Sessions utilisateurs standards
                     (connect.sid, 1h, SESSION_SECRET)

AdminSession ─────── Sessions SuperAdmin isolees
                     (admin.sid, 30min, ADMIN_SESSION_SECRET)
```

### Domaine Utilisateurs

```
User ─────────────────────────────────────────────────────────┐
  │                                                           │
  │ 1:N                                                       │
  ▼                                                           │
UserCommunity ◄─────────── N:1 ──────────► Community          │
  │                                            │              │
  │ (role: MEMBER|ADMIN)                       │              │
  │                                            │ 1:N          │
  │                                            ▼              │
  │                        CommunityInvite ◄───┘              │
  │                          │                                │
  │                          │ (inviter, invitee)             │
  │                          ▼                                │
  │                        User                               │
  │                                                           │
  │                                         Recipe ◄──────────┘
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
  │                                            │ N:M
  │                                            ▼
  │                                   RecipeIngredient ◄──► Ingredient
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

### Domaine SuperAdmin (Isole)

```
AdminUser ────────────────────────────────────────┐
  │                                               │
  │ 1:N                                           │
  ▼                                               │
AdminActivityLog                                  │
                                                  │
  │                                               │
  │ (grantedBy)                                   │
  ▼                                               │
CommunityFeature ◄───── N:1 ────► Feature         │
  │                                               │
  │ N:1                                           │
  ▼                                               │
Community ◄───────────────────────────────────────┘
```

---

## Index recommandes

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
CREATE INDEX idx_invite_invitee ON CommunityInvite(inviteeId);
CREATE INDEX idx_invite_status ON CommunityInvite(status);

-- SuperAdmin indexes
CREATE INDEX idx_adminuser_email ON AdminUser(email);
CREATE INDEX idx_adminuser_username ON AdminUser(username);
CREATE INDEX idx_feature_code ON Feature(code);
CREATE INDEX idx_communityfeature_community ON CommunityFeature(communityId);
CREATE INDEX idx_communityfeature_feature ON CommunityFeature(featureId);
CREATE INDEX idx_adminactivity_admin ON AdminActivityLog(adminId);
CREATE INDEX idx_adminactivity_type ON AdminActivityLog(type);
CREATE INDEX idx_adminactivity_created ON AdminActivityLog(createdAt);

-- Soft delete filtering
CREATE INDEX idx_recipe_deleted ON Recipe(deletedAt) WHERE deletedAt IS NULL;
CREATE INDEX idx_community_deleted ON Community(deletedAt) WHERE deletedAt IS NULL;
CREATE INDEX idx_usercommunity_deleted ON UserCommunity(deletedAt) WHERE deletedAt IS NULL;
CREATE INDEX idx_invite_deleted ON CommunityInvite(deletedAt) WHERE deletedAt IS NULL;
```

---

## Notes d'implementation

### Soft Delete
- Toutes les entites principales utilisent un champ `deletedAt`
- Les queries doivent filtrer `WHERE deletedAt IS NULL` par defaut
- Gere cote applicatif (pas de cascade DB automatique)
- Les tables pivot (RecipeTag, RecipeIngredient) utilisent hard delete via Cascade

### UUID
Tous les identifiants sont des UUIDs v4 generes par Prisma (`@default(uuid())`).

### Timestamps
- `createdAt`: Auto-genere a la creation
- `updatedAt`: Auto-mis a jour via `@updatedAt`

### Session Store
Sessions utilisateurs gerees via `@quixo3/prisma-session-store` avec le model `Session`.
Sessions admin gerees separement via le model `AdminSession`.

| Type | Model | Cookie | Duree | Secret |
|------|-------|--------|-------|--------|
| User | `Session` | `connect.sid` | 1h | `SESSION_SECRET` |
| Admin | `AdminSession` | `admin.sid` | 30min | `ADMIN_SESSION_SECRET` |

### Ingredients
Crees a la volee comme les tags : si l'ingredient existe, on le reutilise, sinon on le cree.

### Features (Briques)
La feature `MVP` avec `isDefault: true` est automatiquement attribuee a toute nouvelle communaute.
Les autres features sont attribuees manuellement par un SuperAdmin.

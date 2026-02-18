# API Specification - Forest Manager

## Vue d'ensemble

API REST pour Forest Manager. Base URL: `/api`

Toutes les routes (sauf auth) necessitent une session valide.

---

## Authentication

### POST /api/auth/signup
Inscription d'un nouvel utilisateur.

**Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securePassword123"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Errors:**
- `400` - Validation error
- `409` - Email or username already exists

---

### POST /api/auth/login
Authentification d'un utilisateur.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe"
}
```

**Errors:**
- `400` - Invalid credentials
- `401` - Unauthorized

---

### POST /api/auth/logout
Deconnexion.

**Response 200:**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/me
Recupere l'utilisateur courant.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Errors:**
- `401` - Not authenticated

---

## Users

### GET /api/users/:id
Recupere un profil utilisateur public.

**Response 200:**
```json
{
  "id": "uuid",
  "username": "johndoe",
  "createdAt": "2024-01-15T10:00:00Z",
  "recipesCount": 15,
  "communitiesCount": 3
}
```

---

### GET /api/users/:id/recipes
Liste des recettes personnelles d'un utilisateur (seulement les siennes si authentifie comme cet utilisateur).

**Query params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Tarte aux pommes",
      "createdAt": "2024-01-15T10:00:00Z",
      "tags": ["dessert", "fruit"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### GET /api/users/me/invites
Liste des invitations recues par l'utilisateur connecte.

**Query params:**
- `status` (default: "PENDING") - PENDING, ACCEPTED, REJECTED, ou "all"

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "community": {
        "id": "uuid",
        "name": "Les Gourmands",
        "description": "Communaute de passionnes"
      },
      "inviter": {
        "id": "uuid",
        "username": "admin_user"
      },
      "status": "PENDING",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /api/users/me/activity
Feed d'activite personnel (propositions sur mes recettes, etc.).

**Query params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "VARIANT_PROPOSED",
      "user": {
        "id": "uuid",
        "username": "contributor"
      },
      "recipe": {
        "id": "uuid",
        "title": "Tarte aux pommes"
      },
      "community": {
        "id": "uuid",
        "name": "Les Gourmands"
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {...}
}
```

---

## Invites

### POST /api/invites/:id/accept
Accepte une invitation recue.

**Response 200:**
```json
{
  "message": "Invitation accepted",
  "community": {
    "id": "uuid",
    "name": "Les Gourmands"
  }
}
```

**Errors:**
- `404` - Invite not found
- `400` - Invite not pending (already processed)
- `403` - Not the invitee

---

### POST /api/invites/:id/reject
Refuse une invitation recue.

**Response 200:**
```json
{
  "message": "Invitation rejected"
}
```

**Errors:**
- `404` - Invite not found
- `400` - Invite not pending
- `403` - Not the invitee

---

## Communities

### GET /api/communities
Liste les communautes de l'utilisateur connecte.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Les Gourmands",
      "description": "Communaute de passionnes de cuisine",
      "role": "ADMIN",
      "membersCount": 12,
      "recipesCount": 45,
      "joinedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST /api/communities
Cree une nouvelle communaute.

**Body:**
```json
{
  "name": "Les Gourmands",
  "description": "Communaute de passionnes de cuisine"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "Les Gourmands",
  "description": "Communaute de passionnes de cuisine",
  "visibility": "INVITE_ONLY",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

### GET /api/communities/:id
Details d'une communaute.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Les Gourmands",
  "description": "Communaute de passionnes de cuisine",
  "visibility": "INVITE_ONLY",
  "createdAt": "2024-01-15T10:00:00Z",
  "membersCount": 12,
  "recipesCount": 45,
  "currentUserRole": "ADMIN"
}
```

**Errors:**
- `403` - Not a member
- `404` - Community not found

---

### PATCH /api/communities/:id
Modifie une communaute (admin only).

**Body:**
```json
{
  "name": "Nouveau nom",
  "description": "Nouvelle description"
}
```

**Response 200:** Communaute mise a jour

**Errors:**
- `403` - Not admin

---

### GET /api/communities/:id/members
Liste les membres d'une communaute.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "username": "johndoe",
      "role": "ADMIN",
      "joinedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### DELETE /api/communities/:id/members/:userId
Quitte la communaute (self) ou retire un membre (admin kick).

**Response 200:**
```json
{
  "message": "Left community successfully"
}
```
ou
```json
{
  "message": "Member removed successfully"
}
```

**Errors:**
- `403` - Last admin must promote another first
- `403` - Cannot kick an admin
- `410` - Community deleted (was last member)

---

### PATCH /api/communities/:id/members/:userId
Modifie le role d'un membre (promotion uniquement, admin only).

**Body:**
```json
{
  "role": "ADMIN"
}
```

**Response 200:**
```json
{
  "message": "User promoted to ADMIN"
}
```

**Errors:**
- `403` - Not admin or trying to demote

---

### GET /api/communities/:id/invites
Liste les invitations d'une communaute (admin only).

**Query params:**
- `status` (default: "PENDING") - PENDING, ACCEPTED, REJECTED, CANCELLED, ou "all"

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "invitee": {
        "id": "uuid",
        "username": "newuser",
        "email": "new@example.com"
      },
      "inviter": {
        "id": "uuid",
        "username": "admin_user"
      },
      "status": "PENDING",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Errors:**
- `403` - Not admin

---

### POST /api/communities/:id/invites
Envoie une invitation (admin only).

**Body:**
```json
{
  "userId": "uuid"
}
```
ou
```json
{
  "email": "user@example.com"
}
```
ou
```json
{
  "username": "johndoe"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "invitee": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com"
  },
  "status": "PENDING",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Errors:**
- `403` - Not admin
- `404` - User not found
- `409` - Already a member
- `409` - Invite already pending

---

### DELETE /api/communities/:id/invites/:inviteId
Annule une invitation en attente (admin only).

**Response 200:**
```json
{
  "message": "Invitation cancelled"
}
```

**Errors:**
- `403` - Not admin
- `404` - Invite not found
- `400` - Invite not pending

---

### GET /api/communities/:id/activity
Feed d'activite de la communaute.

**Query params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "RECIPE_CREATED",
      "user": {
        "id": "uuid",
        "username": "johndoe"
      },
      "recipe": {
        "id": "uuid",
        "title": "Tarte aux pommes"
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {...}
}
```

---

## Recipes

### GET /api/recipes
Liste des recettes (catalogue personnel de l'utilisateur connecte).

**Query params:**
- `page` (default: 1)
- `limit` (default: 20)
- `tags` - Filtre par tags (comma-separated)
- `search` - Recherche par titre

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Tarte aux pommes",
      "imageUrl": "https://...",
      "tags": ["dessert", "fruit"],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {...}
}
```

---

### GET /api/communities/:communityId/recipes
Liste des recettes d'une communaute.

**Query params:**
- `page`, `limit`, `tags`, `search`

**Response 200:** Meme format que GET /api/recipes

---

### POST /api/recipes
Cree une recette dans le catalogue personnel.

**Body:**
```json
{
  "title": "Tarte aux pommes",
  "content": "## Ingredients\n- 4 pommes...",
  "imageUrl": "https://...",
  "tags": ["dessert", "fruit"],
  "ingredients": [
    { "name": "Pommes", "quantity": "4" },
    { "name": "Sucre", "quantity": "100g" }
  ]
}
```

**Response 201:** Recette creee

---

### POST /api/communities/:communityId/recipes
Cree une recette dans une communaute (+ copie dans catalogue personnel).

**Body:** Meme format que POST /api/recipes

**Response 201:**
```json
{
  "personal": { ... },
  "community": { ... }
}
```

---

### GET /api/recipes/:id
Details d'une recette.

**Response 200:**
```json
{
  "id": "uuid",
  "title": "Tarte aux pommes",
  "content": "...",
  "imageUrl": "https://...",
  "creator": {
    "id": "uuid",
    "username": "johndoe"
  },
  "community": {
    "id": "uuid",
    "name": "Les Gourmands"
  },
  "tags": ["dessert", "fruit"],
  "ingredients": [
    { "name": "Pommes", "quantity": "4" },
    { "name": "Sucre", "quantity": "100g" }
  ],
  "isVariant": false,
  "originRecipe": null,
  "sharedFrom": null,
  "variantsCount": 3,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

---

### GET /api/recipes/:id/variants
Liste les variantes d'une recette.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Tarte aux pommes - Version sans gluten",
      "creator": {
        "id": "uuid",
        "username": "baker42"
      },
      "createdAt": "2024-01-20T10:00:00Z"
    }
  ]
}
```

---

### PATCH /api/recipes/:id
Modifie une recette (createur only).

**Body:**
```json
{
  "title": "Nouveau titre",
  "content": "Nouveau contenu",
  "tags": ["updated", "tags"],
  "ingredients": [...]
}
```

**Response 200:** Recette mise a jour

---

### DELETE /api/recipes/:id
Supprime une recette (soft delete, createur only).

**Response 200:**
```json
{
  "message": "Recipe deleted"
}
```

---

### POST /api/recipes/:id/share
Fork une recette vers une autre communaute.

**Body:**
```json
{
  "targetCommunityId": "uuid"
}
```

**Response 201:**
```json
{
  "message": "Recipe shared successfully",
  "forkedRecipe": { ... }
}
```

**Errors:**
- `403` - Not member of both communities or insufficient permissions

---

## Proposals

### GET /api/recipes/:id/proposals
Liste des propositions sur une recette.

**Query params:**
- `status` - Filtre: PENDING, ACCEPTED, REJECTED (default: all)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "proposer": {
        "id": "uuid",
        "username": "contributor"
      },
      "proposedTitle": "Tarte aux pommes - amelioree",
      "status": "PENDING",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST /api/recipes/:id/proposals
Cree une proposition de mise a jour.

**Body:**
```json
{
  "proposedTitle": "Tarte aux pommes - amelioree",
  "proposedContent": "## Nouvelle recette..."
}
```

**Response 201:** Proposition creee

**Errors:**
- `403` - Not a community member or proposing on own recipe

---

### GET /api/proposals/:id
Details d'une proposition.

**Response 200:**
```json
{
  "id": "uuid",
  "recipe": {
    "id": "uuid",
    "title": "Tarte aux pommes"
  },
  "proposer": {
    "id": "uuid",
    "username": "contributor"
  },
  "proposedTitle": "Tarte aux pommes - amelioree",
  "proposedContent": "...",
  "status": "PENDING",
  "createdAt": "2024-01-15T10:00:00Z",
  "decidedAt": null
}
```

---

### POST /api/proposals/:id/accept
Accepte une proposition (createur de la recette only).

**Response 200:**
```json
{
  "message": "Proposal accepted",
  "updatedRecipe": { ... }
}
```

---

### POST /api/proposals/:id/reject
Refuse une proposition et cree une variante.

**Response 200:**
```json
{
  "message": "Proposal rejected, variant created",
  "variant": { ... }
}
```

---

## Tags

### GET /api/tags
Liste tous les tags (avec nombre d'utilisations).

**Query params:**
- `search` - Recherche par nom

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "dessert",
      "recipesCount": 42
    }
  ]
}
```

---

### GET /api/communities/:id/tags
Tags utilises dans une communaute.

**Response 200:** Meme format

---

## Ingredients

### GET /api/ingredients
Liste tous les ingredients (avec nombre d'utilisations).

**Query params:**
- `search` - Recherche par nom

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Pommes",
      "recipesCount": 15
    }
  ]
}
```

---

## Users Search (pour invitations)

### GET /api/users/search
Recherche d'utilisateurs par username ou email (pour invitations).

**Query params:**
- `q` - Terme de recherche (min 3 caracteres)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com"
    }
  ]
}
```

**Note:** Limite a 10 resultats. N'affiche pas les utilisateurs deja membres de la communaute cible si `communityId` est fourni.

---

## Pagination

Toutes les routes paginees utilisent le format:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Error Response Format

```json
{
  "error": {
    "code": "AUTH_001",
    "message": "Not authenticated",
    "details": {}
  }
}
```

---

## Error Codes

| Code | HTTP Status | Message |
|------|-------------|---------|
| `AUTH_001` | 401 | Non authentifie |
| `AUTH_002` | 401 | Session expiree |
| `COMMUNITY_001` | 403 | Non membre |
| `COMMUNITY_002` | 403 | Permission insuffisante |
| `COMMUNITY_003` | 400 | Dernier admin |
| `COMMUNITY_004` | 409 | Utilisateur deja membre |
| `COMMUNITY_005` | 409 | Invitation deja envoyee |
| `COMMUNITY_006` | 403 | Impossible de retirer un admin |
| `RECIPE_001` | 404 | Recette non trouvee |
| `RECIPE_002` | 403 | Non proprietaire |
| `PROPOSAL_001` | 403 | Proposition invalide |
| `PROPOSAL_002` | 400 | Deja decidee |
| `SHARE_001` | 403 | Non membre source |
| `SHARE_002` | 403 | Non membre cible |
| `SHARE_003` | 403 | Permission partage |
| `INVITE_001` | 404 | Invitation non trouvee |
| `INVITE_002` | 400 | Invitation deja traitee (status non PENDING) |
| `INVITE_003` | 404 | Utilisateur non trouve |

---

## Rate Limiting (futur)

- 100 requests/minute pour les routes authentifiees
- 20 requests/minute pour les routes non authentifiees
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

# Admin API

API d'administration plateforme. Completement isolee de l'API utilisateur.

**Base URL:** `/api/admin`

**Authentification:** Session admin separee + 2FA TOTP obligatoire.

---

## Admin Authentication

### POST /api/admin/auth/login
Authentification SuperAdmin.

**Premiere connexion (2FA non configure):**

**Body:**
```json
{
  "username": "admin",
  "password": "securePassword123"
}
```

**Response 200 (setup required):**
```json
{
  "requireTotpSetup": true,
  "totpSecret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

**Connexions suivantes:**

**Body:**
```json
{
  "username": "admin",
  "password": "securePassword123",
  "totpToken": "123456"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "username": "admin",
  "email": "admin@example.com",
  "lastLoginAt": "2024-01-15T10:00:00Z"
}
```

**Errors:**
- `401` - Invalid credentials
- `401` - Invalid TOTP token
- `403` - 2FA not configured

---

### POST /api/admin/auth/totp/verify
Verifie le token TOTP lors du setup initial.

**Body:**
```json
{
  "token": "123456"
}
```

**Response 200:**
```json
{
  "message": "2FA configured successfully",
  "admin": {
    "id": "uuid",
    "username": "admin"
  }
}
```

**Errors:**
- `400` - Invalid token
- `400` - 2FA already configured

---

### POST /api/admin/auth/logout
Deconnexion admin.

**Response 200:**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/admin/auth/me
Recupere l'admin courant.

**Response 200:**
```json
{
  "id": "uuid",
  "username": "admin",
  "email": "admin@example.com",
  "lastLoginAt": "2024-01-15T10:00:00Z"
}
```

---

## Admin Tags Management

### GET /api/admin/tags
Liste tous les tags avec statistiques.

**Query params:**
- `search` - Recherche par nom
- `page` (default: 1)
- `limit` (default: 50)
- `sortBy` - name, recipesCount (default: name)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "dessert",
      "recipesCount": 42,
      "communitiesCount": 5
    }
  ],
  "pagination": {...}
}
```

---

### POST /api/admin/tags
Cree un nouveau tag.

**Body:**
```json
{
  "name": "nouveau-tag"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "nouveau-tag"
}
```

---

### PATCH /api/admin/tags/:id
Renomme un tag.

**Body:**
```json
{
  "name": "nouveau-nom"
}
```

**Response 200:** Tag mis a jour

---

### DELETE /api/admin/tags/:id
Supprime un tag (hard delete).

**Response 200:**
```json
{
  "message": "Tag deleted",
  "recipesAffected": 15
}
```

---

### POST /api/admin/tags/:id/merge
Fusionne un tag dans un autre.

**Body:**
```json
{
  "targetTagId": "uuid"
}
```

**Response 200:**
```json
{
  "message": "Tag merged successfully",
  "recipesUpdated": 15,
  "targetTag": {
    "id": "uuid",
    "name": "target-tag",
    "recipesCount": 57
  }
}
```

---

## Admin Ingredients Management

### GET /api/admin/ingredients
Liste tous les ingredients avec statistiques.

**Query params:** Memes que tags

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Pommes",
      "recipesCount": 28
    }
  ],
  "pagination": {...}
}
```

---

### POST /api/admin/ingredients
Cree un nouvel ingredient.

**Body:**
```json
{
  "name": "Nouvel ingredient"
}
```

---

### PATCH /api/admin/ingredients/:id
Renomme un ingredient.

---

### DELETE /api/admin/ingredients/:id
Supprime un ingredient (hard delete).

---

### POST /api/admin/ingredients/:id/merge
Fusionne un ingredient dans un autre.

**Body:**
```json
{
  "targetIngredientId": "uuid"
}
```

---

## Admin Communities Management

### GET /api/admin/communities
Liste toutes les communautes avec statistiques.

**Query params:**
- `search` - Recherche par nom
- `page`, `limit`
- `sortBy` - name, membersCount, recipesCount, createdAt

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Les Gourmands",
      "description": "...",
      "membersCount": 12,
      "recipesCount": 45,
      "adminsCount": 2,
      "features": ["MVP"],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {...},
  "stats": {
    "totalCommunities": 150,
    "totalMembers": 1200,
    "totalRecipes": 5000
  }
}
```

---

### GET /api/admin/communities/:id
Details complets d'une communaute.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Les Gourmands",
  "description": "...",
  "visibility": "INVITE_ONLY",
  "members": [
    {
      "id": "uuid",
      "username": "johndoe",
      "role": "ADMIN",
      "joinedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "features": [
    {
      "code": "MVP",
      "name": "Fonctionnalites de base",
      "grantedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "stats": {
    "recipesCount": 45,
    "activeMembers30d": 8,
    "proposalsCount": 12
  },
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

### PATCH /api/admin/communities/:id
Modifie une communaute.

**Body:**
```json
{
  "name": "Nouveau nom",
  "description": "Nouvelle description"
}
```

---

### DELETE /api/admin/communities/:id
Soft delete une communaute (et tous ses membres).

**Response 200:**
```json
{
  "message": "Community deleted",
  "membersAffected": 12,
  "recipesAffected": 45
}
```

---

## Admin Features Management

### GET /api/admin/features
Liste toutes les features disponibles.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "MVP",
      "name": "Fonctionnalites de base",
      "description": "Catalogue de recettes, communautes, partage",
      "isDefault": true,
      "communitiesCount": 150
    },
    {
      "id": "uuid",
      "code": "MEAL_PLANNER",
      "name": "Planificateur de repas",
      "description": "Planification hebdomadaire des repas",
      "isDefault": false,
      "communitiesCount": 12
    }
  ]
}
```

---

### POST /api/admin/features
Cree une nouvelle feature.

**Body:**
```json
{
  "code": "NEW_FEATURE",
  "name": "Nouvelle fonctionnalite",
  "description": "Description de la feature",
  "isDefault": false
}
```

---

### PATCH /api/admin/features/:id
Modifie une feature.

**Body:**
```json
{
  "name": "Nouveau nom",
  "description": "Nouvelle description"
}
```

**Note:** Le `code` et `isDefault` ne peuvent pas etre modifies apres creation.

---

### GET /api/admin/communities/:id/features
Liste les features d'une communaute.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "MVP",
      "name": "Fonctionnalites de base",
      "grantedAt": "2024-01-15T10:00:00Z",
      "grantedBy": null
    }
  ],
  "available": [
    {
      "id": "uuid",
      "code": "MEAL_PLANNER",
      "name": "Planificateur de repas"
    }
  ]
}
```

---

### POST /api/admin/communities/:id/features/:featureId
Attribue une feature a une communaute.

**Response 201:**
```json
{
  "message": "Feature granted",
  "feature": {
    "code": "MEAL_PLANNER",
    "name": "Planificateur de repas",
    "grantedAt": "2024-01-15T10:00:00Z"
  }
}
```

**Errors:**
- `409` - Feature already granted

---

### DELETE /api/admin/communities/:id/features/:featureId
Revoque une feature d'une communaute.

**Response 200:**
```json
{
  "message": "Feature revoked"
}
```

**Errors:**
- `400` - Cannot revoke default feature (MVP)

---

## Admin Dashboard

### GET /api/admin/dashboard/stats
Statistiques globales de la plateforme.

**Response 200:**
```json
{
  "users": {
    "total": 1500,
    "active30d": 800,
    "new7d": 50
  },
  "communities": {
    "total": 150,
    "active30d": 120
  },
  "recipes": {
    "total": 5000,
    "new7d": 200,
    "proposals": {
      "pending": 45,
      "accepted7d": 30,
      "rejected7d": 15
    }
  },
  "features": {
    "MVP": 150,
    "MEAL_PLANNER": 12
  }
}
```

---

### GET /api/admin/activity
Journal d'activite admin.

**Query params:**
- `page`, `limit`
- `type` - Filtre par type d'action
- `adminId` - Filtre par admin

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "TAG_MERGED",
      "admin": {
        "id": "uuid",
        "username": "admin"
      },
      "targetType": "Tag",
      "targetId": "uuid",
      "metadata": {
        "sourceTag": "desserts",
        "targetTag": "dessert",
        "recipesUpdated": 15
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {...}
}
```

---

## Admin Error Codes

| Code | HTTP Status | Message |
|------|-------------|---------|
| `ADMIN_001` | 401 | Non authentifie (admin) |
| `ADMIN_002` | 401 | 2FA requis |
| `ADMIN_003` | 401 | Token TOTP invalide |
| `ADMIN_004` | 400 | 2FA deja configure |
| `ADMIN_005` | 404 | Tag non trouve |
| `ADMIN_006` | 404 | Ingredient non trouve |
| `ADMIN_007` | 404 | Community non trouvee |
| `ADMIN_008` | 404 | Feature non trouvee |
| `ADMIN_009` | 409 | Feature deja attribuee |
| `ADMIN_010` | 400 | Impossible de revoquer feature par defaut |
| `ADMIN_011` | 409 | Tag/Ingredient existe deja |
| `ADMIN_012` | 400 | Fusion sur soi-meme interdite |

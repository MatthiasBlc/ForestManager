# API Specification - Forest Manager

## Vue d'ensemble

API REST pour Forest Manager. Base URL: `/api`

Toutes les routes (sauf auth) nécessitent une session valide.

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
Déconnexion.

**Response 200:**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/me
Récupère l'utilisateur courant.

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
Récupère un profil utilisateur public.

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
Liste des recettes personnelles d'un utilisateur (seulement les siennes si authentifié comme cet utilisateur).

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

## Communities

### GET /api/communities
Liste les communautés de l'utilisateur connecté.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Les Gourmands",
      "description": "Communauté de passionnés de cuisine",
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
Crée une nouvelle communauté.

**Body:**
```json
{
  "name": "Les Gourmands",
  "description": "Communauté de passionnés de cuisine"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "Les Gourmands",
  "description": "Communauté de passionnés de cuisine",
  "visibility": "INVITE_ONLY",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

### GET /api/communities/:id
Détails d'une communauté.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Les Gourmands",
  "description": "Communauté de passionnés de cuisine",
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
Modifie une communauté (admin only).

**Body:**
```json
{
  "name": "Nouveau nom",
  "description": "Nouvelle description"
}
```

**Response 200:** Communauté mise à jour

**Errors:**
- `403` - Not admin

---

### GET /api/communities/:id/members
Liste les membres d'une communauté.

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

### POST /api/communities/:id/members
Invite un utilisateur (admin only).

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

**Response 201:**
```json
{
  "message": "User invited successfully",
  "member": {
    "id": "uuid",
    "username": "newmember",
    "role": "MEMBER",
    "joinedAt": "2024-01-15T10:00:00Z"
  }
}
```

**Errors:**
- `403` - Not admin
- `404` - User not found
- `409` - Already a member

---

### PATCH /api/communities/:id/members/:userId
Modifie le rôle d'un membre (promotion uniquement, admin only).

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

### DELETE /api/communities/:id/members/:userId
Quitte la communauté (self) ou retire un membre (admin).

**Response 200:**
```json
{
  "message": "Left community successfully"
}
```

**Errors:**
- `403` - Last admin must promote another first
- `410` - Community deleted (was last member)

---

### GET /api/communities/:id/activity
Feed d'activité de la communauté.

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
Liste des recettes (catalogue personnel de l'utilisateur connecté).

**Query params:**
- `page` (default: 1)
- `limit` (default: 20)
- `tags` - Filtre par tags (comma-separated)

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
Liste des recettes d'une communauté.

**Query params:**
- `page`, `limit`, `tags`

**Response 200:** Même format que GET /api/recipes

---

### POST /api/recipes
Crée une recette dans le catalogue personnel.

**Body:**
```json
{
  "title": "Tarte aux pommes",
  "content": "## Ingrédients\n- 4 pommes...",
  "imageUrl": "https://...",
  "tags": ["dessert", "fruit"],
  "ingredients": [
    { "name": "Pommes", "quantity": "4" },
    { "name": "Sucre", "quantity": "100g" }
  ]
}
```

**Response 201:** Recette créée

---

### POST /api/communities/:communityId/recipes
Crée une recette dans une communauté (+ copie dans catalogue personnel).

**Body:** Même format que POST /api/recipes

**Response 201:**
```json
{
  "personal": { ... },
  "community": { ... }
}
```

---

### GET /api/recipes/:id
Détails d'une recette.

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
  "ingredients": [...],
  "isVariant": false,
  "originRecipe": null,
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
Modifie une recette (créateur only).

**Body:**
```json
{
  "title": "Nouveau titre",
  "content": "Nouveau contenu",
  "tags": ["updated", "tags"]
}
```

**Response 200:** Recette mise à jour

---

### DELETE /api/recipes/:id
Supprime une recette (soft delete, créateur only).

**Response 200:**
```json
{
  "message": "Recipe deleted"
}
```

---

### POST /api/recipes/:id/share
Fork une recette vers une autre communauté.

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
      "proposedTitle": "Tarte aux pommes - améliorée",
      "status": "PENDING",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST /api/recipes/:id/proposals
Crée une proposition de mise à jour.

**Body:**
```json
{
  "proposedTitle": "Tarte aux pommes - améliorée",
  "proposedContent": "## Nouvelle recette..."
}
```

**Response 201:** Proposition créée

**Errors:**
- `403` - Not a community member or proposing on own recipe

---

### GET /api/proposals/:id
Détails d'une proposition.

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
  "proposedTitle": "Tarte aux pommes - améliorée",
  "proposedContent": "...",
  "status": "PENDING",
  "createdAt": "2024-01-15T10:00:00Z",
  "decidedAt": null
}
```

---

### POST /api/proposals/:id/accept
Accepte une proposition (créateur de la recette only).

**Response 200:**
```json
{
  "message": "Proposal accepted",
  "updatedRecipe": { ... }
}
```

---

### POST /api/proposals/:id/reject
Refuse une proposition et crée une variante.

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
Tags utilisés dans une communauté.

**Response 200:** Même format

---

## Pagination

Toutes les routes paginées utilisent le format:

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

## Rate Limiting (futur)

- 100 requests/minute pour les routes authentifiées
- 20 requests/minute pour les routes non authentifiées
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

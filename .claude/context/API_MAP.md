# API Endpoints Reference

Base URL: `http://localhost:3001`

## Health
```
GET /health
```

## User Auth (/api/auth) - userSession middleware
```
POST /api/auth/signup          # signup(email, username, password)
POST /api/auth/login           # login(email, password)
POST /api/auth/logout          # logout
GET  /api/auth/me              # current user
```
Controller: `controllers/auth.ts` | Route: `routes/auth.ts`

## Recipes (/api/recipes) - requireAuth
```
GET    /api/recipes/            # list (paginated, filter by tags, search)
GET    /api/recipes/:recipeId   # detail (owner or community member)
POST   /api/recipes/            # create (title, content, tags[], ingredients[])
PATCH  /api/recipes/:recipeId   # update (owner, +membership for community recipes)
DELETE /api/recipes/:recipeId   # soft delete (owner, +membership for community recipes)
GET    /api/recipes/:recipeId/variants   # list variants (isVariant=true, same community)
POST   /api/recipes/:recipeId/share     # fork to another community
POST   /api/recipes/:recipeId/publish   # publish personal recipe to communities
GET    /api/recipes/:recipeId/communities  # list communities where recipe has copies
```
Controller: `controllers/recipes.ts` | Route: `routes/recipes.ts`

## Tags (/api/tags) - requireAuth
```
GET /api/tags/                  # autocomplete scope-aware (search, communityId?, recipeCount)
```
Controller: `controllers/tags.ts` | Route: `routes/tags.ts`

## Ingredients (/api/ingredients) - requireAuth
```
GET /api/ingredients/           # autocomplete (search, recipeCount)
```
Controller: `controllers/ingredients.ts` | Route: `routes/ingredients.ts`

## Communities (/api/communities) - requireAuth
```
GET    /api/communities/                          # list user's communities
POST   /api/communities/                          # create (auto MODERATOR)
GET    /api/communities/:communityId              # detail (memberOf)
PATCH  /api/communities/:communityId              # update (MODERATOR)
```
Controller: `controllers/communities.ts` | Route: `routes/communities.ts`

### Recipes (nested under /api/communities/:communityId)
```
GET    /api/communities/:communityId/recipes               # list (memberOf, paginated, filter tags/search)
POST   /api/communities/:communityId/recipes               # create (memberOf, creates personal + community copy)
```
Controller: `controllers/communityRecipes.ts`

### Members (nested under /api/communities/:communityId)
```
GET    /api/communities/:communityId/members              # list (memberOf)
PATCH  /api/communities/:communityId/members/:userId      # promote (MODERATOR, no demote)
DELETE /api/communities/:communityId/members/:userId      # kick/leave (memberOf)
```
Controller: `controllers/members.ts`

### Invitations (nested under /api/communities/:communityId)
```
GET    /api/communities/:communityId/invites               # list (MODERATOR, ?status=)
POST   /api/communities/:communityId/invites               # create (MODERATOR)
DELETE /api/communities/:communityId/invites/:inviteId      # cancel (MODERATOR)
```
Controller: `controllers/invites.ts`

### Tags (nested under /api/communities/:communityId) - MODERATOR
```
GET    /api/communities/:communityId/tags                  # list (APPROVED + PENDING, ?status=, ?search=)
POST   /api/communities/:communityId/tags                  # create APPROVED community tag
PATCH  /api/communities/:communityId/tags/:tagId           # rename
DELETE /api/communities/:communityId/tags/:tagId           # delete (hard, cascade RecipeTag)
POST   /api/communities/:communityId/tags/:tagId/approve   # approve PENDING → APPROVED
POST   /api/communities/:communityId/tags/:tagId/reject    # reject PENDING → hard delete
```
Controller: `controllers/communityTags.ts`

### Activity (nested under /api/communities/:communityId)
```
GET    /api/communities/:communityId/activity              # feed (memberOf, paginated)
```
Controller: `controllers/activity.ts`

## Users (/api/users) - requireAuth
```
GET   /api/users/search               # search by username prefix (?q=)
PATCH /api/users/me                    # update profile (username, email, password)
GET   /api/users/me/invites            # received invitations (?status=)
GET   /api/users/me/activity           # personal activity feed (paginated)
```
Controller: `controllers/users.ts`, `controllers/invites.ts`, `controllers/activity.ts` | Route: `routes/users.ts`

## User Invitations
```
POST /api/invites/:inviteId/accept      # accept
POST /api/invites/:inviteId/reject      # reject
```
Controller: `controllers/invites.ts` | Route: `routes/invites.ts`

## Proposals (/api/proposals) - requireAuth
```
GET  /api/proposals/:proposalId         # detail proposition
POST /api/proposals/:proposalId/accept  # accepter (createur recette)
POST /api/proposals/:proposalId/reject  # refuser + creer variante
```
Controller: `controllers/proposals.ts` | Route: `routes/proposals.ts`

### Proposals (nested under /api/recipes/:recipeId)
```
GET  /api/recipes/:recipeId/proposals   # list propositions (?status=)
POST /api/recipes/:recipeId/proposals   # creer proposition
```
Controller: `controllers/proposals.ts` | Route: `routes/recipes.ts`

---

## Admin Auth (/api/admin/auth) - adminSession, rate limited 5/15min
```
POST /api/admin/auth/login          # login (email, password)
POST /api/admin/auth/totp/verify    # verify TOTP code
POST /api/admin/auth/logout         # logout
GET  /api/admin/auth/me             # current admin (requireSuperAdmin)
```
Controller: `admin/controllers/authController.ts` | Route: `admin/routes/authRoutes.ts`

## Admin Tags (/api/admin/tags) - requireSuperAdmin
```
GET    /api/admin/tags/             # list all (?scope=GLOBAL|COMMUNITY, ?search=)
POST   /api/admin/tags/             # create (GLOBAL only)
PATCH  /api/admin/tags/:id          # update (any tag)
DELETE /api/admin/tags/:id          # delete (any tag)
POST   /api/admin/tags/:id/merge    # merge into another
```
Controller: `admin/controllers/tagsController.ts` | Route: `admin/routes/tagsRoutes.ts`

## Admin Ingredients (/api/admin/ingredients) - requireSuperAdmin
```
GET    /api/admin/ingredients/             # list all
POST   /api/admin/ingredients/             # create
PATCH  /api/admin/ingredients/:id          # update
DELETE /api/admin/ingredients/:id          # delete
POST   /api/admin/ingredients/:id/merge    # merge into another
```
Controller: `admin/controllers/ingredientsController.ts` | Route: `admin/routes/ingredientsRoutes.ts`

## Admin Communities (/api/admin/communities) - requireSuperAdmin
```
GET    /api/admin/communities/                                    # list all
GET    /api/admin/communities/:id                                 # detail
PATCH  /api/admin/communities/:id                                 # update
DELETE /api/admin/communities/:id                                 # soft delete
POST   /api/admin/communities/:communityId/features/:featureId    # grant feature
DELETE /api/admin/communities/:communityId/features/:featureId    # revoke feature
```
Controller: `admin/controllers/communitiesController.ts` | Route: `admin/routes/communitiesRoutes.ts`

## Admin Features (/api/admin/features) - requireSuperAdmin
```
GET   /api/admin/features/          # list all
POST  /api/admin/features/          # create
PATCH /api/admin/features/:id       # update
```
Controller: `admin/controllers/featuresController.ts` | Route: `admin/routes/featuresRoutes.ts`

## Admin Dashboard & Activity - requireSuperAdmin
```
GET /api/admin/dashboard/stats      # global stats
GET /api/admin/activity/            # admin activity logs (paginated)
```
Controllers: `admin/controllers/dashboardController.ts`, `admin/controllers/activityController.ts`

---

## Middleware Chain

| Middleware | Fichier | Role |
|-----------|---------|------|
| userSession | app.ts (express-session) | Session user (connect.sid) |
| adminSession | app.ts (express-session) | Session admin (admin.sid) |
| requireAuth | middleware/auth.ts | Verifie session.userId |
| requireSuperAdmin | admin/middleware/requireSuperAdmin.ts | Verifie session.adminId + totpVerified |
| memberOf | middleware/community.ts | Verifie appartenance communaute |
| requireCommunityRole | middleware/community.ts | Verifie role dans communaute |
| adminRateLimiter | middleware/security.ts | 30 req/min global admin |
| authRateLimiter | routes config | 5/15min sur auth endpoints |

## Total: 71 endpoints (44 user + 27 admin + 1 health)

# Database Schema Reference

Source: `backend/prisma/schema.prisma`
DB: PostgreSQL | ORM: Prisma

## Models (28 total)

### Sessions (isolees)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| Session | id, sid, data, expiresAt | User sessions (connect.sid) |
| AdminSession | id, sid, data, expiresAt | Admin sessions (admin.sid) |

### Admin (4 models)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| AdminUser | id, email, username, password, totpSecret, totpEnabled | 2FA TOTP obligatoire, index email+username |
| Feature | id, code(unique), name, description?, isDefault | Briques ("MVP" par defaut) |
| CommunityFeature | communityId, featureId, grantedById?, revokedAt? | Pivot, soft revoke, @@unique(communityId,featureId) |
| AdminActivityLog | id, type(AdminActionType), targetType?, targetId?, metadata?(Json), adminId | Audit, index type+createdAt |

### Users & Communities (4 models)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| User | id, email, username, password, deletedAt? | Soft delete, index email+username+deletedAt |
| Community | id, name, description?, visibility(INVITE_ONLY), deletedAt? | Soft delete |
| UserCommunity | userId, communityId, role(MEMBER/MODERATOR), joinedAt, deletedAt? | Soft delete, @@unique(userId,communityId) |
| CommunityInvite | communityId, inviterId, inviteeId, status(PENDING/ACCEPTED/REJECTED/CANCELLED), respondedAt? | Index composite(communityId,inviteeId,status) |

### Recipes (8 models)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| Recipe | id, title, content, imageUrl?, isVariant, creatorId, communityId?, originRecipeId?, sharedFromCommunityId?, deletedAt? | Soft delete. communityId=null → perso |
| RecipeUpdateProposal | recipeId, proposerId, proposedTitle, proposedContent, status(PENDING/ACCEPTED/REJECTED), deletedAt?, proposedIngredients[] | Soft delete |
| Tag | id, name, scope(GLOBAL/COMMUNITY), status(APPROVED/PENDING), communityId?, createdById?, createdAt, updatedAt | @@unique(name,communityId) + partial unique index global. Index name, communityId+status |
| RecipeTag | recipeId, tagId | PK composite, **Cascade** delete |
| Unit | id, name(unique), abbreviation(unique), category(UnitCategory), sortOrder | Index (category,sortOrder). Phase 11 |
| Ingredient | id, name(unique), status(IngredientStatus), defaultUnitId?, createdById?, createdAt, updatedAt | Index name, status. FK Unit + User. Phase 11 enriched |
| RecipeIngredient | recipeId, ingredientId, quantity(Float?), unitId?, order | **Cascade** delete, @@unique(recipeId,ingredientId). FK Unit |
| ProposalIngredient | proposalId, ingredientId, quantity(Float?), unitId?, order | **Cascade** on proposal+ingredient, @@unique(proposalId,ingredientId). Phase 11 |

### Tags (2 models - Phase 10)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| TagSuggestion | id, recipeId, tagName, suggestedById, status(TagSuggestionStatus), createdAt, decidedAt? | @@unique(recipeId,tagName,suggestedById), Cascade on recipe delete |
| UserCommunityTagPreference | userId, communityId, showTags(default true), updatedAt | PK composite(userId,communityId), Cascade delete |

### Notifications (2 models - Phase 12)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| Notification | id, userId, type, category(NotificationCategory), title, message, actionUrl?, metadata?(Json), actorId?, communityId?, recipeId?, groupKey?, readAt?, createdAt | Index userId+readAt+createdAt, userId+createdAt, userId+groupKey+createdAt, createdAt. Cascade on user/community, SetNull on actor/recipe |
| NotificationPreference | id, userId, communityId?(null=global), category(NotificationCategory), enabled(default true), updatedAt | @@unique(userId,communityId,category). Remplace ModeratorNotificationPreference |

### Analytics (2 models - futur)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| RecipeAnalytics | recipeId(unique), views, shares, forks | Cascade delete |
| RecipeView | recipeId, userId?, viewedAt | Cascade delete |

### Activity (1 model)
| Model | Champs cles | Notes |
|-------|-------------|-------|
| ActivityLog | type(ActivityType), userId, communityId?, recipeId?, metadata?(Json) | Index communityId+userId+createdAt+type |

## Enums

```
Role: MEMBER | MODERATOR
Visibility: INVITE_ONLY
InviteStatus: PENDING | ACCEPTED | REJECTED | CANCELLED
ProposalStatus: PENDING | ACCEPTED | REJECTED

TagScope: GLOBAL | COMMUNITY
TagStatus: APPROVED | PENDING
TagSuggestionStatus: PENDING_OWNER | PENDING_MODERATOR | APPROVED | REJECTED

UnitCategory: WEIGHT | VOLUME | SPOON | COUNT | QUALITATIVE
IngredientStatus: APPROVED | PENDING

NotificationCategory: INVITATION | RECIPE_PROPOSAL | TAG | INGREDIENT | MODERATION

AdminActionType: TAG_CREATED | TAG_UPDATED | TAG_DELETED | TAG_MERGED |
  INGREDIENT_CREATED | INGREDIENT_UPDATED | INGREDIENT_DELETED | INGREDIENT_MERGED |
  INGREDIENT_APPROVED | INGREDIENT_REJECTED |
  UNIT_CREATED | UNIT_UPDATED | UNIT_DELETED |
  COMMUNITY_RENAMED | COMMUNITY_DELETED |
  FEATURE_CREATED | FEATURE_UPDATED | FEATURE_GRANTED | FEATURE_REVOKED |
  ADMIN_LOGIN | ADMIN_LOGOUT | ADMIN_TOTP_SETUP

ActivityType: RECIPE_CREATED | RECIPE_UPDATED | RECIPE_DELETED | RECIPE_SHARED |
  VARIANT_PROPOSED | VARIANT_CREATED | PROPOSAL_ACCEPTED | PROPOSAL_REJECTED |
  USER_JOINED | USER_LEFT | USER_KICKED | USER_PROMOTED |
  INVITE_SENT | INVITE_ACCEPTED | INVITE_REJECTED | INVITE_CANCELLED |
  TAG_CREATED | TAG_UPDATED | TAG_DELETED | TAG_APPROVED | TAG_REJECTED
```

## Relations cles

```
User <-N:N-> Community (via UserCommunity avec role)
User <-1:N-> Recipe (creatorId)
User <-1:N-> Tag (createdById, relation "TagCreator")
User <-1:N-> Ingredient (createdById, relation "IngredientCreator")
User <-1:N-> TagSuggestion (suggestedById)
User <-1:N-> UserCommunityTagPreference
User <-1:N-> Notification (recipient, relation "NotificationRecipient")
User <-1:N-> Notification (actor, relation "NotificationActor")
User <-1:N-> NotificationPreference
Recipe <-N:N-> Tag (via RecipeTag, cascade)
Recipe <-N:N-> Ingredient (via RecipeIngredient, cascade)
Recipe <-self-> Recipe (originRecipeId -> variantes/forks)
Recipe <-1:N-> TagSuggestion (cascade on delete)
RecipeUpdateProposal <-1:N-> ProposalIngredient (cascade on delete)
Ingredient -> Unit? (defaultUnitId)
RecipeIngredient -> Unit? (unitId)
ProposalIngredient -> Unit? (unitId)
Community <-1:N-> CommunityInvite
Community <-1:N-> Tag (communityId)
Community <-1:N-> UserCommunityTagPreference (cascade)
Community <-1:N-> Notification (cascade)
Community <-1:N-> NotificationPreference (cascade)
Recipe <-1:N-> Notification (SetNull on delete)
User <-1:N-> CommunityInvite (inviter + invitee)
Community <-N:N-> Feature (via CommunityFeature, soft revoke)
AdminUser <-1:N-> AdminActivityLog
```

## Regles delete

| Type | Modeles | Methode |
|------|---------|---------|
| Soft delete (deletedAt) | User, Community, UserCommunity, Recipe, RecipeUpdateProposal, CommunityInvite | Applicatif (where deletedAt: null) |
| Hard delete (Cascade) | RecipeTag, RecipeIngredient, ProposalIngredient, RecipeAnalytics, RecipeView, TagSuggestion (via Recipe), UserCommunityTagPreference, Notification (via User/Community), NotificationPreference | DB cascade |
| Soft revoke | CommunityFeature | revokedAt timestamp |

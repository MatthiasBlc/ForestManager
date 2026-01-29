# Business Rules - Forest Manager

## Vue d'ensemble

Ce document decrit toutes les regles metier et la logique applicative de Forest Manager. Ces regles doivent etre implementees dans la couche controleur/service du backend.

---

## 1. Gestion des utilisateurs

### 1.1 Inscription
- L'email doit etre unique
- Le username doit etre unique
- Le mot de passe est hashe avec bcrypt (salt rounds: 10)
- Un utilisateur nouvellement inscrit n'appartient a aucune communaute

### 1.2 Authentification
- Authentification par session (express-session)
- Sessions persistees en base de donnees via `@quixo3/prisma-session-store`
- Duree de session: 1 heure

### 1.3 Catalogue personnel
- Chaque utilisateur possede un catalogue personnel de recettes
- Les recettes personnelles ont `communityId = null`
- Les recettes personnelles ne sont visibles que par leur createur

---

## 2. Gestion des communautes

### 2.1 Creation de communaute
- Tout utilisateur authentifie peut creer une communaute
- Le createur devient automatiquement **ADMIN** de la communaute
- Visibilite: toujours **INVITE_ONLY** (MVP)

### 2.2 Roles

| Role | Permissions |
|------|-------------|
| **MEMBER** | Voir les recettes, creer des recettes, proposer des mises a jour, quitter |
| **ADMIN** | Tout ce que MEMBER + inviter, retirer un membre, promouvoir, modifier la description, annuler des invitations |

### 2.3 Systeme d'invitation (NOUVEAU)

**Principe:** Les invitations necessitent une acceptation explicite de l'invite.

#### Qui peut inviter ?
- **Seuls les ADMIN** peuvent envoyer des invitations
- L'invite doit etre un utilisateur **deja inscrit** sur la plateforme
- Recherche de l'invite par username ou email

#### Workflow d'invitation
```
1. Admin envoie une invitation (POST /api/communities/:id/invites)
   → CommunityInvite cree avec status: PENDING
   → ActivityLog: INVITE_SENT

2. L'invite voit l'invitation dans son espace
   → GET /api/users/me/invites (liste des invitations recues)

3. L'invite repond:
   A) Accepter (POST /api/invites/:id/accept)
      → CommunityInvite.status = ACCEPTED
      → Creation UserCommunity (role: MEMBER)
      → ActivityLog: INVITE_ACCEPTED, USER_JOINED

   B) Refuser (POST /api/invites/:id/reject)
      → CommunityInvite.status = REJECTED
      → ActivityLog: INVITE_REJECTED

4. L'admin peut annuler une invitation en attente
   → DELETE /api/invites/:id
   → CommunityInvite.status = CANCELLED
   → ActivityLog: INVITE_CANCELLED
```

#### Contraintes
- Une seule invitation PENDING par couple (communityId, inviteeId)
- Si l'utilisateur est deja membre → erreur
- Si une invitation PENDING existe deja → erreur

### 2.4 Promotion en administrateur
- **Seuls les ADMIN** peuvent promouvoir un MEMBER en ADMIN
- Un ADMIN **ne peut pas retrograder** un autre ADMIN
- Le role ADMIN est permanent (sauf si l'utilisateur quitte)

### 2.5 Retirer un membre (Kick) (NOUVEAU)
```
CONDITIONS:
- L'utilisateur qui kick DOIT etre ADMIN
- L'utilisateur cible DOIT etre MEMBER (pas ADMIN)

ACTIONS:
1. Marquer UserCommunity.deletedAt = now()
2. Creer ActivityLog (type: USER_KICKED)
3. L'utilisateur perd l'acces immediatement

NOTE: Un ADMIN ne peut PAS retirer un autre ADMIN.
```

### 2.6 Quitter une communaute

```
SI l'utilisateur veut quitter:
    SI c'est un ADMIN:
        SI c'est le dernier ADMIN:
            SI il y a d'autres MEMBER:
                → BLOQUER: doit d'abord promouvoir un autre utilisateur
            SINON (dernier utilisateur):
                → Soft delete de la communaute (cascade applicative)
        SINON:
            → Marquer UserCommunity.deletedAt
            → L'utilisateur perd l'acces
    SINON (MEMBER):
        → Marquer UserCommunity.deletedAt
        → L'utilisateur perd l'acces
        → Creer ActivityLog (type: USER_LEFT)
```

### 2.7 Suppression de communaute
- Declenchee automatiquement quand le dernier utilisateur quitte
- **Cascade applicative (soft delete):**
  - Toutes les recettes de la communaute → `deletedAt = now()`
  - Tous les UserCommunity → `deletedAt = now()`
  - Toutes les invitations PENDING → `status = CANCELLED`
  - La communaute → `deletedAt = now()`
- Les ActivityLog sont **conserves** pour historique

---

## 3. Gestion des recettes

### 3.1 Creation de recette

**Dans le catalogue personnel:**
- La recette est creee avec `communityId = null`
- Seul le createur peut la voir

**Dans une communaute:**
```
CONDITION: l'utilisateur DOIT etre membre de la communaute

1. Creer la recette dans le catalogue personnel (communityId = null)
2. Creer une COPIE dans la communaute (communityId = community.id)
3. La copie communautaire a originRecipeId = recette_personnelle.id
4. Creer un ActivityLog (type: RECIPE_CREATED)
```

**Lien recette personnelle ↔ communautaire:**
- La recette communautaire pointe vers la recette personnelle via `originRecipeId`
- Pour retrouver la recette perso: `originRecipe.communityId == null`

### 3.2 Modification de recette
- **Catalogue personnel:** Le createur peut modifier librement
- **Communaute:** Seul le createur de la recette communautaire peut modifier directement
- Les autres membres doivent passer par le systeme de propositions

### 3.3 Suppression de recette (soft delete)
- Le createur peut supprimer sa recette
- La suppression est un soft delete (`deletedAt = now()`)
- Supprimer une recette personnelle **ne supprime pas** les copies communautaires
- Supprimer une recette communautaire **ne supprime pas** la recette personnelle
- Les tables pivot (RecipeTag, RecipeIngredient) sont hard delete via Cascade

### 3.4 Tags
- Une recette peut avoir **plusieurs tags**
- Les tags sont globaux (partages entre communautes)
- Creation de tag a la volee si inexistant

### 3.5 Ingredients
- Une recette peut avoir **plusieurs ingredients** avec quantites
- Les ingredients sont globaux (comme les tags)
- Creation a la volee si inexistant

---

## 4. Systeme de propositions

### 4.1 Creer une proposition
```
CONDITIONS:
- L'utilisateur DOIT etre membre de la communaute
- La recette DOIT appartenir a cette communaute
- L'utilisateur NE PEUT PAS proposer sur sa propre recette

ACTIONS:
1. Creer RecipeUpdateProposal (status: PENDING)
2. Creer ActivityLog (type: VARIANT_PROPOSED)
```

### 4.2 Accepter une proposition
```
CONDITIONS:
- L'utilisateur DOIT etre le createur de la recette cible
- La proposition DOIT etre en status PENDING

ACTIONS:
1. Mettre a jour la recette communautaire avec le contenu propose
2. Retrouver et mettre a jour la recette personnelle liee:
   → Chercher recipe.originRecipeId
   → Verifier que originRecipe.communityId == null
   → Mettre a jour originRecipe
3. Mettre a jour RecipeUpdateProposal (status: ACCEPTED, decidedAt: now)
4. Creer ActivityLog (type: PROPOSAL_ACCEPTED)
```

### 4.3 Refuser une proposition
```
CONDITIONS:
- L'utilisateur DOIT etre le createur de la recette cible
- La proposition DOIT etre en status PENDING

ACTIONS:
1. Creer une NOUVELLE recette (variante):
   - Contenu = contenu propose
   - creatorId = proposer.id
   - communityId = meme communaute
   - originRecipeId = recette_cible.id
   - isVariant = true
2. Mettre a jour RecipeUpdateProposal (status: REJECTED, decidedAt: now)
3. Creer ActivityLog (type: VARIANT_CREATED)
```

### 4.4 Visualisation des variantes
- Sur la page d'une recette, afficher toutes les recettes ou `originRecipeId = recette.id` ET `isVariant = true`
- Presentation en liste deroulante (dropdown)
- Tri par date de creation (plus recent en premier)

---

## 5. Partage inter-communautes (Fork)

### 5.1 Conditions de partage
```
L'utilisateur DOIT:
- Etre membre de la communaute SOURCE
- Etre membre de la communaute CIBLE
- Etre ADMIN dans au moins une des deux communautes OU etre le createur de la recette
```

### 5.2 Processus de fork
```
1. Creer une NOUVELLE recette dans la communaute cible:
   - Copier title, content, tags, ingredients
   - creatorId = utilisateur qui partage
   - communityId = communaute cible
   - originRecipeId = recette originale
   - sharedFromCommunityId = communaute source
   - isVariant = false

2. Incrementer RecipeAnalytics.shares de la recette source
3. Incrementer RecipeAnalytics.forks de la recette source
4. Creer ActivityLog (type: RECIPE_SHARED) dans les deux communautes
```

### 5.3 Independance des forks
- La recette forkee est **totalement independante**
- Elle peut recevoir ses propres propositions et variantes
- Les modifications sur l'originale n'affectent pas les forks
- Les modifications sur le fork n'affectent pas l'originale

---

## 6. Activity Feed

### 6.1 Evenements trackes

| Type | Declencheur | Donnees |
|------|-------------|---------|
| `RECIPE_CREATED` | Creation de recette dans communaute | recipeId, communityId |
| `RECIPE_UPDATED` | Modification de recette | recipeId |
| `RECIPE_DELETED` | Suppression de recette | recipeId |
| `RECIPE_SHARED` | Fork d'une recette | recipeId, communityId, metadata.fromCommunityId |
| `VARIANT_PROPOSED` | Nouvelle proposition | recipeId, proposalId |
| `VARIANT_CREATED` | Proposition refusee | recipeId (variante), originRecipeId |
| `PROPOSAL_ACCEPTED` | Proposition acceptee | recipeId, proposalId |
| `PROPOSAL_REJECTED` | Proposition refusee | recipeId, proposalId |
| `USER_JOINED` | Invitation acceptee | communityId |
| `USER_LEFT` | Membre quitte | communityId |
| `USER_KICKED` | Membre retire par admin | communityId, metadata.kickedUserId |
| `USER_PROMOTED` | Promotion en admin | communityId, metadata.promotedUserId |
| `INVITE_SENT` | Invitation envoyee | communityId, metadata.inviteeId |
| `INVITE_ACCEPTED` | Invitation acceptee | communityId |
| `INVITE_REJECTED` | Invitation refusee | communityId |
| `INVITE_CANCELLED` | Invitation annulee | communityId, metadata.inviteeId |

### 6.2 Requetes feed
- **Feed par communaute:** `WHERE communityId = X ORDER BY createdAt DESC`
- **Feed personnel:** `WHERE userId = X OR recipeId IN (user's recipes) ORDER BY createdAt DESC`

---

## 7. Analytics (prepare mais desactive MVP)

### 7.1 Compteurs
- `views`: Incremente a chaque consultation de la page recette
- `shares`: Incremente lors d'un fork
- `forks`: Incremente lors d'un fork

### 7.2 Tracking detaille
- RecipeView stocke chaque vue individuelle
- Permet l'analyse par utilisateur et par periode
- Desactive par defaut pour le MVP

---

## 8. Regles de validation

### 8.1 Recette
```typescript
{
  title: string, min: 3, max: 200
  content: string, min: 10, max: 50000
  imageUrl?: string, format: URL
  tags?: string[], max: 10 tags
  ingredients?: { name: string, quantity?: string }[], max: 100 ingredients
}
```

### 8.2 Communaute
```typescript
{
  name: string, min: 3, max: 100
  description?: string, max: 1000
}
```

### 8.3 Proposition
```typescript
{
  proposedTitle: string, min: 3, max: 200      // Requis
  proposedContent: string, min: 10, max: 50000 // Requis
}
// Note: Les deux champs sont obligatoires.
// Une proposition est une version complete suggeree, pas une modification partielle.
// Si acceptee, titre ET contenu sont remplaces.
```

### 8.4 Invitation
```typescript
{
  inviteeId?: string, format: UUID
  email?: string, format: email
  username?: string, min: 3
}
// Au moins un des trois champs requis
```

---

## 9. Codes d'erreur

| Code | Message | Contexte |
|------|---------|----------|
| `AUTH_001` | Non authentifie | Acces route protegee |
| `AUTH_002` | Session expiree | Session invalide |
| `COMMUNITY_001` | Non membre | Acces communaute sans membership |
| `COMMUNITY_002` | Permission insuffisante | Action admin sans etre admin |
| `COMMUNITY_003` | Dernier admin | Tentative de quitter en tant que dernier admin |
| `COMMUNITY_004` | Utilisateur deja membre | Invitation d'un membre existant |
| `COMMUNITY_005` | Invitation deja envoyee | Invitation PENDING existe deja |
| `COMMUNITY_006` | Impossible de retirer un admin | Tentative de kick un admin |
| `RECIPE_001` | Recette non trouvee | ID invalide ou soft deleted |
| `RECIPE_002` | Non proprietaire | Modification sans etre createur |
| `PROPOSAL_001` | Proposition invalide | Auto-proposition interdite |
| `PROPOSAL_002` | Deja decidee | Proposition non-pending |
| `SHARE_001` | Non membre source | Pas dans la communaute source |
| `SHARE_002` | Non membre cible | Pas dans la communaute cible |
| `SHARE_003` | Permission partage | Ni admin ni createur |
| `INVITE_001` | Invitation non trouvee | ID invalide |
| `INVITE_002` | Invitation deja traitee | Status non PENDING |
| `INVITE_003` | Utilisateur non trouve | Email/username inexistant |

---

## 10. Soft Delete - Implementation

### 10.1 Principe
- Toutes les entites principales ont un champ `deletedAt`
- Une entite avec `deletedAt != null` est consideree supprimee
- Toutes les requetes doivent filtrer `WHERE deletedAt IS NULL`

### 10.2 Entites concernees
- User
- Community
- UserCommunity
- Recipe
- RecipeUpdateProposal
- CommunityInvite

### 10.3 Tables pivot (hard delete)
- RecipeTag → Cascade quand Recipe supprime
- RecipeIngredient → Cascade quand Recipe supprime
- RecipeAnalytics → Cascade quand Recipe supprime
- RecipeView → Cascade quand Recipe supprime

### 10.4 Middleware Prisma recommande
```typescript
// Filtrer automatiquement les entites soft-deleted
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' || params.action === 'findFirst') {
    if (!params.args.where?.deletedAt) {
      params.args.where = { ...params.args.where, deletedAt: null };
    }
  }
  return next(params);
});
```

---

## 11. SuperAdmin - Gestion Plateforme

### 11.1 Concept

Le SuperAdmin est un compte d'administration plateforme **completement isole** du systeme utilisateur classique.

**Isolation:**
| Aspect | Users | SuperAdmin |
|--------|-------|------------|
| Model | `User` | `AdminUser` |
| Session | `Session` | `AdminSession` |
| Authentification | Session simple | Session + 2FA TOTP |
| Creation | Inscription publique | CLI serveur uniquement |

### 11.2 Capacites SuperAdmin

| Domaine | Actions |
|---------|---------|
| **Tags** | Lister, creer, renommer, supprimer, fusionner |
| **Ingredients** | Lister, creer, renommer, supprimer, fusionner |
| **Communautes** | Lister toutes, voir details, renommer, supprimer |
| **Features** | Lister, creer, modifier, attribuer, revoquer |
| **Dashboard** | Stats globales, logs d'activite admin |

### 11.3 Authentification 2FA TOTP

```
PREMIERE CONNEXION:
1. Admin saisit username + password
2. Serveur verifie credentials
3. Si totpEnabled = false:
   → Retourne QR code + totpSecret
   → Admin scanne avec Google Authenticator
4. POST /api/admin/auth/totp/verify { token: "123456" }
5. Si valide:
   → totpEnabled = true
   → Cree AdminSession
   → session.adminId = admin.id
   → session.totpVerified = true

CONNEXIONS SUIVANTES:
1. Admin saisit username + password + totpToken
2. Serveur verifie credentials + TOTP
3. Si valide:
   → Cree AdminSession
   → session.adminId = admin.id
   → session.totpVerified = true
```

### 11.4 Creation de compte SuperAdmin

**Methode:** CLI serveur uniquement (`npm run admin:create`)

```
1. Execution sur le serveur (pas d'API publique)
2. Prompt: username, email, password
3. Hash password avec bcrypt
4. Genere totpSecret avec otplib
5. Cree AdminUser (totpEnabled: false)
6. A la premiere connexion: scan QR → activation 2FA
```

**Securite:** Aucun endpoint public ne permet de creer un SuperAdmin.

### 11.5 Gestion des Tags/Ingredients

**Fusion (merge):**
```
CONDITIONS:
- Le tag/ingredient source existe
- Le tag/ingredient cible existe
- Source != Cible

ACTIONS:
1. Mettre a jour toutes les RecipeTag/RecipeIngredient:
   → Remplacer sourceId par targetId
2. Supprimer le tag/ingredient source (hard delete)
3. Creer AdminActivityLog (TAG_MERGED / INGREDIENT_MERGED)
4. Retourner le nombre de recettes mises a jour
```

### 11.6 Gestion des Communautes (Admin)

**Suppression par SuperAdmin:**
```
ACTIONS:
1. Soft delete la communaute (deletedAt = now)
2. Soft delete tous les UserCommunity
3. Soft delete toutes les recettes communautaires
4. Annuler toutes les invitations PENDING
5. Creer AdminActivityLog (COMMUNITY_DELETED)
```

**Note:** Le SuperAdmin peut supprimer n'importe quelle communaute, meme avec des membres actifs.

### 11.7 Audit Admin

Toutes les actions SuperAdmin sont enregistrees dans `AdminActivityLog`:

| Type | Declencheur | Donnees |
|------|-------------|---------|
| `TAG_CREATED` | Nouveau tag | targetType: "Tag", targetId |
| `TAG_UPDATED` | Renommage tag | targetId, metadata.oldName, metadata.newName |
| `TAG_DELETED` | Suppression tag | targetId, metadata.recipesAffected |
| `TAG_MERGED` | Fusion tags | targetId, metadata.sourceId, metadata.recipesUpdated |
| `INGREDIENT_*` | (idem que tags) | ... |
| `COMMUNITY_RENAMED` | Renommage communaute | targetId, metadata |
| `COMMUNITY_DELETED` | Suppression communaute | targetId, metadata.membersAffected |
| `FEATURE_GRANTED` | Attribution feature | metadata.communityId, metadata.featureCode |
| `FEATURE_REVOKED` | Revocation feature | metadata.communityId, metadata.featureCode |
| `ADMIN_LOGIN` | Connexion reussie | adminId |
| `ADMIN_LOGOUT` | Deconnexion | adminId |
| `ADMIN_TOTP_SETUP` | Configuration 2FA | adminId |

---

## 12. Systeme de Briques (Features)

### 12.1 Concept

L'application est structuree en "briques" (modules/features) que les communautes peuvent ou non avoir:

| Feature | Code | Description | Default |
|---------|------|-------------|---------|
| MVP | `MVP` | Catalogue recettes, communautes, partage | Oui |
| Planificateur | `MEAL_PLANNER` | Planification repas hebdomadaire | Non |
| (Futur) | `...` | Autres fonctionnalites | Non |

### 12.2 Attribution automatique

**A la creation d'une communaute:**
```
1. Requete: SELECT * FROM Feature WHERE isDefault = true
2. Pour chaque feature default:
   → INSERT CommunityFeature (communityId, featureId, grantedById: null)
3. La communaute a acces aux features par defaut
```

### 12.3 Attribution manuelle

**Par SuperAdmin:**
```
POST /api/admin/communities/:id/features/:featureId

CONDITIONS:
- La communaute existe
- La feature existe
- La feature n'est pas deja attribuee

ACTIONS:
1. INSERT CommunityFeature (communityId, featureId, grantedById: adminId)
2. Creer AdminActivityLog (FEATURE_GRANTED)
```

### 12.4 Revocation

**Par SuperAdmin:**
```
DELETE /api/admin/communities/:id/features/:featureId

CONDITIONS:
- La feature est attribuee a cette communaute
- La feature N'EST PAS une feature par defaut (isDefault = false)
  → Exception: MVP ne peut pas etre revoque

ACTIONS:
1. UPDATE CommunityFeature SET revokedAt = now()
2. Creer AdminActivityLog (FEATURE_REVOKED)
```

### 12.5 Verification d'acces (futur)

Middleware pour verifier qu'une communaute a acces a une feature:

```typescript
// Usage:
router.get('/meal-plan', requireAuth, memberOf(), hasFeature('MEAL_PLANNER'), getMealPlan);
```

**Note:** Pour le MVP, seule la feature "MVP" existe. Le middleware `hasFeature` sera implemente quand de nouvelles briques seront ajoutees.

---

## 13. Codes d'erreur Admin

| Code | Message | Contexte |
|------|---------|----------|
| `ADMIN_001` | Non authentifie (admin) | Acces route admin sans session |
| `ADMIN_002` | 2FA requis | Session admin sans totpVerified |
| `ADMIN_003` | Token TOTP invalide | Code 2FA incorrect |
| `ADMIN_004` | 2FA deja configure | Setup TOTP sur admin avec totpEnabled=true |
| `ADMIN_005` | Tag non trouve | ID tag invalide |
| `ADMIN_006` | Ingredient non trouve | ID ingredient invalide |
| `ADMIN_007` | Communaute non trouvee | ID communaute invalide |
| `ADMIN_008` | Feature non trouvee | ID feature invalide |
| `ADMIN_009` | Feature deja attribuee | Attribution en double |
| `ADMIN_010` | Impossible de revoquer feature par defaut | Tentative revocation MVP |
| `ADMIN_011` | Tag/Ingredient existe deja | Creation avec nom existant |
| `ADMIN_012` | Fusion sur soi-meme interdite | sourceId == targetId |

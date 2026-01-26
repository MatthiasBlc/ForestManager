# Business Rules - Forest Manager

## Vue d'ensemble

Ce document décrit toutes les règles métier et la logique applicative de Forest Manager. Ces règles doivent être implémentées dans la couche contrôleur/service du backend.

---

## 1. Gestion des utilisateurs

### 1.1 Inscription
- L'email doit être unique
- Le username doit être unique
- Le mot de passe est hashé avec bcrypt (salt rounds: 10)
- Un utilisateur nouvellement inscrit n'appartient à aucune communauté

### 1.2 Authentification
- Authentification par session (express-session)
- Sessions persistées en base de données
- Durée de session configurable (défaut: 7 jours)

### 1.3 Catalogue personnel
- Chaque utilisateur possède un catalogue personnel de recettes
- Les recettes personnelles ont `communityId = null`
- Les recettes personnelles ne sont visibles que par leur créateur

---

## 2. Gestion des communautés

### 2.1 Création de communauté
- Tout utilisateur authentifié peut créer une communauté
- Le créateur devient automatiquement **ADMIN** de la communauté
- Visibilité: toujours **INVITE_ONLY** (MVP)

### 2.2 Rôles

| Rôle | Permissions |
|------|-------------|
| **MEMBER** | Voir les recettes, créer des recettes, proposer des mises à jour, quitter |
| **ADMIN** | Tout ce que MEMBER + inviter, promouvoir, modifier la description |

### 2.3 Invitation de membres
- **Seuls les ADMIN** peuvent inviter de nouveaux membres
- L'invité rejoint avec le rôle **MEMBER**
- Un utilisateur ne peut pas être invité s'il est déjà membre

### 2.4 Promotion en administrateur
- **Seuls les ADMIN** peuvent promouvoir un MEMBER en ADMIN
- Un ADMIN **ne peut pas rétrograder** un autre ADMIN
- Le rôle ADMIN est permanent (sauf si l'utilisateur quitte)

### 2.5 Quitter une communauté

```
SI l'utilisateur veut quitter:
    SI c'est le dernier ADMIN:
        SI il y a d'autres MEMBER:
            → BLOQUER: doit d'abord promouvoir un autre utilisateur
        SINON (dernier utilisateur):
            → Supprimer la communauté (cascade)
    SINON:
        → Marquer UserCommunity.deletedAt
        → L'utilisateur perd l'accès
```

### 2.6 Suppression de communauté
- Déclenchée automatiquement quand le dernier utilisateur quitte
- **Cascade:**
  - Toutes les recettes de la communauté → `deletedAt`
  - Tous les UserCommunity → `deletedAt`
  - La communauté → `deletedAt`
- Les ActivityLog sont **conservés** pour historique

---

## 3. Gestion des recettes

### 3.1 Création de recette

**Dans le catalogue personnel:**
- La recette est créée avec `communityId = null`
- Seul le créateur peut la voir

**Dans une communauté:**
```
CONDITION: l'utilisateur DOIT être membre de la communauté

1. Créer la recette dans le catalogue personnel (communityId = null)
2. Créer une COPIE dans la communauté (communityId = community.id)
3. La copie communautaire a originRecipeId = recette_personnelle.id
4. Créer un ActivityLog (type: RECIPE_CREATED)
```

### 3.2 Modification de recette
- **Catalogue personnel:** Le créateur peut modifier librement
- **Communauté:** Seul le créateur de la recette communautaire peut modifier directement
- Les autres membres doivent passer par le système de propositions

### 3.3 Suppression de recette (soft delete)
- Le créateur peut supprimer sa recette
- La suppression est un soft delete (`deletedAt`)
- Supprimer une recette personnelle **ne supprime pas** les copies communautaires
- Supprimer une recette communautaire **ne supprime pas** la recette personnelle

### 3.4 Tags
- Une recette peut avoir **plusieurs tags**
- Les tags sont globaux (partagés entre communautés)
- Création de tag à la volée si inexistant

---

## 4. Système de propositions

### 4.1 Créer une proposition
```
CONDITIONS:
- L'utilisateur DOIT être membre de la communauté
- La recette DOIT appartenir à cette communauté
- L'utilisateur NE PEUT PAS proposer sur sa propre recette

ACTIONS:
1. Créer RecipeUpdateProposal (status: PENDING)
2. Créer ActivityLog (type: VARIANT_PROPOSED)
3. [Futur] Notifier le créateur de la recette
```

### 4.2 Accepter une proposition
```
CONDITIONS:
- L'utilisateur DOIT être le créateur de la recette cible
- La proposition DOIT être en status PENDING

ACTIONS:
1. Mettre à jour la recette communautaire avec le contenu proposé
2. Mettre à jour la recette personnelle originale (si liée)
3. Mettre à jour RecipeUpdateProposal (status: ACCEPTED, decidedAt: now)
4. Créer ActivityLog (type: PROPOSAL_ACCEPTED)
```

### 4.3 Refuser une proposition
```
CONDITIONS:
- L'utilisateur DOIT être le créateur de la recette cible
- La proposition DOIT être en status PENDING

ACTIONS:
1. Créer une NOUVELLE recette (variante):
   - Contenu = contenu proposé
   - creatorId = proposer.id
   - communityId = même communauté
   - originRecipeId = recette_cible.id
   - isVariant = true
2. Mettre à jour RecipeUpdateProposal (status: REJECTED, decidedAt: now)
3. Créer ActivityLog (type: VARIANT_CREATED)
```

### 4.4 Visualisation des variantes
- Sur la page d'une recette, afficher toutes les recettes où `originRecipeId = recette.id`
- Présentation en liste déroulante (dropdown)
- Tri par date de création (plus récent en premier)

---

## 5. Partage inter-communautés (Fork)

### 5.1 Conditions de partage
```
L'utilisateur DOIT:
- Être membre de la communauté SOURCE
- Être membre de la communauté CIBLE
- Être ADMIN dans au moins une des deux communautés OU être le créateur de la recette
```

### 5.2 Processus de fork
```
1. Créer une NOUVELLE recette dans la communauté cible:
   - Copier title, content, tags
   - creatorId = utilisateur qui partage
   - communityId = communauté cible
   - originRecipeId = recette originale
   - sharedFromCommunityId = communauté source

2. Incrémenter RecipeAnalytics.shares de la recette source
3. Incrémenter RecipeAnalytics.forks de la recette source
4. Créer ActivityLog (type: RECIPE_SHARED) dans les deux communautés
```

### 5.3 Indépendance des forks
- La recette forkée est **totalement indépendante**
- Elle peut recevoir ses propres propositions et variantes
- Les modifications sur l'originale n'affectent pas les forks
- Les modifications sur le fork n'affectent pas l'originale

---

## 6. Activity Feed

### 6.1 Événements trackés

| Type | Déclencheur | Données |
|------|-------------|---------|
| `RECIPE_CREATED` | Création de recette dans communauté | recipeId, communityId |
| `RECIPE_SHARED` | Fork d'une recette | recipeId, communityId, metadata.fromCommunityId |
| `VARIANT_PROPOSED` | Nouvelle proposition | recipeId, proposalId |
| `VARIANT_CREATED` | Proposition refusée | recipeId (variante), originRecipeId |
| `PROPOSAL_ACCEPTED` | Proposition acceptée | recipeId, proposalId |
| `PROPOSAL_REJECTED` | Proposition refusée | recipeId, proposalId |
| `USER_JOINED` | Nouveau membre | communityId |
| `USER_LEFT` | Membre quitte | communityId |
| `USER_PROMOTED` | Promotion en admin | communityId, metadata.promotedUserId |

### 6.2 Requêtes feed
- Feed par communauté: `WHERE communityId = X ORDER BY createdAt DESC`
- Feed personnel: `WHERE userId = X OR recipeId IN (user's recipes) ORDER BY createdAt DESC`

---

## 7. Analytics (préparé mais désactivé MVP)

### 7.1 Compteurs
- `views`: Incrémenté à chaque consultation de la page recette
- `shares`: Incrémenté lors d'un fork
- `forks`: Incrémenté lors d'un fork

### 7.2 Tracking détaillé
- RecipeView stocke chaque vue individuelle
- Permet l'analyse par utilisateur et par période
- Désactivé par défaut pour le MVP

---

## 8. Règles de validation

### 8.1 Recette
```typescript
{
  title: string, min: 3, max: 200
  content: string, min: 10, max: 50000
  imageUrl?: string, format: URL
  tags?: string[], max: 10 tags
}
```

### 8.2 Communauté
```typescript
{
  name: string, min: 3, max: 100
  description?: string, max: 1000
}
```

### 8.3 Proposition
```typescript
{
  proposedTitle: string, min: 3, max: 200
  proposedContent: string, min: 10, max: 50000
}
```

---

## 9. Codes d'erreur

| Code | Message | Contexte |
|------|---------|----------|
| `AUTH_001` | Non authentifié | Accès route protégée |
| `AUTH_002` | Session expirée | Session invalide |
| `COMMUNITY_001` | Non membre | Accès communauté sans membership |
| `COMMUNITY_002` | Permission insuffisante | Action admin sans être admin |
| `COMMUNITY_003` | Dernier admin | Tentative de quitter en tant que dernier admin |
| `RECIPE_001` | Recette non trouvée | ID invalide ou soft deleted |
| `RECIPE_002` | Non propriétaire | Modification sans être créateur |
| `PROPOSAL_001` | Proposition invalide | Auto-proposition interdite |
| `PROPOSAL_002` | Déjà décidée | Proposition non-pending |
| `SHARE_001` | Non membre source | Pas dans la communauté source |
| `SHARE_002` | Non membre cible | Pas dans la communauté cible |
| `SHARE_003` | Permission partage | Ni admin ni créateur |

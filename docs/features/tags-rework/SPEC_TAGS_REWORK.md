# Specification : Rework du systeme de Tags

> **Statut** : SPEC VALIDEE - En attente d'implementation
> **Date** : 2026-02-12
> **Prerequis** : MVP complet (phases 0-8)
> **Roadmap** : `ROADMAP.md` (meme dossier)

---

## 1. Vue d'ensemble

Le systeme actuel de tags est "plat" : une table globale unique, creation a la volee par n'importe quel utilisateur. Ce rework introduit **3 niveaux de portee** et un **systeme de validation** par les moderateurs.

### 1.1 Les 3 niveaux de tags

| Niveau | Cree par | Visible par | Cycle de vie |
|--------|----------|-------------|--------------|
| **Global** | SuperAdmin | Tout le monde, partout | Permanent (CRUD SuperAdmin) |
| **Communaute** | Moderateur (ou valide par moderateur) | Membres de la communaute | Permanent tant que la communaute existe |
| **Pending** | N'importe quel membre | Membres de la communaute (style different) | Temporaire, en attente de validation |

### 1.2 Principe cle

La creation libre de tags a la volee est **supprimee**. Seuls les SuperAdmin (global) et moderateurs (communaute) peuvent creer des tags definitifs. Les membres peuvent **proposer** des tags, qui passent par un processus de validation.

---

## 2. Schema de donnees

### 2.1 Modifications du modele Tag

```
Tag (modifie)
  id          String    @id @default(uuid())
  name        String    @unique
  scope       TagScope  @default(GLOBAL)    // NOUVEAU
  communityId String?                        // NOUVEAU - null si GLOBAL
  status      TagStatus @default(APPROVED)   // NOUVEAU
  createdById String?                        // NOUVEAU - userId du createur (null si SuperAdmin)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  community   Community? @relation(fields: [communityId], references: [id])
  createdBy   User?      @relation(fields: [createdById], references: [id])
  recipes     RecipeTag[]

  @@unique([name, communityId])  // Remplace @@unique sur name seul
  @@index([communityId, status])
  @@index([name])
```

### 2.2 Nouveaux enums

```
TagScope: GLOBAL | COMMUNITY

TagStatus: APPROVED | PENDING | REJECTED
```

### 2.3 Nouveau modele : TagSuggestion

Pour les suggestions de tags sur les recettes d'autres membres.

```
TagSuggestion
  id          String              @id @default(uuid())
  recipeId    String
  tagName     String              // Nom du tag suggere (normalise)
  suggestedById String
  status      TagSuggestionStatus @default(PENDING_OWNER)
  createdAt   DateTime            @default(now())
  decidedAt   DateTime?

  recipe      Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  suggestedBy User   @relation(fields: [suggestedById], references: [id])

  @@unique([recipeId, tagName, suggestedById])
  @@index([recipeId, status])
```

```
TagSuggestionStatus: PENDING_OWNER | PENDING_MODERATOR | APPROVED | REJECTED
```

### 2.4 Nouveau modele : UserCommunityTagPreference

Preference de visibilite des tags communautaires dans le catalogue personnel.

```
UserCommunityTagPreference
  userId      String
  communityId String
  showTags    Boolean  @default(true)
  updatedAt   DateTime @updatedAt

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  community Community @relation(fields: [communityId], references: [id], onDelete: Cascade)

  @@id([userId, communityId])
```

### 2.5 Nouveau modele : ModeratorNotificationPreference

Preference de notification des moderateurs pour les tags pending.

```
ModeratorNotificationPreference
  userId      String
  communityId String?    // null = preference globale (toutes les communautes)
  tagNotifications Boolean @default(true)
  updatedAt   DateTime    @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  community Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)

  @@id([userId, communityId])
```

### 2.6 RecipeTag (inchange)

```
RecipeTag
  recipeId String
  tagId    String

  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  tag      Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([recipeId, tagId])
```

---

## 3. Regles d'unicite des noms

| Situation | Autorise ? |
|-----------|------------|
| Tag global "Italien" + tag communaute "Italien" | **NON** - le global a la priorite |
| Tag communaute A "Fait maison" + tag communaute B "Fait maison" | **OUI** - communautes isolees |
| Tag communaute A "Pizza" (APPROVED) + tag pending communaute A "Pizza" | **NON** - doublon dans la meme communaute |
| Tag pending communaute A "Pizza" + un autre user veut "Pizza" dans A | **OK** - reutilise le tag pending existant |
| Tag global "Dessert" + creation d'un tag communaute "Dessert" | **NON** - erreur, le global existe deja |

**Regle de validation a la creation :**
1. Verifier qu'aucun tag GLOBAL n'a le meme nom (normalise)
2. Verifier qu'aucun tag (COMMUNITY, APPROVED ou PENDING) n'a le meme nom dans la meme communaute

---

## 4. Cycles de vie

### 4.1 Creation de tag global (SuperAdmin)

```
1. SuperAdmin cree un tag via le panneau admin
2. Tag cree : scope=GLOBAL, communityId=null, status=APPROVED
3. Verifier unicite : aucun tag global avec le meme nom
4. AdminActivityLog : TAG_CREATED
5. Le tag est immediatement visible partout
```

### 4.2 Creation de tag communaute (Moderateur)

```
1. Moderateur cree un tag via le panneau d'admin tags de la communaute
2. Tag cree : scope=COMMUNITY, communityId=X, status=APPROVED
3. Verifier unicite : pas de global avec meme nom + pas de communaute meme nom dans X
4. ActivityLog : TAG_CREATED (dans la communaute)
5. Le tag est immediatement visible dans la communaute
```

### 4.3 Tag pending (Membre cree un tag inconnu)

```
DECLENCHEUR : Membre cree/edite une recette communautaire avec un tag qui n'existe pas
  (ni en global, ni en communaute pour cette communaute)

ACTIONS :
1. Tag cree : scope=COMMUNITY, communityId=X, status=PENDING, createdById=userId
2. RecipeTag cree normalement (la recette est associee au tag pending)
3. Notification envoyee aux moderateurs de la communaute (selon preferences)
4. La recette est creee/mise a jour normalement
5. Le tag pending est affiche avec un style different (couleur/badge)

REUTILISATION D'UN TAG PENDING :
  Si un autre utilisateur (ou le meme) veut utiliser le meme tag pending
  sur une autre recette de la meme communaute :
  → PAS de refus, PAS de creation d'un nouveau tag
  → RecipeTag cree en pointant vers le tag PENDING existant
  → Pas de nouvelle notification (les moderateurs savent deja)
  → Le tag pending accumule des RecipeTag en attendant la decision

RESOLUTION PAR MODERATEUR :
  A) Valider :
     → Tag.status = APPROVED
     → TOUTES les recettes utilisant ce tag passent en style normal
     → Notification au createur du tag : "Votre tag X a ete valide"

  B) Rejeter :
     → Hard delete du tag
     → Hard delete de TOUS les RecipeTag associes (cascade)
     → Notification au createur du tag : "Votre tag X a ete rejete"
     → Notification aux autres utilisateurs ayant utilise ce tag pending
```

### 4.4 TagSuggestion (Suggestion de tag sur la recette d'un autre)

```
DECLENCHEUR : Membre veut ajouter un tag sur une recette communautaire dont il n'est pas
  le createur

ETAPE 1 - Validation par le proprietaire de la recette :
1. TagSuggestion cree : status=PENDING_OWNER
2. Notification au proprietaire de la recette
3. Le proprietaire accepte ou refuse :
   A) Refuse → TagSuggestion.status = REJECTED, fin
   B) Accepte → passer a l'etape 2

ETAPE 2 - Le tag existe-t-il deja ?
  A) Tag global ou tag communaute APPROVED existe :
     → RecipeTag cree directement
     → TagSuggestion.status = APPROVED, fin

  B) Tag inconnu (n'existe pas en global ni en communaute) :
     → Tag cree en PENDING (comme section 4.3)
     → RecipeTag cree (tag pending, style different)
     → TagSuggestion.status = PENDING_MODERATOR
     → Notification aux moderateurs
     → Quand le moderateur valide le tag pending :
       → TagSuggestion.status = APPROVED
     → Quand le moderateur rejette le tag pending :
       → TagSuggestion.status = REJECTED
       → RecipeTag supprime (cascade du tag)
```

---

## 5. Visibilite des tags

### 5.1 Dans une communaute

L'autocomplete propose :
1. Tous les tags **GLOBAL** (status=APPROVED)
2. Tous les tags **COMMUNITY** de cette communaute (status=APPROVED)
3. *Pas* les tags pending, *pas* les tags d'autres communautes

### 5.2 Dans le catalogue personnel

L'autocomplete propose :
1. Tous les tags **GLOBAL**
2. Les tags **COMMUNITY** (APPROVED) des communautes auxquelles l'utilisateur appartient
   **ET** pour lesquelles `UserCommunityTagPreference.showTags = true` (defaut: true)

### 5.3 Affichage sur une recette

| Type de tag | Style |
|-------------|-------|
| Global (APPROVED) | Normal (couleur principale) |
| Communaute (APPROVED) | Normal (couleur principale) |
| Pending | Couleur differente (ex: gris, contour pointille, badge "en attente") |

---

## 6. Partage inter-communaute (fork) et tags

```
Quand une recette est partagee (fork) vers une communaute cible :

POUR CHAQUE TAG de la recette source :
  1. Tag GLOBAL → copie directe, rien a faire
  2. Tag COMMUNITY qui existe aussi dans la communaute cible → copie directe
  3. Tag COMMUNITY qui N'EXISTE PAS dans la communaute cible :
     → Tag cree en PENDING dans la communaute cible
     → RecipeTag cree (tag pending)
     → Notification aux moderateurs de la communaute cible
     → Les moderateurs valident ou rejettent (meme process que 4.3)
```

---

## 7. Synchronisation (rappel)

**Les tags restent LOCAUX a chaque recette.** Pas de synchronisation entre :
- Recette personnelle et copies communautaires
- Copies communautaires dans differentes communautes

Seuls titre, contenu, imageUrl et ingredients sont synchronises (comportement existant inchange).

---

## 8. Administration

### 8.1 SuperAdmin (existant, etendu)

Les endpoints admin existants restent, avec adaptation :
- **Lister tags** : filtre par scope (GLOBAL / COMMUNITY / tous)
- **Creer tag** : scope=GLOBAL uniquement
- **Renommer tag** : n'importe quel tag (global ou communaute)
- **Supprimer tag** : n'importe quel tag
- **Fusionner tags** : les deux tags doivent etre du meme scope et meme communaute (ou les deux globaux)

### 8.2 Panneau moderateur (NOUVEAU)

Accessible aux moderateurs d'une communaute.

**Endpoints :**

```
GET    /api/communities/:id/tags                  → Liste des tags (APPROVED + PENDING)
POST   /api/communities/:id/tags                  → Creer un tag communaute
PUT    /api/communities/:id/tags/:tagId            → Renommer un tag communaute
DELETE /api/communities/:id/tags/:tagId            → Supprimer un tag communaute
POST   /api/communities/:id/tags/:tagId/approve    → Valider un tag pending
POST   /api/communities/:id/tags/:tagId/reject     → Rejeter un tag pending
```

**Contraintes :**
- Seuls les MODERATOR/ADMIN de la communaute peuvent acceder
- Un moderateur ne peut pas modifier/supprimer un tag GLOBAL (c'est le SuperAdmin)
- Un moderateur ne peut agir que sur les tags de sa communaute

### 8.3 TagSuggestion endpoints (NOUVEAU)

```
POST   /api/recipes/:recipeId/tag-suggestions          → Suggerer un tag
GET    /api/recipes/:recipeId/tag-suggestions           → Voir les suggestions (owner/moderator)
POST   /api/tag-suggestions/:id/accept                  → Owner accepte la suggestion
POST   /api/tag-suggestions/:id/reject                  → Owner rejette la suggestion
```

---

## 9. Preferences utilisateur

### 9.1 Visibilite tags communautaires (catalogue perso)

```
GET    /api/users/me/tag-preferences                    → Liste des preferences
PUT    /api/users/me/tag-preferences/:communityId       → Activer/desactiver
```

**Defaut :** `showTags = true` pour chaque communaute. L'entree est creee a la volee quand l'utilisateur rejoint une communaute (ou au premier toggle).

### 9.2 Notifications moderateur

```
GET    /api/users/me/notification-preferences            → Preferences de notification
PUT    /api/users/me/notification-preferences/tags        → Toggle global
PUT    /api/users/me/notification-preferences/tags/:communityId → Toggle par communaute
```

**Defaut :** `tagNotifications = true` globalement. Le moderateur peut desactiver globalement ou par communaute.

---

## 10. Notifications (WebSocket)

### 10.1 Evenements emis

| Evenement | Destinataires | Declencheur |
|-----------|---------------|-------------|
| `tag:pending` | Moderateurs de la communaute (si notifications activees) | Nouveau tag pending cree |
| `tag:approved` | Createur du tag pending | Moderateur valide le tag |
| `tag:rejected` | Createur du tag pending | Moderateur rejette le tag |
| `tag-suggestion:new` | Proprietaire de la recette | Nouveau TagSuggestion |
| `tag-suggestion:approved` | Auteur de la suggestion | Owner accepte |
| `tag-suggestion:rejected` | Auteur de la suggestion | Owner rejette |
| `tag-suggestion:pending-mod` | Moderateurs | Suggestion acceptee par owner mais tag inconnu |

---

## 11. Migration de l'existant

### 11.1 Tags existants

```
1. Tous les tags existants deviennent scope=GLOBAL, status=APPROVED, communityId=null
2. Les RecipeTag existants restent inchanges
3. La contrainte @@unique passe de [name] a [name, communityId]
4. Ajout des nouveaux champs avec valeurs par defaut
```

### 11.2 Aucune perte de donnees

- Les tags deja associes aux recettes restent associes
- Les recettes ne perdent aucun tag
- Le SuperAdmin retrouve tous les tags dans son panneau (filtres GLOBAL)

---

## 12. Regles de validation

### 12.1 Tag

```typescript
{
  name: string, min: 2, max: 50, normalise (trim + lowercase)
}
```

### 12.2 Limites

- Max **10 tags** par recette (inchange)
- Max **100 tags COMMUNITY** par communaute (nouveau, pour eviter l'abus)
- Pas de limite sur les tags GLOBAL (gere par SuperAdmin)

---

## 13. Recettes orphelines et tags pending

```
SI une recette communautaire devient orpheline (createur parti) :
  - Les tags APPROVED restent sur la recette
  - Les tags PENDING restent (le moderateur peut toujours valider/rejeter)
  - Les TagSuggestion PENDING_OWNER sont auto-rejetees (plus de proprietaire)
```

---

## 14. Suppression de communaute et tags

```
SI une communaute est supprimee (soft delete) :
  - Tous les tags COMMUNITY de cette communaute deviennent inaccessibles
    (filtres par community.deletedAt dans les requetes)
  - Les RecipeTag restent en base (les recettes sont aussi soft deleted)
  - Les TagSuggestion en cours sont auto-rejetees
  - Les UserCommunityTagPreference restent (nettoyees par le soft delete filter)
  - Les ModeratorNotificationPreference restent (idem)
```

---

## 15. Codes d'erreur (NOUVEAUX)

| Code | Message | Contexte |
|------|---------|----------|
| `TAG_001` | Tag non trouve | ID invalide ou supprime |
| `TAG_002` | Nom de tag deja utilise | Unicite violee (global ou meme communaute) |
| `TAG_003` | Limite de tags atteinte | >10 sur une recette ou >100 dans une communaute |
| `TAG_004` | Permission insuffisante | Non-moderateur essaie d'admin les tags |
| `TAG_005` | Tag global non modifiable | Moderateur essaie de modifier un tag global |
| `TAG_006` | Suggestion deja existante | Meme tag suggere par meme user sur meme recette |
| `TAG_007` | Auto-suggestion interdite | User suggere un tag sur sa propre recette |

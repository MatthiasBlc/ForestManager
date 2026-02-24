# Specification : Rework du systeme de Notifications

> **Statut** : DRAFT - En cours de validation
> **Date** : 2026-02-24
> **Prerequis** : Phase 11 complete (Ingredients Rework)
> **Roadmap** : `ROADMAP.md` (meme dossier)

---

## 1. Vue d'ensemble

Le systeme actuel est purement temps-reel (WebSocket) sans persistance. Les notifications sont perdues si l'utilisateur est deconnecte. Ce rework introduit :

- **Persistance en base** de toutes les notifications personnelles
- **Centre de notifications** (dropdown + page dediee)
- **Statut lu/non-lu** avec badge temps-reel
- **Preferences granulaires** par categorie, globalement et par communaute
- **Groupement** des notifications broadcast communautaires
- **Retention intelligente** : 30 jours pour les lues, illimitee pour les non-lues
- **Lien contextuel** dans chaque notification pour navigation directe

### 1.1 Ce qui change

| Aspect | Avant | Apres |
|--------|-------|-------|
| Persistance | Aucune (WebSocket only) | Table `Notification` en DB |
| Offline | Notifications perdues | Stockees, delivrees a la reconnexion |
| UI | Dropdown invitations uniquement | Dropdown toutes notifs + page dediee |
| Statut | Aucun | Lu/non-lu avec tracking |
| Preferences | Tags moderateurs uniquement | Par categorie, tous les users |
| Groupement | Aucun | Broadcasts communaute groupes |
| Retention | N/A | 30j lues / illimitee non-lues |

### 1.2 Ce qui ne change pas

- **Systeme admin** : reste separe, son propre fonctionnement
- **ActivityLog** : reste intact, coexiste avec les notifications
- **Architecture WebSocket** : Socket.io conserve, enrichi
- **Rooms Socket.io** : meme structure (`user:{id}`, `community:{id}`)
- **EventEmitter** : meme pattern d'emission, enrichi pour la persistance

### 1.3 Coexistence ActivityLog / Notification

| | ActivityLog | Notification |
|---|---|---|
| **But** | Flux d'activite communautaire public | Alerte personnelle pour un utilisateur |
| **Destinataire** | Aucun (visible par tous les membres) | Un utilisateur specifique |
| **Statut lu** | Non | Oui (readAt) |
| **Action** | Non | Oui (lien contextuel) |
| **Retention** | Illimitee | 30j lues / illimitee non-lues |

Un meme evenement peut creer a la fois une entree ActivityLog ET des Notifications. Exemple : `RECIPE_CREATED` -> 1 ActivityLog + N Notifications (1 par membre de la communaute, sauf l'auteur).

---

## 2. Schema de donnees

### 2.1 Nouveau modele : Notification

```
Notification
  id            String    @id @default(uuid())
  userId        String                          // Destinataire
  type          String                          // Type d'evenement (INVITE_SENT, PROPOSAL_ACCEPTED...)
  category      NotificationCategory            // Categorie (enum)
  title         String                          // Titre court
  message       String                          // Message complet
  actionUrl     String?                         // Lien contextuel (route frontend relative)
  metadata      Json?                           // Donnees supplementaires pour le rendu

  // Contexte source
  actorId       String?                         // Qui a declenche l'evenement
  communityId   String?                         // Communaute concernee
  recipeId      String?                         // Recette concernee

  // Groupement (broadcasts uniquement)
  groupKey      String?                         // Cle de groupement (ex: "community:{id}:RECIPE_CREATED")

  // Etat
  readAt        DateTime?                       // null = non lue
  createdAt     DateTime  @default(now())

  // Relations
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  actor         User?     @relation("NotificationActor", fields: [actorId], references: [id], onDelete: SetNull)
  community     Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)
  recipe        Recipe?   @relation(fields: [recipeId], references: [id], onDelete: SetNull)

  @@index([userId, readAt, createdAt])          // Requete principale : notifs non-lues d'un user
  @@index([userId, createdAt])                  // Pagination chronologique
  @@index([userId, groupKey, createdAt])        // Groupement
  @@index([createdAt])                          // Job de nettoyage
```

### 2.2 Modele modifie : NotificationPreference (remplace ModeratorNotificationPreference)

```
NotificationPreference
  id            String    @id @default(uuid())
  userId        String
  communityId   String?                         // null = preference globale
  category      NotificationCategory
  enabled       Boolean   @default(true)
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  community     Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)

  @@unique([userId, communityId, category])
```

**Migration** : les donnees de `ModeratorNotificationPreference` sont migrees vers `NotificationPreference` avec `category = TAG`. L'ancien modele est supprime.

### 2.3 Enum NotificationCategory

```
enum NotificationCategory {
  INVITATION          // INVITE_SENT, INVITE_ACCEPTED, INVITE_REJECTED, INVITE_CANCELLED
  RECIPE_PROPOSAL     // VARIANT_PROPOSED, PROPOSAL_ACCEPTED, PROPOSAL_REJECTED, RECIPE_CREATED, RECIPE_SHARED
  TAG                 // TAG_SUGGESTION_*, TAG_APPROVED, TAG_REJECTED, tag-suggestion:pending-mod, tag:pending
  INGREDIENT          // INGREDIENT_APPROVED, INGREDIENT_REJECTED, INGREDIENT_MERGED, INGREDIENT_MODIFIED
  MODERATION          // USER_PROMOTED, USER_KICKED, USER_LEFT
}
```

### 2.4 Mapping type -> categorie

| Categorie | Types d'evenements |
|-----------|-------------------|
| `INVITATION` | `INVITE_SENT`, `INVITE_ACCEPTED`, `INVITE_REJECTED`, `INVITE_CANCELLED` |
| `RECIPE_PROPOSAL` | `VARIANT_PROPOSED`, `PROPOSAL_ACCEPTED`, `PROPOSAL_REJECTED`, `RECIPE_CREATED`, `RECIPE_SHARED` |
| `TAG` | `TAG_SUGGESTION_CREATED`, `TAG_SUGGESTION_ACCEPTED`, `TAG_SUGGESTION_REJECTED`, `tag-suggestion:pending-mod`, `tag:pending`, `tag:approved`, `tag:rejected` |
| `INGREDIENT` | `INGREDIENT_APPROVED`, `INGREDIENT_MODIFIED`, `INGREDIENT_MERGED`, `INGREDIENT_REJECTED` |
| `MODERATION` | `USER_PROMOTED`, `USER_KICKED`, `USER_LEFT` |

---

## 3. Groupement des notifications

### 3.1 Principe

Seuls les **broadcasts communautaires** sont groupes. Les notifications personnelles (directement adressees a un utilisateur via `targetUserIds`) ne sont jamais groupees.

### 3.2 Notifications groupables

| Type | groupKey | Exemple de message groupe |
|------|----------|--------------------------|
| `RECIPE_CREATED` | `community:{id}:RECIPE_CREATED` | "3 nouvelles recettes dans {communaute}" |
| `RECIPE_SHARED` | `community:{id}:RECIPE_SHARED` | "2 recettes partagees dans {communaute}" |
| `USER_JOINED` (via INVITE_ACCEPTED broadcast) | `community:{id}:USER_JOINED` | "2 nouveaux membres dans {communaute}" |

### 3.3 Regles de groupement

- **Fenetre temporelle** : notifications avec le meme `groupKey` dans les **60 minutes** sont groupees
- **Stockage** : chaque notification est stockee individuellement en DB (1 row par user par event)
- **Groupement a la lecture** : le groupement se fait cote backend lors de la requete API, pas a l'ecriture
- **Affichage** : le groupe montre le nombre d'elements et un lien vers la communaute
- **Expansion** : cliquer sur un groupe affiche les notifications individuelles (sur la page dediee uniquement)
- **Lu/non-lu** : marquer un groupe comme lu marque toutes les notifications du groupe

### 3.4 Algorithme de groupement (backend, au moment du fetch)

```
1. Recuperer les notifications du user (paginees)
2. Pour celles qui ont un groupKey non-null :
   a. Grouper par groupKey
   b. Dans chaque groupe, fusionner celles dont le createdAt est dans une fenetre de 60 min
   c. Si un groupe contient >= 2 notifications, renvoyer comme groupe
   d. Si un groupe contient 1 seule notification, renvoyer comme notification individuelle
3. Les notifications sans groupKey sont renvoyees telles quelles
4. Trier le tout par date (date du plus recent element pour les groupes)
```

---

## 4. Preferences utilisateur

### 4.1 Categories de preferences

Chaque utilisateur peut activer/desactiver les notifications par categorie :

| Categorie | Label UI | Description | Default |
|-----------|----------|-------------|---------|
| `INVITATION` | Invitations | Invitations recues, acceptees, refusees | `true` |
| `RECIPE_PROPOSAL` | Recettes & Proposals | Nouvelles recettes, proposals de modifications | `true` |
| `TAG` | Tags | Suggestions de tags, validations | `true` |
| `INGREDIENT` | Ingredients | Approbations, rejets d'ingredients | `true` |
| `MODERATION` | Moderation | Promotions, exclusions de communaute | `true` |

### 4.2 Hierarchie des preferences

```
1. Preference par communaute (si existe) -> utilisee
2. Sinon, preference globale (si existe) -> utilisee
3. Sinon, defaut (true) -> utilisee
```

Identique au systeme actuel des preferences moderateurs, mais generalise a tous les users et toutes les categories.

### 4.3 Comportement

- **Preference desactivee** : la notification n'est **pas creee** en DB et n'est **pas envoyee** par WebSocket
- **Pas de retroactivite** : changer une preference n'affecte pas les notifications deja creees
- **Defaults** : toutes les categories sont activees par defaut (pas de row en DB = active)

### 4.4 Cas particulier : notifications non-desactivables

Certaines notifications sont **toujours envoyees**, quelle que soit la preference :

- `USER_KICKED` : l'utilisateur doit savoir qu'il a ete exclu
- `INVITE_SENT` : l'utilisateur doit voir ses invitations

Ces types ignorent les preferences et sont toujours crees + envoyes.

---

## 5. Cycle de vie d'une notification

### 5.1 Creation

```
Evenement dans l'application (ex: recette creee)
  |
  v
appEvents.emitActivity(event)
  |
  v
Listener dans socketServer / notificationService
  |
  +---> Creer ActivityLog (existant, inchange)
  |
  +---> Determiner les destinataires :
  |       - targetUserIds (notifs personnelles)
  |       - OU tous les membres de la communaute sauf l'acteur (broadcasts)
  |
  +---> Pour chaque destinataire :
  |       1. Verifier les preferences (categorie activee ?)
  |       2. Si oui : creer Notification en DB
  |       3. Si user connecte : emettre via WebSocket
  |
  +---> Emettre notification:count aux users connectes concernes
```

### 5.2 Lecture (mark as read)

Trois modes :

1. **Click sur une notification** : `PATCH /api/notifications/:id/read` -> set `readAt = now()`
2. **Vue dans le dropdown** : apres 3 secondes d'ouverture, les notifications **visibles** dans le dropdown sont marquees comme lues via `PATCH /api/notifications/read` (batch, envoie les IDs visibles)
3. **Mark all as read** : `PATCH /api/notifications/read-all` -> set `readAt = now()` sur toutes les non-lues de l'utilisateur. Filtrable par categorie.

### 5.3 Nettoyage (retention)

Job planifie (cron quotidien) :

```sql
DELETE FROM "Notification"
WHERE "readAt" IS NOT NULL
  AND "createdAt" < NOW() - INTERVAL '30 days';
```

- Les notifications **lues** de plus de 30 jours sont supprimees
- Les notifications **non-lues** sont conservees indefiniment
- L'ActivityLog n'est pas affecte

---

## 6. API REST

### 6.1 Notifications

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/notifications` | Liste paginee des notifications (avec groupement) |
| `GET` | `/api/notifications/unread-count` | Nombre de notifications non-lues |
| `PATCH` | `/api/notifications/:id/read` | Marquer une notification comme lue |
| `PATCH` | `/api/notifications/read` | Marquer un batch comme lu (body: `{ ids: string[] }`) |
| `PATCH` | `/api/notifications/read-all` | Tout marquer comme lu (optionnel: `{ category?: string }`) |

#### GET /api/notifications

**Query params** :
- `page` (number, default 1)
- `limit` (number, default 20, max 50)
- `category` (NotificationCategory, optionnel) - filtre par categorie
- `unreadOnly` (boolean, default false) - ne renvoyer que les non-lues
- `grouped` (boolean, default true) - activer le groupement

**Response** :
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "PROPOSAL_ACCEPTED",
      "category": "RECIPE_PROPOSAL",
      "title": "Proposal acceptee",
      "message": "Votre proposal sur 'Tarte aux pommes' a ete acceptee",
      "actionUrl": "/communities/{id}/recipes/{id}",
      "actor": { "id": "uuid", "username": "alice" },
      "community": { "id": "uuid", "name": "Les Gourmands" },
      "readAt": null,
      "createdAt": "2026-02-24T10:00:00Z",
      "group": null
    },
    {
      "id": "group:community:{id}:RECIPE_CREATED:2026-02-24T09",
      "type": "RECIPE_CREATED",
      "category": "RECIPE_PROPOSAL",
      "title": "Nouvelles recettes",
      "message": "3 nouvelles recettes dans Les Gourmands",
      "actionUrl": "/communities/{id}",
      "community": { "id": "uuid", "name": "Les Gourmands" },
      "readAt": null,
      "createdAt": "2026-02-24T09:45:00Z",
      "group": {
        "count": 3,
        "notificationIds": ["uuid1", "uuid2", "uuid3"],
        "items": [
          { "id": "uuid1", "message": "alice a cree 'Tarte aux pommes'", "createdAt": "..." },
          { "id": "uuid2", "message": "bob a cree 'Gratin dauphinois'", "createdAt": "..." },
          { "id": "uuid3", "message": "charlie a cree 'Ratatouille'", "createdAt": "..." }
        ]
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  },
  "unreadCount": 7
}
```

#### GET /api/notifications/unread-count

**Response** :
```json
{
  "count": 7,
  "byCategory": {
    "INVITATION": 2,
    "RECIPE_PROPOSAL": 3,
    "TAG": 1,
    "INGREDIENT": 1,
    "MODERATION": 0
  }
}
```

### 6.2 Preferences

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/notifications/preferences` | Toutes les preferences de l'utilisateur |
| `PUT` | `/api/notifications/preferences` | Mettre a jour une preference |

#### GET /api/notifications/preferences

**Response** :
```json
{
  "global": {
    "INVITATION": true,
    "RECIPE_PROPOSAL": true,
    "TAG": true,
    "INGREDIENT": true,
    "MODERATION": true
  },
  "communities": [
    {
      "communityId": "uuid",
      "communityName": "Les Gourmands",
      "preferences": {
        "INVITATION": true,
        "RECIPE_PROPOSAL": false,
        "TAG": true,
        "INGREDIENT": true,
        "MODERATION": true
      }
    }
  ]
}
```

#### PUT /api/notifications/preferences

**Body** :
```json
{
  "category": "RECIPE_PROPOSAL",
  "enabled": false,
  "communityId": "uuid"       // optionnel, null = global
}
```

---

## 7. WebSocket

### 7.1 Evenements emis (serveur -> client)

| Evenement | Payload | Quand |
|-----------|---------|-------|
| `notification:new` | `{ notification: Notification }` | Nouvelle notification creee pour ce user |
| `notification:count` | `{ count: number, byCategory: {...} }` | Mise a jour du compteur non-lu |

### 7.2 Changements par rapport a l'existant

- L'evenement `notification` existant est **remplace** par `notification:new` qui contient l'objet Notification complet (avec id, actionUrl, etc.)
- L'evenement `activity` reste inchange (broadcast communautaire pour le feed)
- Nouvel evenement `notification:count` emis a chaque creation/lecture de notification

### 7.3 Reconnexion (offline recovery)

A la connexion/reconnexion du socket :

1. Le serveur emet `notification:count` avec le nombre total de non-lues
2. Le client fetch `GET /api/notifications?unreadOnly=true&limit=10` pour afficher les recentes
3. Pas de "replay" des evenements manques : tout est en DB, le client fetch via REST

---

## 8. Interface utilisateur

### 8.1 Dropdown notifications (Navbar)

**Remplacement** du `NotificationDropdown` actuel (invitations only).

**Composants** :
- **Bell icon** avec badge numerique (compteur non-lues, cap a 99+)
- **Panneau dropdown** (largeur ~380px) :
  - Header : "Notifications" + bouton "Tout marquer comme lu"
  - Liste des ~10 dernieres notifications (lues + non-lues)
  - Notifications non-lues : fond legerement surligne
  - Groupes collapses (ex: "3 nouvelles recettes dans X")
  - Chaque notification : icone categorie + texte + temps relatif + point non-lu
  - Footer : lien "Voir toutes les notifications" -> page dediee

**Comportement** :
- Ouverture : fetch les 10 dernieres notifications
- Auto-mark as read : les notifications visibles sont marquees comme lues apres 3 secondes d'ouverture continue
- Click sur notification : navigation vers `actionUrl` + mark as read + fermeture dropdown
- Click sur groupe : navigation vers la communaute
- Mise a jour temps-reel : nouvelles notifs ajoutees en haut de la liste

### 8.2 Page notifications dediee

**Route** : `/notifications`

**Composants** :
- Header : "Notifications" + bouton "Tout marquer comme lu"
- Filtres : par categorie (chips/tabs) + toggle "Non-lues uniquement"
- Liste paginee (load more / infinite scroll) de toutes les notifications
- Groupes expansibles : clic sur un groupe affiche les notifications individuelles
- Chaque notification : icone categorie + avatar acteur + texte complet + temps relatif + lien action

### 8.3 Page preferences (profil)

**Remplacement** du `NotificationPreferencesSection` actuel.

**Composants** :
- Section "Notifications" dans la page profil
- Pour chaque categorie : toggle global on/off
- Sous chaque categorie : overrides par communaute (liste des communautes de l'utilisateur)
- Indication visuelle quand une preference communaute differe de la globale
- Accessible a tous les utilisateurs (plus reserve aux moderateurs)

### 8.4 Invitations dans le nouveau systeme

Les invitations (`INVITE_SENT`) deviennent des notifications comme les autres, avec `actionUrl` pointant vers un endroit ou l'utilisateur peut accepter/refuser. Les boutons Accept/Reject dans le dropdown sont remplaces par un lien vers la gestion des invitations.

---

## 9. Messages de notification

### 9.1 Notifications personnelles

| Type | Titre | Message | Action URL |
|------|-------|---------|------------|
| `INVITE_SENT` | Nouvelle invitation | "{actor} vous invite a rejoindre {communaute}" | `/invitations` |
| `INVITE_ACCEPTED` | Invitation acceptee | "{actor} a accepte votre invitation pour {communaute}" | `/communities/{id}` |
| `INVITE_REJECTED` | Invitation refusee | "{actor} a decline votre invitation pour {communaute}" | `/communities/{id}` |
| `INVITE_CANCELLED` | Invitation annulee | "L'invitation pour {communaute} a ete annulee" | null |
| `VARIANT_PROPOSED` | Nouvelle proposal | "{actor} propose une modification sur '{recette}'" | `/communities/{id}/recipes/{id}` |
| `PROPOSAL_ACCEPTED` | Proposal acceptee | "Votre proposal sur '{recette}' a ete acceptee" | `/communities/{id}/recipes/{id}` |
| `PROPOSAL_REJECTED` | Proposal refusee | "Votre proposal sur '{recette}' a ete refusee" | `/communities/{id}/recipes/{id}` |
| `USER_PROMOTED` | Promotion moderateur | "Vous etes maintenant moderateur de {communaute}" | `/communities/{id}` |
| `USER_KICKED` | Exclusion | "Vous avez ete retire de {communaute}" | null |
| `TAG_SUGGESTION_CREATED` | Suggestion de tag | "{actor} suggere le tag '{tag}' sur '{recette}'" | `/communities/{id}/recipes/{id}` |
| `TAG_SUGGESTION_ACCEPTED` | Suggestion acceptee | "Votre suggestion de tag '{tag}' a ete acceptee" | `/communities/{id}/recipes/{id}` |
| `TAG_SUGGESTION_REJECTED` | Suggestion refusee | "Votre suggestion de tag '{tag}' a ete refusee" | `/communities/{id}/recipes/{id}` |
| `tag-suggestion:pending-mod` | Tag en attente | "Un tag suggere attend votre validation dans {communaute}" | `/communities/{id}/tags` |
| `tag:pending` | Tag en attente | "Un nouveau tag attend validation dans {communaute}" | `/communities/{id}/tags` |
| `tag:approved` | Tag valide | "Votre tag '{tag}' a ete valide dans {communaute}" | `/communities/{id}` |
| `tag:rejected` | Tag rejete | "Votre tag '{tag}' a ete rejete dans {communaute}" | `/communities/{id}` |
| `INGREDIENT_APPROVED` | Ingredient valide | "Votre ingredient '{name}' a ete valide" | null |
| `INGREDIENT_MODIFIED` | Ingredient renomme | "Votre ingredient a ete valide sous le nom '{newName}'" | null |
| `INGREDIENT_MERGED` | Ingredient fusionne | "Votre ingredient '{name}' a ete fusionne avec '{targetName}'" | null |
| `INGREDIENT_REJECTED` | Ingredient rejete | "Votre ingredient '{name}' a ete rejete : {reason}" | null |

### 9.2 Notifications broadcast (groupables)

| Type | Titre (individuel) | Message groupe | Action URL | groupKey |
|------|-------|---------|------------|----------|
| `RECIPE_CREATED` | Nouvelle recette | "{count} nouvelles recettes dans {communaute}" | `/communities/{id}` | `community:{id}:RECIPE_CREATED` |
| `RECIPE_SHARED` | Recette partagee | "{count} recettes partagees dans {communaute}" | `/communities/{id}` | `community:{id}:RECIPE_SHARED` |
| `USER_JOINED` | Nouveau membre | "{count} nouveaux membres dans {communaute}" | `/communities/{id}` | `community:{id}:USER_JOINED` |
| `USER_LEFT` | Depart | "{count} membres ont quitte {communaute}" | `/communities/{id}` | `community:{id}:USER_LEFT` |

---

## 10. Performances et scalabilite

### 10.1 Volumetrie estimee

- Communautes privees, invite-only : taille moyenne estimee ~10-50 membres
- Un broadcast vers une communaute de 50 membres = 49 rows en DB (excluant l'acteur)
- Retention 30 jours pour les lues = volume maitrise

### 10.2 Optimisations

- **Index** sur `[userId, readAt, createdAt]` pour les requetes principales
- **Batch insert** pour les broadcasts (1 query Prisma `createMany` plutot que N `create`)
- **Groupement cote backend** lors du fetch (pas de table de groupement separee)
- **Cache du compteur non-lu** : calcule une fois au connect, incremente/decremente via events
- **Job de nettoyage quotidien** : suppression des lues > 30 jours en batch

### 10.3 Limites

- Le groupement est fait a la lecture, pas a l'ecriture -> chaque notification est stockee individuellement
- Pour des communautes de 50 membres, un broadcast = 49 inserts. Acceptable pour cette echelle.
- Si la volumetrie augmentait significativement, on pourrait evoluer vers un modele `Notification` + `UserNotification` (notification partagee + table pivot pour le statut lu). Pas necessaire a cette echelle.

---

## 11. Migration

### 11.1 Donnees

1. **Creer** la table `Notification`
2. **Creer** la table `NotificationPreference`
3. **Migrer** les donnees de `ModeratorNotificationPreference` vers `NotificationPreference` (category = TAG)
4. **Supprimer** la table `ModeratorNotificationPreference`
5. **Pas de retroactivite** : les notifications existantes ne sont pas recreees a partir de l'ActivityLog

### 11.2 Code

1. Remplacer `ModeratorNotificationPreference` par `NotificationPreference` dans le Prisma schema
2. Adapter `notificationService.ts` pour utiliser le nouveau modele
3. Remplacer les endpoints de preferences existants
4. Mettre a jour les controllers qui appellent `getModeratorIdsForTagNotifications` pour utiliser le nouveau service

### 11.3 Frontend

1. Remplacer `NotificationDropdown` par le nouveau centre de notifications
2. Remplacer `NotificationPreferencesSection` par la nouvelle UI preferences
3. Adapter `useNotificationToasts` pour utiliser les nouveaux evenements WebSocket
4. Creer la page `/notifications`

---

## 12. Codes erreur

| Code | HTTP | Description |
|------|------|-------------|
| `NOTIF_001` | 404 | Notification non trouvee |
| `NOTIF_002` | 403 | Notification appartient a un autre utilisateur |
| `NOTIF_003` | 400 | Categorie de notification invalide |
| `NOTIF_004` | 400 | IDs de notifications invalides (batch read) |
| `NOTIF_005` | 400 | Parametre de pagination invalide |

---

## 13. Securite

- Un utilisateur ne peut lire/modifier que **ses propres** notifications
- Les preferences sont isolees par utilisateur
- Le compteur non-lu est calcule par utilisateur authentifie
- Pas d'exposition des notifications d'un autre utilisateur via l'API
- Les `actionUrl` sont des routes relatives frontend (pas de redirections externes)
- Rate limiting sur les endpoints de notification (meme config que le reste de l'API)

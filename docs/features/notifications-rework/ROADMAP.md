# Roadmap : Rework Notifications (Phase 12)

> **Spec** : `docs/features/notifications-rework/SPEC_NOTIFICATIONS_REWORK.md`
> **Branche** : `NotificationsUpgrade`

---

## 12.1 - Schema & Migration

- [x] Nouveau modele Prisma `Notification` (avec index)
- [x] Nouveau modele Prisma `NotificationPreference`
- [x] Enum `NotificationCategory` (INVITATION, RECIPE_PROPOSAL, TAG, INGREDIENT, MODERATION)
- [x] Migration des donnees `ModeratorNotificationPreference` → `NotificationPreference` (category=TAG)
- [x] Suppression du modele `ModeratorNotificationPreference`
- [x] Tests migration

## 12.2 - Backend Service de notifications

- [x] `notificationService.ts` : refonte complete
  - [x] `createNotification(userId, type, data)` : creation unitaire avec resolution titre/message/actionUrl/category/groupKey
  - [x] `createBroadcastNotifications(communityId, type, data)` : creation pour tous les membres (sauf acteur), batch insert
  - [x] `checkPreference(userId, communityId, category)` : verification preferences (hierarchie global > communaute > defaut)
  - [x] Mapping `type → category` centralise
  - [x] Mapping `type → { title, message, actionUrl }` centralise (templates avec variables)
- [x] Tests unitaires service (30 tests)

## 12.3 - Backend API Notifications (CRUD + lecture)

- [x] `GET /api/notifications` : liste paginee avec groupement
  - [x] Pagination (page, limit)
  - [x] Filtre par categorie
  - [x] Filtre non-lues uniquement
  - [x] Algorithme de groupement (groupKey + fenetre 60min)
- [x] `GET /api/notifications/unread-count` : compteur non-lues (total + par categorie)
- [x] `PATCH /api/notifications/:id/read` : marquer une notification comme lue
- [x] `PATCH /api/notifications/read` : batch mark as read (body: ids[])
- [x] `PATCH /api/notifications/read-all` : tout marquer comme lu (optionnel: category)
- [x] Middleware auth sur tous les endpoints
- [x] Validation : notification appartient bien au user connecte
- [x] Codes erreur (NOTIF_001 a NOTIF_005)
- [x] Tests integration endpoints (27 tests)

## 12.4 - Backend API Preferences

- [x] `GET /api/notifications/preferences` : preferences utilisateur (global + par communaute)
- [x] `PUT /api/notifications/preferences` : modifier une preference (category, enabled, communityId?)
- [x] Migration des endpoints existants (`/api/users/me/notification-preferences/*`)
- [x] Suppression des anciens endpoints de preferences tags
- [x] Tests integration preferences (12 tests)

## 12.5 - Backend WebSocket & Integration evenements

- [x] Modifier le listener `socketServer.ts` : a chaque `appEvents.emitActivity`
  - [x] Appel au service de creation de notifications (persistance DB)
  - [x] Emission `notification:new` (remplace `notification`) aux users connectes
  - [x] Emission `notification:count` aux users concernes
- [x] A la connexion socket : emettre `notification:count` initial
- [x] Gestion des notifications non-desactivables (USER_KICKED, INVITE_SENT)
- [x] Adaptation des controllers existants (aucun changement cote emission `appEvents`, tout est dans le listener)
- [x] Tests integration WebSocket (8 tests: auth, connection, count, activity, broadcast, personal, preferences, non-disableable)

## 12.6 - Backend Job de nettoyage

- [x] Job cron quotidien : suppression des notifications lues > 30 jours (daily 03:00)
- [x] Execution en batch (500 par batch, eviter lock table longue)
- [x] Logs du nombre de notifications nettoyees
- [x] Tests job nettoyage (6 tests)

## 12.7 - Frontend Dropdown notifications

- [x] Nouveau composant `NotificationDropdown` (remplacement complet)
  - [x] Bell icon avec badge numerique (compteur non-lues, cap 99+)
  - [x] Panneau dropdown : header + liste + footer "Voir tout"
  - [x] Rendu notifications individuelles (icone categorie, texte, temps relatif, dot non-lu)
  - [x] Rendu notifications groupees (collapsed, compteur)
  - [x] Click notification : navigation actionUrl + mark as read + fermeture
  - [x] Auto-mark as read : notifications visibles marquees apres 3s d'ouverture
  - [x] Bouton "Tout marquer comme lu"
- [x] Hook `useNotifications` : fetch, cache, pagination, mark as read
- [x] Hook `useUnreadCount` : compteur temps-reel (init REST + update WebSocket)
- [x] Adaptation `useNotificationToasts` : utiliser `notification:new` au lieu de `notification`
- [x] Suppression de l'ancien `NotificationDropdown` (invitations only)
- [x] Tests composants

## 12.8 - Frontend Page notifications

- [x] Route `/notifications` + page `NotificationsPage`
- [x] Liste paginee (load more) de toutes les notifications
- [x] Filtres : chips par categorie + toggle non-lues uniquement
- [x] Groupes expansibles (clic pour voir les notifications individuelles)
- [x] Bouton "Tout marquer comme lu" (global ou par categorie)
- [x] Navigation contextuelle (click → actionUrl)
- [x] Etat vide ("Aucune notification")
- [x] Tests page

## 12.9 - Frontend Preferences notifications

- [x] Refonte `NotificationPreferencesSection` dans la page profil
  - [x] Visible pour tous les utilisateurs (plus reserve moderateurs)
  - [x] Toggle par categorie (5 categories) au niveau global
  - [x] Overrides par communaute sous chaque categorie
  - [x] Indication visuelle si preference communaute differe de la globale
- [x] Suppression de l'ancien composant preferences tags moderateurs
- [x] Tests composants preferences

## 12.10 - Finalisation & documentation

- [x] Tests end-to-end du flux complet : creation evenement → notif DB → WebSocket → dropdown → mark as read
- [x] Test offline : deconnexion → evenements → reconnexion → notifs presentes
- [x] Générer les tests manuels (`MANUAL_TESTS.md`)
- [x] Nettoyage code mort (InvitationBadge socket event, legacy NotificationPreferences type, dead import)
- [x] Mise a jour `.claude/context/` (API_MAP, DB_MODELS, FILE_MAP, TESTS, PROGRESS)
- [x] Mise a jour CLAUDE.md (codes erreur, phase courante, docs table)

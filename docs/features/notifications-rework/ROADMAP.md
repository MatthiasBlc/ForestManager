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

- [ ] Job cron quotidien : suppression des notifications lues > 30 jours
- [ ] Execution en batch (eviter lock table longue)
- [ ] Logs du nombre de notifications nettoyees
- [ ] Tests job nettoyage

## 12.7 - Frontend Dropdown notifications

- [ ] Nouveau composant `NotificationDropdown` (remplacement complet)
  - [ ] Bell icon avec badge numerique (compteur non-lues, cap 99+)
  - [ ] Panneau dropdown : header + liste + footer "Voir tout"
  - [ ] Rendu notifications individuelles (icone categorie, texte, temps relatif, dot non-lu)
  - [ ] Rendu notifications groupees (collapsed, compteur)
  - [ ] Click notification : navigation actionUrl + mark as read + fermeture
  - [ ] Auto-mark as read : notifications visibles marquees apres 3s d'ouverture
  - [ ] Bouton "Tout marquer comme lu"
- [ ] Hook `useNotifications` : fetch, cache, pagination, mark as read
- [ ] Hook `useUnreadCount` : compteur temps-reel (init REST + update WebSocket)
- [ ] Adaptation `useNotificationToasts` : utiliser `notification:new` au lieu de `notification`
- [ ] Suppression de l'ancien `NotificationDropdown` (invitations only)
- [ ] Tests composants

## 12.8 - Frontend Page notifications

- [ ] Route `/notifications` + page `NotificationsPage`
- [ ] Liste paginee (load more) de toutes les notifications
- [ ] Filtres : chips par categorie + toggle non-lues uniquement
- [ ] Groupes expansibles (clic pour voir les notifications individuelles)
- [ ] Bouton "Tout marquer comme lu" (global ou par categorie)
- [ ] Navigation contextuelle (click → actionUrl)
- [ ] Etat vide ("Aucune notification")
- [ ] Tests page

## 12.9 - Frontend Preferences notifications

- [ ] Refonte `NotificationPreferencesSection` dans la page profil
  - [ ] Visible pour tous les utilisateurs (plus reserve moderateurs)
  - [ ] Toggle par categorie (5 categories) au niveau global
  - [ ] Overrides par communaute sous chaque categorie
  - [ ] Indication visuelle si preference communaute differe de la globale
- [ ] Suppression de l'ancien composant preferences tags moderateurs
- [ ] Tests composants preferences

## 12.10 - Finalisation & documentation

- [ ] Tests end-to-end du flux complet : creation evenement → notif DB → WebSocket → dropdown → mark as read
- [ ] Test offline : deconnexion → evenements → reconnexion → notifs presentes
- [ ] Générer les tests manuels
- [ ] Nettoyage code mort (anciens hooks, composants, endpoints)
- [ ] Mise a jour `.claude/context/` (API_MAP, DB_MODELS, FILE_MAP, TESTS, PROGRESS)
- [ ] Mise a jour CLAUDE.md (codes erreur, phase courante)

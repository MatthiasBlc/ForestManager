# Development Roadmap - Forest Manager

## Vue d'ensemble

Ce document decrit les phases de developpement du MVP de Forest Manager, avec les taches techniques associees.

---

## Phase 0: Setup & Infrastructure

### 0.1 Configuration initiale
- [x] Setup boilerplate (React + Express + PostgreSQL + Docker)
- [x] Configuration Docker Compose
- [x] CI/CD GitHub Actions
- [x] Mise a jour du schema Prisma selon PRISMA_SCHEMA.prisma
- [x] Configuration des variables d'environnement (SESSION_SECRET, ADMIN_SESSION_SECRET)
- [x] Installation @quixo3/prisma-session-store
- [x] Migration initiale creee et appliquee

### 0.2 Structure du code
- [x] Creation de l'arborescence backend (services/, middleware/, admin/)
- [x] Creation de l'arborescence frontend (pages/, components/, hooks/, contexts/)
- [x] Configuration ESLint/Prettier uniformes
- [x] Setup des types TypeScript partages (frontend/src/models/)

### Livrables
- Projet demarrable en local via `docker-compose up`
- Schema BDD complet et migre
- Structure de code prete pour le developpement

---

## Phase 0.5: SuperAdmin & Briques (NOUVEAU)

### 0.5.1 Backend Admin
- [x] Installation dependances (otplib, qrcode)
- [x] Creation module admin/ isole
  - admin/controllers/
  - admin/routes/
  - admin/middleware/
- [x] Model AdminUser (Prisma schema)
- [x] Model AdminSession (Prisma session separee)
- [x] Model Feature (briques)
- [x] Model CommunityFeature (attribution)
- [x] Model AdminActivityLog (audit)
- [x] Script CLI `npm run admin:create`
  - Prompt username, email, password
  - Hash password bcrypt
  - Genere totpSecret

### 0.5.2 Backend Auth Admin
- [x] Configuration double session store
  - Session users: `connect.sid` → model Session
  - Session admin: `admin.sid` → model AdminSession
  - Cookie flags: httpOnly, secure (prod), sameSite=strict
- [x] Middleware requireSuperAdmin
  - Verifie session.adminId
  - Verifie session.totpVerified
- [x] Route POST /api/admin/auth/login
  - Premiere connexion: retourne QR code (base64)
  - Connexions suivantes: demande code TOTP
  - **Securite**: Rate limiting (5 tentatives/15min)
- [x] Route POST /api/admin/auth/totp/verify
  - Verifie code TOTP (fenetre 1 step = 30s)
  - **Securite**: Invalide apres 3 echecs consecutifs (reset session)
  - Log ADMIN_LOGIN et ADMIN_TOTP_SETUP (AdminActivityLog)
- [x] Route POST /api/admin/auth/logout
  - Destruction complete session admin
  - Log ADMIN_LOGOUT (AdminActivityLog)
- [x] Route GET /api/admin/auth/me
  - Retourne infos admin (sans totpSecret)

### 0.5.3 Backend Admin API
- [x] Routes Tags CRUD (/api/admin/tags)
  - GET, POST, PATCH, DELETE, POST merge
- [x] Routes Ingredients CRUD (/api/admin/ingredients)
  - GET, POST, PATCH, DELETE, POST merge
- [x] Routes Communities (/api/admin/communities)
  - GET list, GET detail, PATCH, DELETE
- [x] Routes Features (/api/admin/features)
  - GET, POST, PATCH
  - POST /communities/:id/features/:featureId (grant)
  - DELETE /communities/:id/features/:featureId (revoke)
- [x] Route Dashboard (/api/admin/dashboard/stats)
- [x] Route Activity (/api/admin/activity)
- [x] AdminActivityLog sur toutes les actions

### 0.5.4 Seed Feature MVP
- [x] Ajouter feature MVP dans seed
  - code: "MVP", isDefault: true
- [x] Modifier creation communaute
  - Attribution auto features par defaut

### 0.5.5 Frontend Admin (NOUVEAU)
- [x] Route React /admin/login
  - Etape 1: Formulaire email + password
  - Etape 2: Affichage QR code si !totpEnabled (setup initial)
  - Etape 3: Champ code TOTP (6 chiffres)
  - **Securite**: Pas de stockage token/secret cote client
  - **Securite**: Redirect si deja authentifie
- [x] Route React /admin/dashboard (protegee)
  - Layout admin separe du frontend user
  - Affichage stats basiques
- [x] Composant AdminProtectedRoute
  - Verifie session admin via /api/admin/auth/me
  - Redirect vers /admin/login si non authentifie
- [x] Context AdminAuthProvider (isole de AuthProvider user)

### 0.5.6 Securite Admin (transversal)
- [x] Rate limiting sur /api/admin/auth/* (express-rate-limit, 5/15min)
- [x] Rate limiting global sur /api/admin/* (30 req/min)
- [x] Headers securite (helmet)
  - CSP strict pour pages admin
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
- [x] HTTPS obligatoire en production (middleware requireHttps + HSTS)
- [x] Audit log actions auth admin (ADMIN_LOGIN, ADMIN_LOGOUT, ADMIN_TOTP_SETUP)
- [x] Session admin courte (30min, non renouvelable)

### Livrables
- SuperAdmin fonctionnel avec 2FA
- Interface admin minimale et securisee (login + dashboard)
- API admin complete (tags, ingredients, features, communities)
- Systeme de briques operationnel
- Feature MVP attribuee auto

---

## Phase 1: Authentification & Base

### 1.1 Backend Auth
- [ ] Route POST /api/auth/signup
  - Validation email, username, password
  - Hash password (bcrypt)
  - Creation session
- [ ] Route POST /api/auth/login
  - Verification credentials
  - Creation session
- [ ] Route POST /api/auth/logout
  - Destruction session
- [ ] Route GET /api/auth/me
  - Recuperation user courant
- [ ] Middleware requireAuth

### 1.2 Frontend Auth
- [ ] Page Login
- [ ] Page Signup
- [ ] Context AuthProvider
- [ ] Hook useAuth
- [ ] Protected routes
- [ ] Redirection automatique

### 1.3 Layout de base
- [ ] Header avec navigation
- [ ] Sidebar (communautes)
- [ ] Layout responsive

### Livrables
- Utilisateurs peuvent s'inscrire, se connecter, se deconnecter
- Navigation de base fonctionnelle

---

## Phase 2: Catalogue Personnel

### 2.1 Backend Recipes (personnel)
- [ ] Route POST /api/recipes
  - Creation recette personnelle
  - Gestion tags (creation a la volee si inexistant)
  - Gestion ingredients (creation a la volee si inexistant)
- [ ] Route GET /api/recipes
  - Liste paginee
  - Filtre par tags
  - Recherche par titre
- [ ] Route GET /api/recipes/:id
  - Detail recette
  - Verification acces (own or community member)
- [ ] Route PATCH /api/recipes/:id
  - Modification (owner only)
- [ ] Route DELETE /api/recipes/:id
  - Soft delete (owner only)

### 2.2 Frontend Catalogue
- [ ] Page liste recettes personnelles
- [ ] Page creation recette
  - Form: titre, contenu (editeur markdown)
  - Gestion tags (multi-select + creation a la volee)
  - Gestion ingredients (liste dynamique)
  - Upload image (optionnel)
- [ ] Page detail recette
- [ ] Page edition recette
- [ ] Composant RecipeCard
- [ ] Composant TagSelector
- [ ] Composant IngredientList

### Livrables
- CRUD complet sur les recettes personnelles
- Interface de creation/edition fonctionnelle

---

## Phase 3: Communautes & Invitations

### 3.1 Backend Communities
- [ ] Route POST /api/communities
  - Creation communaute
  - Ajout createur comme ADMIN
- [ ] Route GET /api/communities
  - Liste des communautes de l'utilisateur
- [ ] Route GET /api/communities/:id
  - Detail communaute
  - Middleware memberOf
- [ ] Route PATCH /api/communities/:id
  - Modification (admin only)

### 3.2 Backend Invitations (NOUVEAU)
- [ ] Route POST /api/communities/:id/invites
  - Envoi invitation (admin only)
  - Recherche user par email/username
  - Validation: pas deja membre, pas deja invite
  - Creation CommunityInvite (status: PENDING)
  - Log ActivityLog (INVITE_SENT)
- [ ] Route GET /api/communities/:id/invites
  - Liste invitations (admin only)
  - Filtre par status
- [ ] Route DELETE /api/communities/:id/invites/:inviteId
  - Annulation invitation (admin only)
  - Status → CANCELLED
  - Log ActivityLog (INVITE_CANCELLED)
- [ ] Route GET /api/users/me/invites
  - Invitations recues par l'utilisateur
  - Filtre par status
- [ ] Route POST /api/invites/:id/accept
  - Acceptation invitation
  - Creation UserCommunity (role: MEMBER)
  - Status → ACCEPTED
  - Log ActivityLog (INVITE_ACCEPTED, USER_JOINED)
- [ ] Route POST /api/invites/:id/reject
  - Refus invitation
  - Status → REJECTED
  - Log ActivityLog (INVITE_REJECTED)

### 3.3 Backend Members
- [ ] Route GET /api/communities/:id/members
- [ ] Route PATCH /api/communities/:id/members/:userId
  - Promotion (admin only, no demote)
  - Log ActivityLog (USER_PROMOTED)
- [ ] Route DELETE /api/communities/:id/members/:userId
  - Quitter (self) ou Retirer (admin kick)
  - Validation: admin ne peut pas kick un admin
  - Logique dernier admin (bloquer ou forcer promotion)
  - Suppression communaute si dernier membre (cascade soft delete)
  - Log ActivityLog (USER_LEFT ou USER_KICKED)

### 3.4 Frontend Communities
- [ ] Page liste mes communautes
- [ ] Page creation communaute
- [ ] Page detail communaute
  - Onglets: Recettes, Membres, Invitations (admin), Activite
- [ ] Composant MembersList
  - Bouton promotion (admin only, sur MEMBER)
  - Bouton retirer (admin only, sur MEMBER)
- [ ] Bouton quitter

### 3.5 Frontend Invitations (NOUVEAU)
- [ ] Page/Section invitations recues (/invites ou dans header)
- [ ] Badge notification nouvelles invitations
- [ ] Carte invitation avec boutons Accepter/Refuser
- [ ] Modal recherche utilisateur pour inviter
- [ ] Liste invitations envoyees (onglet admin)
- [ ] Bouton annuler invitation

### Livrables
- Gestion complete des communautes
- Systeme d'invitation avec acceptation explicite
- Systeme de roles fonctionnel
- Kick de membres

---

## Phase 4: Recettes Communautaires

### 4.1 Backend
- [ ] Route POST /api/communities/:id/recipes
  - Creation recette dans catalogue personnel (communityId: null)
  - Creation copie dans communaute (communityId: X)
  - Lien originRecipeId vers recette perso
  - Log ActivityLog (RECIPE_CREATED)
- [ ] Route GET /api/communities/:id/recipes
  - Liste recettes communaute
  - Pagination, filtre tags, recherche
- [ ] Modification routes recipes/:id
  - Gestion recettes communautaires (verification membership)

### 4.2 Frontend
- [ ] Liste recettes dans page communaute
- [ ] Creation recette depuis communaute
- [ ] Distinction visuelle perso vs communaute
- [ ] Lien vers communaute sur recette
- [ ] Badge "Partage depuis X" si sharedFromCommunityId

### Livrables
- Creation et affichage de recettes dans les communautes
- Copie automatique dans catalogue personnel
- Lien recette perso ↔ communautaire fonctionnel

---

## Phase 5: Propositions & Variantes

### 5.1 Backend Proposals
- [ ] Route GET /api/recipes/:id/proposals
  - Liste propositions (filtre status)
- [ ] Route POST /api/recipes/:id/proposals
  - Creation proposition
  - Validation: not own recipe, member
  - Log ActivityLog (VARIANT_PROPOSED)
- [ ] Route GET /api/proposals/:id
  - Detail proposition
- [ ] Route POST /api/proposals/:id/accept
  - Mise a jour recette communautaire
  - Mise a jour recette personnelle liee (via originRecipeId)
  - Status ACCEPTED
  - Log ActivityLog (PROPOSAL_ACCEPTED)
- [ ] Route POST /api/proposals/:id/reject
  - Creation variante (isVariant: true, originRecipeId, creatorId: proposer)
  - Status REJECTED
  - Log ActivityLog (VARIANT_CREATED)

### 5.2 Backend Variants
- [ ] Route GET /api/recipes/:id/variants
  - Liste variantes (where originRecipeId = X AND isVariant = true)

### 5.3 Frontend
- [ ] Bouton "Proposer modification" sur recette (pas sur ses propres)
- [ ] Page/Modal creation proposition (formulaire pre-rempli)
- [ ] Section propositions pour proprietaire (dans feed perso)
- [ ] Comparaison avant/apres
- [ ] Boutons Accept/Reject
- [ ] Dropdown variantes sur page recette

### Livrables
- Workflow complet de propositions
- Creation automatique de variantes
- Visualisation des variantes

---

## Phase 6: Activity Feed (communautaire + personnel)

### 6.1 Backend Activity
- [ ] Service ActivityService
  - Methode log() centralisee
  - Types d'evenements (enum ActivityType)
- [ ] Route GET /api/communities/:id/activity
  - Feed pagine par communaute
- [ ] Route GET /api/users/me/activity (NOUVEAU)
  - Feed personnel
  - Propositions sur mes recettes
  - Variantes de mes recettes
  - Invitations recues

### 6.2 Frontend Activity
- [ ] Composant ActivityFeed
- [ ] Integration dans page communaute (onglet)
- [ ] Page/Section feed personnel
- [ ] Formatage des evenements par type
- [ ] Liens vers elements concernes

### Livrables
- Activity feed communautaire fonctionnel
- Activity feed personnel fonctionnel

---

## Phase 7: Partage Inter-Communautes

### 7.1 Backend
- [ ] Route POST /api/recipes/:id/share
  - Validation membership deux communautes
  - Validation permission (admin OU createur)
  - Creation fork (originRecipeId, sharedFromCommunityId)
  - Log ActivityLog (RECIPE_SHARED) dans les deux communautes

### 7.2 Frontend
- [ ] Bouton "Partager dans une communaute"
- [ ] Modal selection communaute cible
- [ ] Badge "Partage depuis X" sur recettes forkees
- [ ] Lien vers origine (si accessible)

### Livrables
- Fork de recettes entre communautes fonctionnel
- Tracabilite des origines

---

## Phase 8: Finitions MVP

### 8.1 Qualite
- [ ] Gestion complete des erreurs frontend (toast/notification)
- [ ] Messages de confirmation/feedback
- [ ] Loading states (skeletons)
- [ ] Empty states (messages explicatifs)
- [ ] Gestion soft delete (filtrage automatique deletedAt IS NULL)

### 8.2 Tests
- [ ] Tests manuels complets (parcours utilisateur)
- [ ] Corrections bugs
- [ ] Verification toutes les regles metier

### 8.3 Documentation
- [ ] README utilisateur
- [ ] Guide de deploiement

### Livrables
- Application MVP complete et testee
- Prete pour mise en production

---

## Phase 9: (Post-MVP) Analytics & Ameliorations

### 9.1 Analytics
- [ ] Comptage vues (RecipeView, RecipeAnalytics)
- [ ] Affichage statistiques sur recettes
- [ ] Dashboard analytics

### 9.2 Ameliorations UX
- [ ] Recherche globale
- [ ] Notifications en temps reel (WebSocket)
- [ ] Mode sombre
- [ ] PWA / Offline support

### 9.3 Technique
- [ ] Tests unitaires
- [ ] Tests E2E
- [ ] Documentation API (Swagger)
- [ ] Monitoring / Logging

### 9.4 Frontend Admin - Pages de gestion
- [ ] Layout admin avec sidebar navigation
  - Dashboard, Tags, Ingredients, Features, Communities, Activity
- [ ] Page /admin/tags
  - Liste paginee avec recherche
  - Modal creation/edition tag
  - Bouton suppression avec confirmation
  - Fonctionnalite merge (selectionner 2+ tags)
- [ ] Page /admin/ingredients
  - Liste paginee avec recherche
  - Modal creation/edition ingredient
  - Bouton suppression avec confirmation
  - Fonctionnalite merge (selectionner 2+ ingredients)
- [ ] Page /admin/features
  - Liste des features avec statut (actif/inactif)
  - Modal creation/edition feature
  - Toggle actif/inactif
- [ ] Page /admin/communities
  - Liste paginee avec recherche
  - Detail communaute (membres, recettes, features)
  - Attribution/revocation features
  - Bouton suppression avec confirmation
- [ ] Page /admin/activity
  - Liste paginee des logs d'activite admin
  - Filtres par type d'action, date

---

## Estimation par phase

| Phase | Description | Complexite |
|-------|-------------|------------|
| 0 | Setup | Faible |
| **0.5** | **SuperAdmin & Briques** | **Haute** |
| 1 | Auth | Moyenne |
| 2 | Catalogue personnel | Moyenne |
| 3 | Communautes & Invitations | **Haute** |
| 4 | Recettes communautaires | Moyenne |
| 5 | Propositions & Variantes | Haute |
| 6 | Activity Feed | Moyenne |
| 7 | Partage inter-communautes | Moyenne |
| 8 | Finitions | Moyenne |

---

## Dependances entre phases

```
Phase 0 (Setup)
    │
    ▼
Phase 0.5 (SuperAdmin & Briques) ◄── Prerequis pour gestion plateforme
    │
    ▼
Phase 1 (Auth)
    │
    ▼
Phase 2 (Catalogue personnel)
    │
    ▼
Phase 3 (Communautes & Invitations) ◄── Attribution auto feature MVP
    │
    ├───────────────┐
    ▼               ▼
Phase 4         Phase 7
(Recettes       (Partage inter-communautes)
communautaires)    │
    │              │
    ▼              │
Phase 5 ◄──────────┘
(Propositions & Variantes)
    │
    ▼
Phase 6 (Activity Feed)
    │
    ▼
Phase 8 (Finitions MVP)
```

---

## Checklist de validation MVP

### SuperAdmin (Phase 0.5)
- [x] SuperAdmin cree via CLI (`npm run admin:create`)
- [x] SuperAdmin peut se connecter avec 2FA TOTP (backend ready)
- [x] SuperAdmin peut gerer les tags (CRUD, merge) (backend ready)
- [x] SuperAdmin peut gerer les ingredients (CRUD, merge) (backend ready)
- [x] SuperAdmin peut voir toutes les communautes (backend ready)
- [x] SuperAdmin peut supprimer une communaute (backend ready)
- [x] SuperAdmin peut attribuer/revoquer des features (backend ready)
- [x] Feature MVP attribuee auto a la creation communaute
- [x] Toutes les actions admin sont loguees

### Fonctionnel
- [ ] Un utilisateur peut s'inscrire et se connecter
- [ ] Un utilisateur peut creer des recettes personnelles
- [ ] Un utilisateur peut creer une communaute
- [ ] Un admin peut inviter des utilisateurs
- [ ] Un utilisateur voit ses invitations recues
- [ ] Un utilisateur peut accepter/refuser une invitation
- [ ] Un admin peut annuler une invitation
- [ ] Un admin peut promouvoir un membre en admin
- [ ] Un admin peut retirer un membre (mais pas un admin)
- [ ] Un membre peut creer une recette dans une communaute
- [ ] Une copie est creee dans son catalogue personnel
- [ ] Un membre peut proposer une modification
- [ ] Le createur peut accepter (mise a jour des deux recettes) ou refuser (variante)
- [ ] Les variantes sont visibles dans un dropdown
- [ ] Un utilisateur peut forker une recette vers une autre communaute
- [ ] L'activity feed communautaire montre les evenements
- [ ] L'activity feed personnel montre les propositions sur mes recettes

### Technique
- [ ] Application stable sans erreurs bloquantes
- [ ] Donnees persistees correctement
- [x] Sessions utilisateurs fonctionnelles (via @quixo3/prisma-session-store)
- [x] Sessions admin isolees (AdminSession, cookie admin.sid)
- [x] 2FA TOTP fonctionnel pour SuperAdmin (backend ready)
- [ ] Soft delete filtre correctement (deletedAt IS NULL)
- [ ] Responsive design
- [ ] Performance acceptable (<3s chargement page)

---

## Changements par rapport a la version precedente

1. **Phase 0.5 ajoutee** - SuperAdmin & Briques
   - Systeme SuperAdmin isole avec 2FA TOTP
   - Gestion globale tags/ingredients/communautes
   - Systeme de briques (Features) pour moduler les fonctionnalites

2. **Phase 3 elargie** - Communautes & Invitations
   - Ajout du systeme d'invitation avec acceptation explicite
   - Ajout du kick de membres
   - Attribution auto feature MVP a la creation

3. **Phase 6** - Activity Feed (communautaire + personnel)
   - Feed personnel inclus dans le MVP (upgrader de P3)

4. **Session store** - Specifie @quixo3/prisma-session-store
   - Session utilisateurs: connect.sid → Session
   - Session admin: admin.sid → AdminSession (isole)

5. **Checklist mise a jour** - Avec criteres SuperAdmin et 2FA

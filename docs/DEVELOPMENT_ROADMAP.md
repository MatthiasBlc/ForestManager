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

### Tests Phase 0.5
**Backend** (~60 tests):
- [x] `adminAuth.test.ts` - Auth 2FA admin (14 tests)
- [x] `adminTags.test.ts` - CRUD tags admin (12 tests)
- [x] `adminIngredients.test.ts` - CRUD ingredients admin (12 tests)
- [x] `adminFeatures.test.ts` - CRUD features + grant/revoke (10 tests)
- [x] `adminCommunities.test.ts` - Gestion communautes admin (8 tests)
- [x] `adminDashboard.test.ts` - Stats dashboard (4 tests)
- [x] `adminActivity.test.ts` - Logs activite (4 tests)

**Frontend** (~20 tests):
- [x] `AdminAuthContext.test.tsx` - Context admin 2FA (7 tests)
- [x] `AdminProtectedRoute.test.tsx` - Guard admin (4 tests)
- [x] `AdminLoginPage.test.tsx` - Page login 2FA (8 tests)
- [x] `AdminDashboardPage.test.tsx` - Page dashboard (6 tests)
- [x] `AdminLayout.test.tsx` - Layout admin (3 tests)

---

## Phase 1: Authentification & Base

### 1.1 Backend Auth
- [x] Route POST /api/auth/signup
  - Validation email, username, password
  - Hash password (bcrypt)
  - Creation session
- [x] Route POST /api/auth/login
  - Verification credentials
  - Creation session
- [x] Route POST /api/auth/logout
  - Destruction session
- [x] Route GET /api/auth/me
  - Recuperation user courant
- [x] Middleware requireAuth

### 1.2 Frontend Auth
- [x] Page Login (Modal - pattern UX hybride)
- [x] Page Signup (Page dediee - meilleur onboarding)
- [x] Context AuthProvider
- [x] Hook useAuth
- [x] Protected routes (ProtectedRoute component)
- [x] Redirection automatique

### 1.3 Layout de base
- [x] Header avec navigation (NavBar sticky)
- [x] Sidebar (communautes) - placeholder, ready for Phase 3
- [x] Layout responsive (DaisyUI drawer pattern)

### Livrables
- Utilisateurs peuvent s'inscrire, se connecter, se deconnecter
- Navigation de base fonctionnelle

### Tests Phase 1
**Backend** (~16 tests):
- [x] `auth.test.ts` - User signup/login/logout/me (16 tests)

**Frontend** (~25 tests):
- [x] `AuthContext.test.tsx` - Context auth user (6 tests)
- [x] `LoginModal.test.tsx` - Modal login (6 tests)
- [x] `Modal.test.tsx` - Composant modal (4 tests)
- [x] `SignUpPage.test.tsx` - Page inscription (6 tests)
- [x] `ProtectedRoute.test.tsx` - Guard user (5 tests)
- [x] `NavBar.test.tsx` - Navigation conditionnelle (4 tests)

---

## Phase 2: Catalogue Personnel

### 2.1 Backend Recipes (personnel)
- [x] Route POST /api/recipes
  - Creation recette personnelle
  - Gestion tags (creation a la volee si inexistant)
  - Gestion ingredients (creation a la volee si inexistant)
- [x] Route GET /api/recipes
  - Liste paginee (limit, offset, hasMore)
  - Filtre par tags (logique AND)
  - Recherche par titre (case-insensitive)
- [x] Route GET /api/recipes/:id
  - Detail recette avec tags et ingredients
  - Verification acces (owner only pour recettes perso)
- [x] Route PATCH /api/recipes/:id
  - Modification (owner only)
  - Mise a jour tags/ingredients (remplacement complet)
- [x] Route DELETE /api/recipes/:id
  - Soft delete (owner only)

### 2.2 Backend Autocomplete (NOUVEAU)
- [x] Route GET /api/tags
  - Recherche tags avec recipeCount
  - Limite configurable (max 100)
- [x] Route GET /api/ingredients
  - Recherche ingredients avec recipeCount
  - Limite configurable (max 100)

### 2.3 Frontend Catalogue
- [x] Page liste recettes personnelles
  - Grille responsive (1-4 colonnes)
  - Pagination "Load more"
  - Filtres persistés dans URL (search, tags)
- [x] Page creation recette (/recipes/new)
  - Form: titre, contenu (textarea), imageUrl (optionnel)
  - Gestion tags (TagSelector avec creation a la volee)
  - Gestion ingredients (IngredientList dynamique)
- [x] Page detail recette (/recipes/:id)
  - Affichage complet avec ingredients et instructions
  - Navigation vers filtres par tag
- [x] Page edition recette (/recipes/:id/edit)
  - Meme formulaire que creation, pre-rempli
- [x] Composant RecipeCard
  - Image, titre, tags (max 3), date, actions edit/delete
- [x] Composant TagSelector
  - Multi-select avec debounce 300ms
  - Creation on-the-fly
  - Mode filtre (sans creation)
- [x] Composant IngredientList
  - Liste dynamique avec autocomplete
  - Champs: nom, quantite (optionnel)
- [x] Composant RecipeFilters
  - Recherche titre + filtre tags
  - Bouton reset

### Livrables
- [x] CRUD complet sur les recettes personnelles
- [x] Interface de creation/edition fonctionnelle
- [x] Pagination et filtres fonctionnels

### Tests Phase 2
**Backend** (~40 tests):
- [x] `recipes.test.ts` - CRUD complet recettes (31 tests)
- [x] `tags.test.ts` - GET /api/tags autocomplete (5 tests)
- [x] `ingredients.test.ts` - GET /api/ingredients autocomplete (5 tests)

**Frontend** (~40 tests):
- [x] `RecipeCard.test.tsx` - Carte recette (8 tests)
- [x] `RecipeFilters.test.tsx` - Filtres search/tags/ingredients (8 tests)
- [x] `TagSelector.test.tsx` - Selecteur tags (6 tests)
- [x] `IngredientList.test.tsx` - Liste ingredients (6 tests)
- [x] `RecipesPage.test.tsx` - Page liste recettes (3 tests)
- [x] `MainLayout.test.tsx` - Layout principal (6 tests)
- [x] `Sidebar.test.tsx` - Navigation sidebar (10 tests)
- [x] `HomePage.test.tsx` - Page accueil (6 tests)

---

## Phase 3: Communautes & Invitations

### 3.1 Backend Communities
- [x] Route POST /api/communities
  - Creation communaute
  - Ajout createur comme MODERATOR (admin de communaute)
- [x] Route GET /api/communities
  - Liste des communautes de l'utilisateur
- [x] Route GET /api/communities/:id
  - Detail communaute
  - Middleware memberOf
- [x] Route PATCH /api/communities/:id
  - Modification (MODERATOR only)

### 3.2 Backend Invitations (NOUVEAU)
- [x] Route POST /api/communities/:id/invites
  - Envoi invitation (MODERATOR only)
  - Recherche user par email/username/userId
  - Validation: pas deja membre, pas deja invite PENDING
  - Creation CommunityInvite (status: PENDING)
  - Log ActivityLog (INVITE_SENT)
- [x] Route GET /api/communities/:id/invites
  - Liste invitations (MODERATOR only)
  - Filtre par status (default: PENDING, ou ?status=all)
- [x] Route DELETE /api/communities/:id/invites/:inviteId
  - Annulation invitation (MODERATOR only)
  - Status → CANCELLED
  - Log ActivityLog (INVITE_CANCELLED)
- [x] Route GET /api/users/me/invites
  - Invitations recues par l'utilisateur
  - Filtre par status
- [x] Route POST /api/invites/:id/accept
  - Acceptation invitation (invitee only)
  - Creation UserCommunity (role: MEMBER)
  - Status → ACCEPTED
  - Log ActivityLog (INVITE_ACCEPTED, USER_JOINED)
- [x] Route POST /api/invites/:id/reject
  - Refus invitation (invitee only)
  - Status → REJECTED
  - Log ActivityLog (INVITE_REJECTED)

### 3.3 Backend Members
- [x] Route GET /api/communities/:id/members
- [x] Route PATCH /api/communities/:id/members/:userId
  - Promotion (MODERATOR only, no demote)
  - Log ActivityLog (USER_PROMOTED)
- [x] Route DELETE /api/communities/:id/members/:userId
  - Quitter (self) ou Retirer (MODERATOR kick)
  - Validation: MODERATOR ne peut pas kick un MODERATOR
  - Logique dernier MODERATOR (bloquer si autres membres)
  - Suppression communaute si dernier membre (cascade soft delete)
  - Log ActivityLog (USER_LEFT ou USER_KICKED)

### 3.4 Frontend Communities
- [x] Page liste mes communautes (CommunitiesPage)
- [x] Page creation communaute (CommunityCreatePage)
- [x] Page detail communaute avec onglets Membres/Invitations/Recipes
- [x] Page edition communaute (CommunityEditPage, MODERATOR only)
- [x] Composant MembersList (promotion, retrait, leave)
- [x] Dashboard page (communautes + recettes, page d'accueil authentifiee)
- [x] Sidebar Discord-style avec avatars communautes (initiales)
- [x] Correction bug leave community (gestion 410, redirect)

### 3.5 Frontend Invitations
- [x] Page invitations recues (InvitationsPage)
- [x] Badge notification (InvitationBadge)
- [x] Carte invitation avec Accept/Reject (InviteCard)
- [x] Modal recherche utilisateur avec autocomplete (InviteUserModal)
- [x] Liste invitations envoyees (SentInvitesList)
- [x] Dropdown notifications dans navbar (NotificationDropdown)
- [x] Redirect vers communaute apres acceptation invitation

### 3.6 Frontend User Management
- [x] User menu (icone profil + dropdown dans navbar)
- [x] Page profil (modification username, email, mot de passe)
- [x] Backend PATCH /api/users/me (mise a jour profil)
- [x] Backend GET /api/users/search (autocomplete usernames)

### Livrables
- Gestion complete des communautes
- Systeme d'invitation avec acceptation explicite
- Systeme de roles fonctionnel
- Kick de membres

### Tests Phase 3
**Backend** (~50 tests):
- [x] `communities.test.ts` - CRUD communautes (27 tests)
- [x] `invitations.test.ts` - Systeme d'invitations (35 tests)
- [x] `members.test.ts` - Gestion membres, kick, promotion (22 tests)

**Frontend** (~31 tests):
- [x] `CommunitiesPage.test.tsx` - Liste communautes (7 tests)
- [x] `CommunityDetailPage.test.tsx` - Detail communaute (8 tests)
- [x] `InviteCard.test.tsx` - Carte invitation (5 tests)
- [x] `MembersList.test.tsx` - Liste membres (6 tests)
- [x] `InviteUserModal.test.tsx` - Modal invitation (5 tests)

---

## Phase 4: Recettes Communautaires

**Note**: La synchronisation bidirectionnelle (modif perso ↔ communautaire) sera implementee en Phase 5.

### 4.1 Backend
- [x] Route POST /api/communities/:id/recipes
  - Creation recette dans catalogue personnel (communityId: null)
  - Creation copie dans communaute (communityId: X)
  - Lien originRecipeId vers recette perso
  - Log ActivityLog (RECIPE_CREATED)
- [x] Route GET /api/communities/:id/recipes
  - Liste recettes communaute
  - Pagination, filtre tags, recherche
- [x] Modification routes recipes/:id
  - Gestion recettes communautaires (verification membership)

### 4.2 Frontend
- [x] Liste recettes dans page communaute
- [x] Creation recette depuis communaute
- [x] Distinction visuelle perso vs communaute
- [x] Lien vers communaute sur recette
- [ ] Badge "Partage depuis X" si sharedFromCommunityId

### Livrables
- Creation et affichage de recettes dans les communautes
- Copie automatique dans catalogue personnel
- Lien recette perso ↔ communautaire fonctionnel

---

## Phase 5: Propositions & Variantes

**Decisions metier validees (voir BUSINESS_RULES.md sections 3.2.1, 3.3.1, 4.2, 4.4, 5.4, 6.3):**
- Synchro bidirectionnelle: titre/contenu/ingredients synchronises, tags LOCAUX par communaute
- Conflit: bloquer acceptation si recipe.updatedAt > proposal.createdAt (PROPOSAL_003)
- Cascade: acceptation → 1 ActivityLog par communaute impactee
- Orphelins: permanent, pas de modification directe, propositions PENDING auto-refusees
- Variantes: coexistent, dropdown PLAT, tri par MAX(createdAt, updatedAt)
- Variantes de variantes OK, originRecipeId = parent immediat

### 5.1 Backend Proposals
- [x] Route GET /api/recipes/:id/proposals
  - Liste propositions (filtre status)
- [x] Route POST /api/recipes/:id/proposals
  - Creation proposition
  - Validation: not own recipe, member, recipe not orphan
  - Log ActivityLog (VARIANT_PROPOSED)
- [x] Route GET /api/proposals/:id
  - Detail proposition
- [x] Route POST /api/proposals/:id/accept
  - **Validation conflit**: bloquer si recipe.updatedAt > proposal.createdAt (PROPOSAL_003)
  - Mise a jour recette communautaire (titre, contenu - PAS tags)
  - Mise a jour recette personnelle liee (via originRecipeId)
  - **CASCADE**: Mise a jour de toutes les autres copies communautaires
  - **ActivityLog**: 1 entry PROPOSAL_ACCEPTED + 1 entry RECIPE_UPDATED par communaute
  - Status ACCEPTED
- [x] Route POST /api/proposals/:id/reject
  - Creation variante (isVariant: true, originRecipeId = parent, creatorId: proposer)
  - Status REJECTED
  - Log ActivityLog (VARIANT_CREATED)

### 5.2 Backend Variants
- [ ] Route GET /api/recipes/:id/variants
  - Liste variantes (where originRecipeId = X AND isVariant = true)
  - **Scope**: seulement les variantes de CETTE communaute
  - **Tri**: par MAX(createdAt, updatedAt) DESC

### 5.3 Backend Orphan Handling
- [ ] Service detectOrphanRecipes
  - Declenche quand: membre quitte/kick, compte supprime, recette perso supprimee
  - Marque les recettes comme orphelines (creatorId reste, flag isOrphan: true?)
  - Auto-refuse toutes les propositions PENDING → cree variantes
  - Log ActivityLog (VARIANT_CREATED) pour chaque auto-refus

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

<!-- User Stories: US-8.1 (Fork recette vers autre communaute), US-8.2 (Voir origine recette forkee) - voir docs/USER_STORIES.md Epic 8 -->

**Decisions metier validees (voir BUSINESS_RULES.md section 5):**
- originRecipeId pointe vers recette COMMUNAUTAIRE source (pas perso)
- Fork = totalement independant, pas de synchronisation
- Chaines de forks OK: A→B→C, origin = parent immediat
- Analytics: remontee en chaine (+1 pour A quand C fork B)

### 7.1 Backend
- [ ] Route POST /api/recipes/:id/share
  - Validation membership deux communautes
  - Validation permission (admin OU createur)
  - Creation fork:
    - originRecipeId = recette communautaire source
    - sharedFromCommunityId = communaute source
  - **Analytics chaine**: incrementer shares/forks de TOUS les ancetres
  - Log ActivityLog (RECIPE_SHARED) dans les deux communautes

### 7.2 Frontend
- [ ] Bouton "Partager dans une communaute"
- [ ] Modal selection communaute cible
- [ ] Badge "Partage depuis X" sur recettes forkees
- [ ] Lien vers origine (si accessible)

### Livrables
- Fork de recettes entre communautes fonctionnel
- Tracabilite des origines
- Analytics avec remontee en chaine

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
- [x] Un utilisateur peut s'inscrire et se connecter
- [x] Un utilisateur peut creer des recettes personnelles
- [x] Un utilisateur peut creer une communaute
- [x] Un MODERATOR peut inviter des utilisateurs (backend)
- [x] Un utilisateur voit ses invitations recues (backend)
- [x] Un utilisateur peut accepter/refuser une invitation (backend)
- [x] Un MODERATOR peut annuler une invitation (backend)
- [x] Un MODERATOR peut promouvoir un membre en MODERATOR (backend)
- [x] Un MODERATOR peut retirer un membre (mais pas un MODERATOR) (backend)
- [x] Un membre peut creer une recette dans une communaute
- [x] Une copie est creee dans son catalogue personnel
- [x] Un membre peut proposer une modification
- [x] Le createur peut accepter (mise a jour des deux recettes) ou refuser (variante)
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
- [x] Soft delete filtre correctement (deletedAt IS NULL)
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

---

## Maintenance technique (CI/CD)

### Dependances a mettre a jour
- [ ] Corriger les 3 vulnerabilites "high severity" (`npm audit fix`)
- [ ] Migrer otplib de v12 vers v13
- [ ] Mettre a jour ESLint vers une version supportee (v8.57.1 deprecie)
- [ ] Migrer config Prisma de `package.json#prisma` vers `prisma.config.ts` (deprecie Prisma 7)
- [ ] Remplacer `npm prune --production` par `--omit=dev` dans Dockerfile

---

## Tests

### Infrastructure

**Backend**:
- Framework: Vitest + Supertest
- DB: PostgreSQL test database (via `testPrisma`)
- Helpers: `backend/src/__tests__/setup/testHelpers.ts`
- Config: `backend/vitest.config.ts`

**Frontend**:
- Framework: Vitest + Testing Library + MSW
- Mocks: `frontend/src/__tests__/setup/mswHandlers.ts`
- Utils: `frontend/src/__tests__/setup/testUtils.tsx`
- Config: `frontend/vitest.config.ts`

### Commandes

```bash
# Backend
cd backend && npm test              # Lancer tous les tests
cd backend && npm run test:coverage # Tests avec couverture

# Frontend
cd frontend && npm test             # Lancer tous les tests
cd frontend && npm run test:coverage # Tests avec couverture

# CI/CD
# Les tests sont executes automatiquement dans deploy.yml:
# - Job: test-backend
# - Job: test-frontend
```

### Couverture cible
- Backend: > 80% sur controllers/routes
- Frontend: > 70% sur composants critiques

### Template pour nouvelles fonctionnalites

Lors de l'ajout d'une nouvelle fonctionnalite, inclure les tests suivants:

```markdown
### X.Y Nouvelle Fonctionnalite
- [ ] Implementation backend
- [ ] Implementation frontend
- [ ] **Tests backend**: [fichiers .test.ts]
  - Tests CRUD endpoints
  - Tests validation input
  - Tests error cases
  - Tests authentication/authorization
- [ ] **Tests frontend**: [fichiers .test.tsx]
  - Tests rendu composants
  - Tests interactions utilisateur
  - Tests etats (loading, error, success)
  - Tests integration avec API (MSW)
```

### Resume des tests implementes

| Categorie | Fichiers | Tests |
|-----------|----------|-------|
| Backend Auth | auth.test.ts, adminAuth.test.ts | ~30 |
| Backend Admin API | adminTags, adminIngredients, adminFeatures, adminCommunities, adminDashboard, adminActivity | ~50 |
| Backend User API | recipes.test.ts, tags.test.ts, ingredients.test.ts | ~42 |
| Backend Communities | communities.test.ts, communityRecipes.test.ts, invitations.test.ts, members.test.ts | ~112 |
| Backend Proposals | proposals.test.ts | ~31 |
| Frontend Contexts | AuthContext, AdminAuthContext | ~13 |
| Frontend Auth | LoginModal, Modal, SignUpPage, ProtectedRoute, NavBar | ~25 |
| Frontend Admin | AdminProtectedRoute, AdminLoginPage, AdminDashboardPage, AdminLayout | ~21 |
| Frontend Recipes | RecipeCard, RecipeFilters, TagSelector, IngredientList | ~28 |
| Frontend Pages | HomePage, RecipesPage, MainLayout, Sidebar | ~25 |
| **Total** | | **~377** |

# Development Roadmap - Forest Manager

## Vue d'ensemble

Ce document décrit les phases de développement du MVP de Forest Manager, avec les tâches techniques associées.

---

## Phase 0: Setup & Infrastructure

### 0.1 Configuration initiale
- [x] Setup boilerplate (React + Express + PostgreSQL + Docker)
- [x] Configuration Docker Compose
- [x] CI/CD GitHub Actions
- [ ] Mise à jour du schéma Prisma selon DATABASE_SCHEMA.md
- [ ] Configuration des variables d'environnement

### 0.2 Structure du code
- [ ] Création de l'arborescence backend (services/, middleware/)
- [ ] Création de l'arborescence frontend (pages/, components/, hooks/)
- [ ] Configuration ESLint/Prettier uniformes
- [ ] Setup des types TypeScript partagés

### Livrables
- Projet démarrable en local via `docker-compose up`
- Schéma BDD complet et migré
- Structure de code prête pour le développement

---

## Phase 1: Authentification & Base

### 1.1 Backend Auth
- [ ] Route POST /api/auth/signup
  - Validation email, username, password
  - Hash password (bcrypt)
  - Création session
- [ ] Route POST /api/auth/login
  - Vérification credentials
  - Création session
- [ ] Route POST /api/auth/logout
  - Destruction session
- [ ] Route GET /api/auth/me
  - Récupération user courant
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
- [ ] Sidebar (communautés)
- [ ] Layout responsive

### Livrables
- Utilisateurs peuvent s'inscrire, se connecter, se déconnecter
- Navigation de base fonctionnelle

---

## Phase 2: Catalogue Personnel

### 2.1 Backend Recipes (personnel)
- [ ] Route POST /api/recipes
  - Création recette personnelle
  - Gestion tags (création si inexistant)
  - Gestion ingrédients
- [ ] Route GET /api/recipes
  - Liste paginée
  - Filtre par tags
- [ ] Route GET /api/recipes/:id
  - Détail recette
  - Vérification accès (own or community member)
- [ ] Route PATCH /api/recipes/:id
  - Modification (owner only)
- [ ] Route DELETE /api/recipes/:id
  - Soft delete (owner only)

### 2.2 Frontend Catalogue
- [ ] Page liste recettes personnelles
- [ ] Page création recette
  - Form: titre, contenu (éditeur)
  - Gestion tags (multi-select + création)
  - Gestion ingrédients (liste dynamique)
  - Upload image (optionnel)
- [ ] Page détail recette
- [ ] Page édition recette
- [ ] Composant RecipeCard
- [ ] Composant TagSelector

### Livrables
- CRUD complet sur les recettes personnelles
- Interface de création/édition fonctionnelle

---

## Phase 3: Communautés

### 3.1 Backend Communities
- [ ] Route POST /api/communities
  - Création communauté
  - Ajout créateur comme ADMIN
- [ ] Route GET /api/communities
  - Liste des communautés de l'utilisateur
- [ ] Route GET /api/communities/:id
  - Détail communauté
  - Middleware memberOf
- [ ] Route PATCH /api/communities/:id
  - Modification (admin only)

### 3.2 Backend Members
- [ ] Route GET /api/communities/:id/members
- [ ] Route POST /api/communities/:id/members
  - Invitation (admin only)
- [ ] Route PATCH /api/communities/:id/members/:userId
  - Promotion (admin only, no demote)
- [ ] Route DELETE /api/communities/:id/members/:userId
  - Quitter / Retirer
  - Logique dernier admin
  - Suppression communauté si dernier membre

### 3.3 Frontend Communities
- [ ] Page liste mes communautés
- [ ] Page création communauté
- [ ] Page détail communauté
  - Onglets: Recettes, Membres, (Activité)
- [ ] Composant MembersList
- [ ] Modal invitation membre
- [ ] Bouton promotion (admin)
- [ ] Bouton quitter

### Livrables
- Gestion complète des communautés
- Système de rôles fonctionnel

---

## Phase 4: Recettes Communautaires

### 4.1 Backend
- [ ] Route POST /api/communities/:id/recipes
  - Création recette communautaire
  - Création copie personnelle automatique
  - Lien originRecipeId
  - Log ActivityLog
- [ ] Route GET /api/communities/:id/recipes
  - Liste recettes communauté
  - Pagination, filtre tags
- [ ] Modification routes recipes/:id
  - Gestion recettes communautaires

### 4.2 Frontend
- [ ] Liste recettes dans page communauté
- [ ] Création recette depuis communauté
- [ ] Distinction visuelle perso vs communauté
- [ ] Lien vers communauté sur recette

### Livrables
- Création et affichage de recettes dans les communautés
- Copie automatique dans catalogue personnel

---

## Phase 5: Propositions & Variantes

### 5.1 Backend Proposals
- [ ] Route GET /api/recipes/:id/proposals
  - Liste propositions (filtre status)
- [ ] Route POST /api/recipes/:id/proposals
  - Création proposition
  - Validation: not own recipe, member
  - Log ActivityLog
- [ ] Route GET /api/proposals/:id
  - Détail proposition
- [ ] Route POST /api/proposals/:id/accept
  - Mise à jour recette communautaire
  - Mise à jour recette personnelle liée
  - Status ACCEPTED
  - Log ActivityLog
- [ ] Route POST /api/proposals/:id/reject
  - Création variante
  - Status REJECTED
  - Log ActivityLog

### 5.2 Backend Variants
- [ ] Route GET /api/recipes/:id/variants
  - Liste variantes (where originRecipeId)

### 5.3 Frontend
- [ ] Bouton "Proposer modification" sur recette
- [ ] Page/Modal création proposition
- [ ] Liste propositions pour propriétaire
- [ ] Boutons Accept/Reject
- [ ] Dropdown variantes sur page recette

### Livrables
- Workflow complet de propositions
- Création automatique de variantes
- Visualisation des variantes

---

## Phase 6: Partage Inter-Communautés

### 6.1 Backend
- [ ] Route POST /api/recipes/:id/share
  - Validation membership deux communautés
  - Validation permission (admin ou créateur)
  - Création fork
  - Métadonnées: originRecipeId, sharedFromCommunityId
  - Log ActivityLog (deux communautés)

### 6.2 Frontend
- [ ] Bouton "Partager dans une communauté"
- [ ] Modal sélection communauté cible
- [ ] Badge "Partagé depuis X" sur recettes forkées
- [ ] Lien vers origine (si accessible)

### Livrables
- Fork de recettes entre communautés fonctionnel
- Traçabilité des origines

---

## Phase 7: Activity Feed & Finitions

### 7.1 Backend Activity
- [ ] Route GET /api/communities/:id/activity
  - Feed paginé par communauté
- [ ] Service ActivityService
  - Méthode log() centralisée
  - Types d'événements

### 7.2 Frontend Activity
- [ ] Composant ActivityFeed
- [ ] Intégration dans page communauté
- [ ] Formatage des événements

### 7.3 Finitions
- [ ] Gestion complète des erreurs frontend
- [ ] Messages de confirmation/feedback
- [ ] Loading states
- [ ] Empty states
- [ ] Tests manuels complets
- [ ] Corrections bugs

### Livrables
- Activity feed fonctionnel
- Application MVP complète et testée

---

## Phase 8: (Post-MVP) Analytics & Améliorations

### 8.1 Analytics
- [ ] Comptage vues (RecipeView, RecipeAnalytics)
- [ ] Affichage statistiques sur recettes
- [ ] Dashboard analytics

### 8.2 Améliorations UX
- [ ] Recherche globale
- [ ] Notifications en temps réel (WebSocket)
- [ ] Mode sombre
- [ ] PWA / Offline support

### 8.3 Technique
- [ ] Tests unitaires
- [ ] Tests E2E
- [ ] Documentation API (Swagger)
- [ ] Monitoring / Logging

---

## Estimation par phase

| Phase | Description | Complexité |
|-------|-------------|------------|
| 0 | Setup | Faible |
| 1 | Auth | Moyenne |
| 2 | Catalogue personnel | Moyenne |
| 3 | Communautés | Haute |
| 4 | Recettes communautaires | Moyenne |
| 5 | Propositions & Variantes | Haute |
| 6 | Partage inter-communautés | Moyenne |
| 7 | Activity Feed & Finitions | Moyenne |

---

## Dépendances entre phases

```
Phase 0 (Setup)
    │
    ▼
Phase 1 (Auth) ◄─────────────────────────┐
    │                                     │
    ▼                                     │
Phase 2 (Catalogue) ◄────────────────────┤
    │                                     │
    ▼                                     │
Phase 3 (Communautés) ◄──────────────────┤
    │                                     │
    ├───────────────┐                     │
    ▼               ▼                     │
Phase 4         Phase 6                   │
(Recettes       (Partage)                 │
communautaires)    │                      │
    │              │                      │
    ▼              │                      │
Phase 5 ◄──────────┘                      │
(Propositions)                            │
    │                                     │
    ▼                                     │
Phase 7 (Feed & Finitions) ◄──────────────┘
```

---

## Checklist de validation MVP

### Fonctionnel
- [ ] Un utilisateur peut s'inscrire et se connecter
- [ ] Un utilisateur peut créer des recettes personnelles
- [ ] Un utilisateur peut créer une communauté
- [ ] Un admin peut inviter des membres
- [ ] Un admin peut promouvoir un membre
- [ ] Un membre peut créer une recette dans une communauté
- [ ] Une copie est créée dans son catalogue personnel
- [ ] Un membre peut proposer une modification
- [ ] Le créateur peut accepter (mise à jour) ou refuser (variante)
- [ ] Les variantes sont visibles dans un dropdown
- [ ] Un utilisateur peut forker une recette vers une autre communauté
- [ ] L'activity feed montre les événements récents

### Technique
- [ ] Application stable sans erreurs bloquantes
- [ ] Données persistées correctement
- [ ] Sessions fonctionnelles
- [ ] Responsive design
- [ ] Performance acceptable (<3s chargement page)

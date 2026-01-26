# Forest Manager - Documentation Technique

## Vue d'ensemble du projet

Forest Manager est une application de gestion de communautés autour du partage de recettes de cuisine. Elle permet aux utilisateurs de créer et rejoindre des communautés privées, de partager des recettes, de proposer des améliorations collaboratives et de gérer des variantes de recettes.

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express + TypeScript |
| Base de données | PostgreSQL |
| ORM | Prisma |
| Authentification | Sessions (express-session) |
| Containerisation | Docker + Docker Compose |
| CI/CD | GitHub Actions + Portainer |

## Documents disponibles

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architecture technique et patterns utilisés |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Schéma complet de la base de données |
| [BUSINESS_RULES.md](./BUSINESS_RULES.md) | Règles métier et logique applicative |
| [API_SPECIFICATION.md](./API_SPECIFICATION.md) | Spécification des endpoints API |
| [USER_STORIES.md](./USER_STORIES.md) | User stories pour le développement |
| [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) | Phases de développement et planning |

## Fonctionnalités principales (MVP)

### Gestion des utilisateurs
- Inscription et authentification
- Profil utilisateur avec catalogue personnel de recettes
- Gestion multi-communautés

### Gestion des communautés
- Création de communautés privées (invite-only)
- Système de rôles : Membre / Administrateur
- Invitation de nouveaux membres (admin uniquement)
- Promotion de membres en administrateurs
- Logique de suppression automatique (dernier utilisateur)

### Gestion des recettes
- Création de recettes personnelles
- Partage dans les communautés (forked copy)
- Système de tags multi-valués
- Support d'images (optionnel, V1)
- Soft delete

### Système collaboratif
- Propositions de mises à jour sur les recettes
- Workflow d'approbation par le créateur
- Création automatique de variantes (si refus)
- Visualisation des variantes (dropdown)

### Partage inter-communautés
- Fork de recettes entre communautés
- Traçabilité de l'origine
- Indépendance des copies forkées

### Activité et notifications
- Activity feed par communauté
- Notifications légères (non bloquantes)

## Démarrage rapide

```bash
# Cloner et démarrer
npm run docker:up:build

# URLs
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# Prisma:   http://localhost:5555
```

## Structure du projet

```
ForestManager/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Logique métier
│   │   ├── middleware/     # Auth, validation
│   │   ├── routes/         # Définition des routes
│   │   └── util/           # Utilitaires
│   └── prisma/
│       ├── schema.prisma   # Schéma BDD
│       └── seed.js         # Données initiales
├── frontend/
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── pages/          # Pages
│   │   ├── network/        # Client API
│   │   └── models/         # Types TypeScript
├── docs/                   # Documentation technique
└── docker-compose.yml      # Configuration Docker
```

# Forest Manager - Documentation Technique

## Vue d'ensemble du projet

Forest Manager est une application de gestion de communautes autour du partage de recettes de cuisine. Elle permet aux utilisateurs de creer et rejoindre des communautes privees, de partager des recettes, de proposer des ameliorations collaboratives et de gerer des variantes de recettes.

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express + TypeScript |
| Base de donnees | PostgreSQL |
| ORM | Prisma |
| Authentification | Sessions (express-session) |
| Containerisation | Docker + Docker Compose |
| CI/CD | GitHub Actions + Portainer |

## Documents disponibles

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architecture technique et patterns utilises |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Schema complet de la base de donnees |
| [BUSINESS_RULES.md](./BUSINESS_RULES.md) | Regles metier et logique applicative |
| [API_SPECIFICATION.md](./API_SPECIFICATION.md) | Specification des endpoints API |
| [USER_STORIES.md](./USER_STORIES.md) | User stories pour le developpement |
| [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) | Phases de developpement et planning |

## Fonctionnalites principales (MVP)

### Gestion des utilisateurs
- Inscription et authentification
- Profil utilisateur avec catalogue personnel de recettes
- Gestion multi-communautes

### Gestion des communautes
- Creation de communautes privees (invite-only)
- Systeme de roles : Membre / Administrateur
- Invitation de nouveaux membres (admin uniquement)
- Promotion de membres en administrateurs
- Logique de suppression automatique (dernier utilisateur)

### Gestion des recettes
- Creation de recettes personnelles
- Partage dans les communautes (forked copy)
- Systeme de tags multi-values
- Support d'images (optionnel, V1)
- Soft delete

### Systeme collaboratif
- Propositions de mises a jour sur les recettes
- Workflow d'approbation par le createur
- Creation automatique de variantes (si refus)
- Visualisation des variantes (dropdown)

### Partage inter-communautes
- Fork de recettes entre communautes
- Tracabilite de l'origine
- Independance des copies forkees

### Activite et notifications
- Activity feed par communaute
- Notifications legeres (non bloquantes)

## Demarrage rapide

```bash
# Cloner et demarrer
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
│   │   ├── controllers/    # Logique metier
│   │   ├── middleware/     # Auth, validation
│   │   ├── routes/         # Definition des routes
│   │   └── util/           # Utilitaires
│   └── prisma/
│       ├── schema.prisma   # Schema BDD
│       └── seed.js         # Donnees initiales
├── frontend/
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── pages/          # Pages
│   │   ├── network/        # Client API
│   │   └── models/         # Types TypeScript
├── docs/                   # Documentation technique
└── docker-compose.yml      # Configuration Docker
```

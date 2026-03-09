# Forest Manager - Backend

API REST pour l'application Forest Manager.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express%20js-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

## Stack

- **Node.js** + **Express** - Serveur HTTP
- **TypeScript** - Typage statique
- **Prisma** - ORM avec migrations
- **PostgreSQL** - Base de donnees
- **Socket.IO** - WebSocket pour notifications temps reel
- **MinIO** - Stockage S3-compatible pour images
- **Vitest** + **Supertest** - Tests

## Structure

```
src/
  controllers/        # Handlers des endpoints
  routes/             # Definitions des routes
  middleware/         # Auth, roles, securite
  services/           # Logique metier
  admin/              # Module admin isole (controllers, routes, middleware)
  config/             # Configuration (storage, etc.)
  util/               # Utilitaires (validation, pagination, formatters)
  jobs/               # Cron jobs (cleanup notifications, images orphelines)
  types/              # Extensions TypeScript
prisma/
  schema.prisma       # Schema de la base de donnees
  seed.js             # Donnees initiales
  migrations/         # Migrations SQL
```

## API Endpoints

| Module | Endpoints | Description |
| ------ | --------- | ----------- |
| Auth | `/api/auth/*` | Inscription, connexion, sessions |
| Recipes | `/api/recipes/*` | CRUD recettes, images, propositions |
| Communities | `/api/communities/*` | CRUD communautes, membres, invitations |
| Tags | `/api/tags/*` | Autocomplete tags scope-aware |
| Ingredients | `/api/ingredients/*` | Autocomplete + unite suggeree |
| Notifications | `/api/notifications/*` | CRUD, preferences, batch |
| Admin | `/api/admin/*` | Dashboard, gestion (2FA requis) |

Voir `.claude/context/API_MAP.md` pour la liste complete des 99 endpoints.

## Developpement

```bash
# Depuis la racine du projet
npm run docker:up:build   # Demarrer tous les services
npm run docker:logs       # Voir les logs

# Depuis ce dossier (requiert DB locale)
npm run dev               # Mode developpement
npm test                  # Tests
```

## Tests

746 tests (integration + unit) couvrant :
- Authentification et sessions
- CRUD recettes/communautes
- Propositions et variantes
- Partage inter-communautes
- Notifications et WebSocket
- API Admin (2FA, tags, ingredients, unites)
- Upload images (presigned URLs, validation)

```bash
npm test                  # Tous les tests
npm run test:watch        # Mode watch
npm run test:coverage     # Couverture
```

## Securite

- Sessions isolees (user/admin)
- Rate limiting (auth, admin)
- Helmet + CORS
- Validation stricte des inputs
- 2FA TOTP obligatoire pour admin

## Auteur

Cree par [MatthiasBlc](https://github.com/MatthiasBlc)

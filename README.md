# Forest Manager

Application de gestion de communautes pour le partage de recettes. Communautes privees (invite-only), recettes collaboratives avec propositions et variantes, administration plateforme via SuperAdmin.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express%20js-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)

## Fonctionnalites

- **Authentification** : inscription, connexion, sessions securisees, profil utilisateur
- **Recettes personnelles** : CRUD complet avec tags et ingredients (autocomplete)
- **Communautes privees** : creation, invitation par utilisateur, roles (Member / Moderator)
- **Recettes communautaires** : publication, edition collaborative, permissions par role
- **Propositions & variantes** : suggestion de modifications, historique des variantes
- **Partage inter-communautes** : fork de recettes entre communautes, tracabilite
- **Feed d'activite** : activite communautaire et personnelle
- **Notifications** : invitations en attente, badge temps reel
- **SuperAdmin** : dashboard admin isole, authentification 2FA (TOTP), gestion tags/ingredients/communautes/features

## Stack technique

| Couche          | Technologies                                                          |
| --------------- | --------------------------------------------------------------------- |
| Frontend        | React 18, TypeScript, Vite, TailwindCSS, daisyUI, React Router, Axios |
| Backend         | Node.js, Express, TypeScript, Prisma ORM                              |
| Base de donnees | PostgreSQL 15                                                         |
| Tests           | Vitest, Supertest, Testing Library, MSW                               |
| Infrastructure  | Docker, GitHub Actions, Portainer, Traefik                            |

## Demarrage rapide

### Prerequis

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

### Installation

```bash
# 1. Cloner le repository
git clone https://github.com/MatthiasBlc/ForestManager.git
cd ForestManager

# 2. Configurer l'environnement
cp .env.example .env
# Editer .env avec vos valeurs (mots de passe, secrets de session)

# 3. Demarrer les services
npm run docker:up:build
```

### URLs de developpement

| Service       | URL                                                 |
| ------------- | --------------------------------------------------- |
| Frontend      | http://localhost:3000                               |
| Backend API   | http://localhost:3001                               |
| Prisma Studio | http://localhost:5555 (via `npm run prisma:studio`) |

### Comptes de test

La base est automatiquement seedee au premier demarrage :

| Utilisateur | Mot de passe |
| ----------- | ------------ |
| pizza_lover | password123  |
| pie_fan     | password123  |

## Scripts

### Docker

```bash
npm run docker:up              # Demarrer les conteneurs
npm run docker:up:d            # Demarrer en arriere-plan
npm run docker:up:build        # Rebuild + demarrer + nettoyage images
npm run docker:down            # Arreter les conteneurs
npm run docker:clean           # Arreter + supprimer les volumes
npm run docker:logs            # Logs de tous les services
npm run docker:logs:backend    # Logs backend uniquement
npm run docker:logs:frontend   # Logs frontend uniquement
npm run docker:restart         # Redemarrer les conteneurs
```

### Prisma

```bash
npm run prisma:studio          # Ouvrir Prisma Studio (GUI base de donnees)
npm run prisma:migrate         # Executer les migrations
npm run prisma:generate        # Regenerer le client Prisma
```

### Tests

```bash
npm test                       # Tous les tests (backend + frontend)
npm run test:backend           # Tests backend uniquement
npm run test:frontend          # Tests frontend uniquement
npm run test:watch:backend     # Mode watch backend
npm run test:watch:frontend    # Mode watch frontend
npm run test:coverage          # Tests avec rapport de couverture
```

> Les tests s'executent dans les conteneurs Docker. Les conteneurs doivent etre demarres (`npm run docker:up:d`).

## Tests

### Stack de tests

| Outil               | Role                                              |
| ------------------- | ------------------------------------------------- |
| **Vitest**          | Framework de tests (backend + frontend)           |
| **Supertest**       | Tests d'integration API (backend)                 |
| **Testing Library** | Tests de composants React (frontend)              |
| **MSW**             | Mock Service Worker pour simuler l'API (frontend) |

### Structure

```
backend/src/__tests__/
  setup/
    globalSetup.ts          # Connexion DB + cleanup entre tests
    testHelpers.ts          # Factories (createTestUser, createTestAdmin, etc.)
  integration/
    auth.test.ts            # Auth utilisateur (signup, login, logout)
    recipes.test.ts         # CRUD recettes personnelles
    communities.test.ts     # CRUD communautes
    communityRecipes.test.ts # Recettes communautaires
    invitations.test.ts     # Invitations
    members.test.ts         # Gestion membres
    proposals.test.ts       # Propositions de modifications
    share.test.ts           # Partage inter-communautes
    variants.test.ts        # Variantes de recettes
    activity.test.ts        # Feed d'activite
    tags.test.ts            # Autocomplete tags
    ingredients.test.ts     # Autocomplete ingredients
    admin*.test.ts          # APIs admin (auth 2FA, tags, ingredients, features, communities, dashboard, activity)

frontend/src/__tests__/
  setup/
    vitestSetup.ts          # Config globale + MSW
    mswHandlers.ts          # Mocks des endpoints API
    testUtils.tsx           # Helpers de rendu avec providers
  unit/
    *.test.tsx              # Tests composants, pages, contexts
```

### CI/CD

Les tests sont executes automatiquement a chaque push sur `master` ou `preprod` :

```
push master/preprod
       |
       v
+-------------+     +---------------+
| test-backend| --> | test-frontend |
+-------------+     +---------------+
       |                   |
       v                   v
       +-------------------+
                |
                v (si tous les tests passent)
         +------------+
         |   build    |
         +------------+
                |
                v
         +------------+
         |   deploy   |
         +------------+
```

## Structure du projet

```
ForestManager/
  backend/
    src/
      controllers/          # Logique metier (auth, recipes, communities, proposals, share...)
      routes/               # Endpoints API REST
      middleware/            # Auth, roles communaute, securite (helmet, CORS, rate limiting)
      services/             # Services metier (gestion recettes orphelines)
      admin/                # Module admin isole (controllers, routes, middleware)
      types/                # Extensions TypeScript (Express, sessions)
    prisma/
      schema.prisma         # Schema base de donnees
      seed.js               # Donnees initiales
  frontend/
    src/
      pages/                # Pages React (Dashboard, Recipes, Communities, Profile...)
      components/           # Composants reutilisables (Layout, Navbar, modals, cards...)
      contexts/             # Contexts React (AuthContext, AdminAuthContext)
      network/              # Client API (Axios)
      models/               # Types TypeScript
      hooks/                # Custom hooks
  docker-compose.yml        # Configuration dev
  docker-compose.prod.yml   # Configuration production
  docker-compose.preprod.yml # Configuration pre-production
  .github/workflows/        # Pipeline CI/CD
```

## Variables d'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs :

| Variable               | Description                                | Defaut dev              |
| ---------------------- | ------------------------------------------ | ----------------------- |
| `COMPOSE_PROJECT_NAME` | Nom du projet Docker Compose               | `forestmanager`         |
| `POSTGRES_USER`        | Utilisateur PostgreSQL                     | `forestmanager`         |
| `POSTGRES_PASSWORD`    | Mot de passe PostgreSQL                    | -                       |
| `POSTGRES_DB`          | Nom de la base de donnees                  | `forestmanager_db`      |
| `PORT`                 | Port du backend                            | `3001`                  |
| `SESSION_SECRET`       | Secret sessions utilisateur (min 32 chars) | -                       |
| `ADMIN_SESSION_SECRET` | Secret sessions admin (min 32 chars)       | -                       |
| `CORS_ORIGIN`          | Origine CORS autorisee                     | `http://localhost:3000` |
| `VITE_BACKEND_URL`     | URL du backend (frontend)                  | `http://localhost:3001` |

## Deploiement

### Architecture production

L'application est deployee via Docker avec Traefik comme reverse proxy et Portainer pour l'orchestration :

- **Traefik** : reverse proxy avec terminaison SSL automatique (Let's Encrypt)
- **Portainer** : gestion des stacks Docker, deploiement via API
- **GitHub Actions** : pipeline CI/CD (tests -> build -> push registry -> deploy)
- **Docker Registry** : registry prive pour les images

### GitHub Secrets requis

| Secret                 | Description                        |
| ---------------------- | ---------------------------------- |
| `REGISTRY_URL`         | URL du registry Docker             |
| `REGISTRY_USERNAME`    | Utilisateur du registry            |
| `REGISTRY_PASSWORD`    | Mot de passe du registry           |
| `IMAGE_NAME`           | Prefixe des images Docker          |
| `PORTAINER_URL`        | URL de Portainer                   |
| `PORTAINER_API`        | Cle API Portainer                  |
| `STACK_ID`             | ID de la stack Portainer           |
| `ENDPOINT_ID`          | ID de l'endpoint Portainer         |
| `POSTGRES_USER`        | Utilisateur PostgreSQL (prod)      |
| `POSTGRES_PASSWORD`    | Mot de passe PostgreSQL (prod)     |
| `POSTGRES_DB`          | Nom de la base (prod)              |
| `SESSION_SECRET`       | Secret sessions utilisateur (prod) |
| `ADMIN_SESSION_SECRET` | Secret sessions admin (prod)       |
| `CORS_ORIGIN`          | Origine CORS autorisee (prod)      |
| `API_URL`              | URL publique de l'API              |

### Pipeline CI/CD

A chaque push sur `master` :

1. **Tests** : backend (PostgreSQL service container) + frontend (mocks MSW)
2. **Build** : images Docker backend + frontend
3. **Push** : envoi des images vers le registry prive
4. **Deploy** : mise a jour de la stack via l'API Portainer
5. **Cleanup** : suppression des anciennes images du registry

### Nettoyage du registry

Ajouter ce cron job sur le serveur pour recuperer l'espace disque :

```bash
# Execution quotidienne a 3h
0 3 * * * docker exec registry bin/registry garbage-collect /etc/docker/registry/config.yml --delete-untagged
```

### Creation d'un SuperAdmin

```bash
# Dans le conteneur backend
docker compose exec backend npx ts-node src/scripts/createAdmin.ts
```

Le script demande un username et un mot de passe, puis genere un QR code TOTP a scanner avec une application d'authentification (Google Authenticator, Authy, etc.).

## Documentation

| Document                                       | Description                        |
| ---------------------------------------------- | ---------------------------------- |
| [Architecture](docs/ARCHITECTURE.md)           | Architecture technique et patterns |
| [Specification API](docs/API_SPECIFICATION.md) | Contrat REST complet               |
| [Regles metier](docs/BUSINESS_RULES.md)        | Regles metier detaillees           |
| [User Stories](docs/USER_STORIES.md)           | Fonctionnalites utilisateur        |
| [Roadmap](docs/DEVELOPMENT_ROADMAP.md)         | Plan de developpement              |

## Auteur

Cree par [MatthiasBlc](https://github.com/MatthiasBlc)

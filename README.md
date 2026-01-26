# ForestManager Boilerplate

Full-stack boilerplate with React + Express + PostgreSQL + Docker, ready for CI/CD deployment.

## Technologies

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

## Quick Start

### Prerequisites

- Docker & Docker Compose

### Development

```bash
# Start all services
npm run docker:up

# Or rebuild and start (cleans old images automatically)
npm run docker:up:build
```

**URLs:**
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Prisma Studio | http://localhost:5555 (via `npm run prisma:studio`) |

### Test Accounts

| Username | Password |
|----------|----------|
| pizza_lover | password123 |
| pie_fan | password123 |

## Scripts

```bash
npm run docker:up          # Start containers
npm run docker:up:d        # Start in background
npm run docker:up:build    # Rebuild + start + cleanup old images
npm run docker:down        # Stop containers
npm run docker:clean       # Stop and remove volumes
npm run docker:logs        # View all logs
npm run prisma:studio      # Open Prisma Studio
npm run prisma:migrate     # Run migrations
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware (auth)
│   │   ├── routes/         # API routes
│   │   └── util/           # Utilities (db, env validation)
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.js         # Seed data (auto-skips if DB not empty)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── network/        # API client (axios)
│   │   └── models/         # TypeScript types
│   └── Dockerfile
├── docker-compose.yml      # Development config
├── docker-compose.prod.yml # Production config
└── .github/workflows/      # CI/CD pipeline
```

## Deployment

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `REGISTRY_URL` | Docker registry URL |
| `REGISTRY_USERNAME` | Registry username |
| `REGISTRY_PASSWORD` | Registry password |
| `IMAGE_NAME` | Image name prefix |
| `PORTAINER_URL` | Portainer URL |
| `PORTAINER_API` | Portainer API key |
| `STACK_ID` | Portainer stack ID |
| `ENDPOINT_ID` | Portainer endpoint ID |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `SESSION_SECRET` | Express session secret (min 32 chars) |
| `CORS_ORIGIN` | Allowed CORS origin |
| `API_URL` | Public API URL |

### CI/CD Pipeline

On push to `master`:
1. Build Docker images (backend + frontend)
2. Push to registry
3. Deploy via Portainer
4. Cleanup old images from registry

### Registry Garbage Collection

Add this cron job on your server to reclaim disk space:

```bash
# Runs daily at 3am
0 3 * * * docker exec registry bin/registry garbage-collect /etc/docker/registry/config.yml --delete-untagged
```

## Creating a New Project

1. Clone this repository
2. Find and replace `forestmanager` / `ForestManager` with your project name in:
   - `package.json` (root, backend, frontend)
   - `docker-compose.yml` / `docker-compose.prod.yml`
   - `.env.example`
3. Update `backend/prisma/schema.prisma` with your data models
4. Update `backend/prisma/seed.js` with your seed data
5. Configure GitHub Secrets for deployment

## Features

- User authentication (signup, login, logout, sessions)
- Session persistence with PostgreSQL
- Protected API routes
- Responsive UI with TailwindCSS + daisyUI
- Hot reload in development
- Automatic database migrations
- Auto-seeding on first deployment

## Author

Created by [MatthiasBlc](https://github.com/MatthiasBlc)

# syntax=docker/dockerfile:1
# Image de l'API. Contexte de build : racine du depot.
#   dev   : dependances de tout le monorepo, sources montees par compose (dev et tests)
#   prod  : dependances de production de l'API seule, utilisateur non root
# Pas d'etape de compilation : Node 22.18+ efface les types TypeScript nativement.

ARG NODE_IMAGE=node:22-alpine

# ---------- base : npm 11 (npm 10 plante sur les peers de vitest) ----------
FROM ${NODE_IMAGE} AS base
RUN npm install -g npm@11.21.1 && npm cache clean --force
WORKDIR /app
# Pas de hooks git dans une image.
ENV HUSKY=0

# ---------- manifests : seulement ce qui invalide l'installation ----------
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/test-utils/package.json packages/test-utils/

# ---------- dev : toutes les dependances (lint, tests, outils) ----------
FROM manifests AS dev
ENV NODE_ENV=development
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace=@fm/api"]

# ---------- prod-deps : dependances de production de l'API ----------
FROM manifests AS prod-deps
# Le script racine `prepare` (husky) n'existe pas sans les devDependencies ;
# on le retire plutot que --ignore-scripts, utile aux dependances natives (argon2).
RUN npm pkg delete scripts.prepare
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace=@fm/api

# ---------- prod ----------
FROM ${NODE_IMAGE} AS prod
# tini : PID 1 qui relaie les signaux (arret propre) et ramasse les zombies.
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3001/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/src/server.ts"]

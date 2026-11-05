# syntax=docker/dockerfile:1
# Image du front. Contexte de build : racine du depot.
#   dev   : serveur Vite, sources montees par compose
#   build : bundle statique
#   prod  : nginx (SPA + proxy /api vers le service api)

ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.30-alpine

# ---------- base : npm 11 (npm 10 plante sur les peers de vitest) ----------
FROM ${NODE_IMAGE} AS base
RUN npm install -g npm@11.21.1 && npm cache clean --force
WORKDIR /app
ENV HUSKY=0

# ---------- manifests : identique a api.Dockerfile (couches partagees en cache) ----------
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/test-utils/package.json packages/test-utils/

# ---------- dev ----------
FROM manifests AS dev
ENV NODE_ENV=development
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@fm/web"]

# ---------- build ----------
FROM dev AS build
ENV NODE_ENV=production
RUN npm run build --workspace=@fm/web

# ---------- prod ----------
FROM ${NGINX_IMAGE} AS prod
COPY docker/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/web.security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1

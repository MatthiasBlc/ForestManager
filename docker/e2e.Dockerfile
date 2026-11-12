# syntax=docker/dockerfile:1
# Image des parcours E2E [D197] : Playwright officiel (navigateurs fournis) et
# les dependances du workspace `e2e` seulement. La version de l'image suit celle
# de @playwright/test dans e2e/package.json. Contexte de build : racine du depot.

FROM mcr.microsoft.com/playwright:v1.64.1-noble
RUN npm install -g npm@11.21.1 && npm cache clean --force
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/test-utils/package.json packages/test-utils/
COPY e2e/package.json e2e/
# Le script racine `prepare` (husky) n'existe pas sans les devDependencies de la racine.
RUN npm pkg delete scripts.prepare
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=@fm/e2e
COPY tsconfig.base.json ./
COPY e2e e2e
WORKDIR /app/e2e
ENTRYPOINT ["npx", "playwright", "test"]

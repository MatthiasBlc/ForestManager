# Test Infrastructure - docker-compose.test.yml

## Statut: IMPLEMENTE

---

## Contexte

L'application et sa database PostgreSQL tournent exclusivement dans des containers:

- `docker-compose.yml` - Developpement local
- `docker-compose.preprod.yml` - Deploiement preprod
- `docker-compose.prod.yml` - Deploiement prod
- `docker-compose.test.yml` - **Tests d'integration (local)**

**Objectif**: Les donnees de test doivent etre isolees. Les databases preprod/prod ne doivent jamais etre corrompues.

---

## Decision: docker-compose.test.yml

Testcontainers a ete ecarte (incompatible Node 18, complexite Docker-in-Docker en CI).

L'approche retenue utilise un `docker-compose.test.yml` dedie:

1. **Coherence** - Meme philosophie Docker que dev/preprod/prod
2. **Simplicite** - Aucune dependance supplementaire
3. **Performance** - tmpfs = DB en memoire, pas d'I/O disque
4. **Compatibilite** - Fonctionne avec Node 18 actuel
5. **CI-friendly** - La CI utilise les GitHub Actions `services` (deploy.yml)

---

## Architecture

| Contexte | Methode DB | Port | Donnees |
|----------|-----------|------|---------|
| Dev local | `docker-compose.yml` | 5432 | Volume persistant |
| Tests local | `docker-compose.test.yml` | 5433 | tmpfs (RAM, ephemere) |
| CI (GitHub Actions) | `services` dans `deploy.yml` | 5432 | Ephemere (runner) |
| Preprod | `docker-compose.preprod.yml` | 5432 | Volume persistant |
| Prod | `docker-compose.prod.yml` | 5432 | Volume persistant |

```
docker-compose.test.yml     # DB PostgreSQL dediee tests (port 5433, tmpfs)

vitest.config.ts
  └── setupFiles: globalSetup.ts

globalSetup.ts:
  1. Connexion via DATABASE_URL
  2. afterEach: nettoie toutes les tables (ordre FK)
  3. afterAll: deconnexion

Scripts npm:
  - test:db:up       -> demarre la DB test
  - test:db:down     -> arrete la DB test
  - test:db:reset    -> redemarrage complet
  - test:integration -> cycle complet (up + migrate + test + down)
```

---

## Commandes

```bash
# Cycle complet (recommande)
cd backend && npm run test:integration

# Ou manuellement:
npm run test:db:up
DATABASE_URL="postgresql://test:test@localhost:5433/forestmanager_test?schema=public" npx prisma migrate deploy
DATABASE_URL="postgresql://test:test@localhost:5433/forestmanager_test?schema=public" npm test
npm run test:db:down
```

---

## Fichiers modifies

| Fichier | Action |
|---------|--------|
| `docker-compose.test.yml` | Cree - DB test PostgreSQL 15, port 5433, tmpfs |
| `backend/package.json` | Scripts ajoutes, testcontainers supprime |
| `backend/vitest.config.ts` | Commentaire mis a jour (singleFork conserve) |

### Note sur singleFork

`singleFork: true` est conserve car les tests partagent une seule DB.
Le `afterEach` fait `deleteMany()` sur toutes les tables - des workers paralleles
se pollueraient mutuellement. La parallelisation necessiterait un schema ou
une DB par worker, ce qui est hors scope.

---

## Fichiers de reference

- `backend/src/__tests__/setup/globalSetup.ts` - Connexion DB + cleanup entre tests
- `backend/src/__tests__/setup/testHelpers.ts` - Factories et helpers de test
- `backend/vitest.config.ts` - Configuration Vitest
- `.github/workflows/deploy.yml` - CI avec test job (GitHub Actions services)

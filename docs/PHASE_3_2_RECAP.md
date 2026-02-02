# Phase 3.2 - Backend Invitations - RECAP

## Statut: COMPLETE (code) + TESTCONTAINERS EN COURS

---

## Ce qui a ete implemente

### Fichiers crees

1. **`backend/src/controllers/invites.ts`**
   - `createInvite` - POST /api/communities/:communityId/invites (MODERATOR)
   - `getInvites` - GET /api/communities/:communityId/invites (MODERATOR)
   - `cancelInvite` - DELETE /api/communities/:communityId/invites/:inviteId (MODERATOR)
   - `getMyInvites` - GET /api/users/me/invites (User)
   - `acceptInvite` - POST /api/invites/:inviteId/accept (Invitee)
   - `rejectInvite` - POST /api/invites/:inviteId/reject (Invitee)

2. **`backend/src/routes/invites.ts`**
   - Routes pour accept/reject

3. **`backend/src/routes/users.ts`**
   - Route GET /me/invites

4. **`backend/src/__tests__/integration/invitations.test.ts`**
   - 35 tests d'integration couvrant tous les cas

5. **`backend/src/__tests__/setup/testcontainer.ts`** (NOUVEAU - incomplet)
   - Setup Testcontainers pour PostgreSQL ephemere

### Fichiers modifies

- `backend/src/routes/communities.ts` - Ajout des routes invites
- `backend/src/app.ts` - Enregistrement des nouvelles routes
- `backend/src/__tests__/setup/testHelpers.ts` - Ajout `createTestInvite`
- `backend/src/__tests__/setup/globalSetup.ts` - Ajout cleanup ActivityLog + lecture env container
- `backend/vitest.config.ts` - Configuration globalSetup pour Testcontainers
- `backend/.gitignore` - Ajout `.test-env.json`

---

## Tests - Statut

### Tests dans Docker (OK)
Les 35 tests passent quand executes dans le container Docker:
```bash
docker compose exec -T backend sh -c "npx vitest run invitations.test.ts"
```

### Tests avec Testcontainers (BLOQUE)
Probleme: `@testcontainers/postgresql` derniere version necessite Node.js >= 20.
Le projet utilise Node.js 18.

---

## Probleme Testcontainers - Pistes

### Option 1: Downgrade testcontainers (RECOMMANDE)
```bash
npm uninstall @testcontainers/postgresql testcontainers
npm install --save-dev @testcontainers/postgresql@10.2.1 testcontainers@10.2.1
```
La version 10.2.1 est compatible avec Node.js 18.

### Option 2: Upgrade Node.js vers 20+
Modifier:
- `backend/Dockerfile`
- `.github/workflows/*.yml`
- `docker-compose.yml`

### Option 3: Approche alternative sans testcontainers
Utiliser un `docker-compose.test.yml` avec une DB PostgreSQL dediee aux tests:
```yaml
services:
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_DB: forestmanager_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"  # Port different de prod
    tmpfs:
      - /var/lib/postgresql/data  # DB en memoire = rapide + ephemere
```

---

## Prochaines etapes

### 1. Finaliser Testcontainers
```bash
cd backend
npm uninstall @testcontainers/postgresql testcontainers
npm install --save-dev @testcontainers/postgresql@10.2.1 testcontainers@10.2.1
npm test -- invitations.test.ts
```

### 2. Verifier tous les tests
```bash
npm test
```

### 3. TypeScript - Erreur pre-existante
Il y a une erreur TS pre-existante dans `communities.ts` (ligne 22) concernant le typage de `updateCommunity`. Ce n'est PAS lie a Phase 3.2.

### 4. Commit des changements
```bash
git add .
git status
git commit -m "feat(invitations): implement Phase 3.2 - invitation system with tests"
```

---

## Codes d'erreur implementes

| Code | HTTP | Message |
|------|------|---------|
| `INVITE_001` | 404 | Invite not found |
| `INVITE_002` | 400 | Invite already processed |
| `INVITE_003` | 404 | User not found |
| `COMMUNITY_004` | 409 | User already member |
| `COMMUNITY_005` | 409 | Invitation already pending |

---

## Architecture Testcontainers

```
vitest.config.ts
  └── globalSetup: testcontainer.ts    # Demarre PostgreSQL container
  └── setupFiles: globalSetup.ts       # Connexion Prisma + cleanup

testcontainer.ts:
  1. Demarre PostgreSqlContainer
  2. Ecrit DATABASE_URL dans .test-env.json
  3. Execute prisma migrate deploy
  4. Execute prisma generate

globalSetup.ts:
  1. Lit .test-env.json
  2. Configure process.env
  3. Cree PrismaClient
  4. afterEach: nettoie toutes les tables
```

---

## Packages installes (a verifier/corriger)

```json
{
  "devDependencies": {
    "@testcontainers/postgresql": "^10.2.1",  // A DOWNGRADER
    "testcontainers": "^10.2.1"               // A DOWNGRADER
  }
}
```

---

## Fichiers importants a relire

- `/backend/src/__tests__/setup/testcontainer.ts` - Setup container
- `/backend/src/__tests__/setup/globalSetup.ts` - Cleanup entre tests
- `/backend/vitest.config.ts` - Configuration vitest
- `/backend/src/controllers/invites.ts` - Logique metier invitations

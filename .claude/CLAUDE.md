# Forest Manager

Plateforme d'espaces prives (famille, amis, colocs) organisee en modules. Module principal : recettes partagees. Modules suivants : planning de repas, liste de courses.

## Etat actuel

**Chantier en cours : Rework V2 (phase d'etude, AUCUN code avant validation).**
Point de reprise : `.claude/docs/Rework-V2/README.md`, puis la premiere case non cochee de `4-Roadmap.md`.

La V1 (code actuel) est figee : on ne la modifie que pour un correctif valide explicitement.

## Stack

React 18 + TS + Vite + Tailwind 3 + daisyUI | Node 22 + Express + TS + Zod | PostgreSQL 15 + Prisma 6 | Socket.IO | MinIO (S3) | Docker + GitHub Actions + Portainer

## Commandes

Tout tourne sous Docker. Ne jamais lancer les tests hors Docker (env vars absentes).

```bash
npm run docker:up:build        # demarrer en dev (front :3000, API :3001, MinIO :9001)
npm run docker:logs            # logs
npm test                       # backend + frontend
npm run test:backend           # = docker compose exec backend npm test
npm run test:frontend          # = docker compose exec frontend npm test
docker compose exec backend npx prisma migrate dev   # migrations
npm run prisma:studio          # GUI DB :5555
```

## Conventions

- **Langue** : code 100% anglais. Commentaires et docs en francais.
- **Accents** : aucun dans le code et les docs (ASCII only).
- **IDs** : UUID v4. UUID "not found" en test : `00000000-0000-4000-8000-000000000000`.
- **Soft delete** (`deletedAt`) sur les entites principales ; hard delete en cascade sur les pivots.
- **Codes erreur** : constantes centralisees dans `backend/src/constants/errorCodes.ts`, jamais de string literal.
- **Seed** : idempotent (upsert only, jamais de truncate). Preprod et prod sont persistantes et le seed tourne a chaque deploy.
- **Admin** : `AdminUser` isole des users, session dediee 30 min, 2FA TOTP obligatoire.

## Git

- `master` = prod (deploy auto au push). `Developement` = branche de travail. Preprod = deploy sur PR vers `master`.
- Commit uniquement sur demande. **Jamais de Co-Authored-By pour Claude.**

## Documentation

Tout est dans `.claude/docs/` (index : `.claude/docs/README.md`). Regles :

- **Un chantier = un dossier** `.claude/docs/<Chantier>/` avec des fichiers numerotes : `README.md` (etat + ordre de lecture), `1-CDC`, `3-Journal-des-Decisions`, `4-Roadmap`, et les artefacts HTML.
- **Le CDC porte la conclusion, le journal porte le debat.** Une decision = un numero `D##` dans le journal, reprise en une ligne dans le CDC.
- **Roadmap** : cases `- [ ]` ; la premiere non cochee est le point de reprise. Cocher au fil de l'eau.
- **Artefacts** : toujours ecrire la copie locale dans le dossier du chantier AVANT de publier (lisible hors ligne), puis publier depuis ce fichier.
- **Un compteur ou un statut a un seul endroit** ; ailleurs on renvoie, on ne recopie pas.
- **Chantier termine** -> son dossier part dans `.claude/docs/V1/` (ou `done/`) et n'est plus lu par defaut.
- Ne pas recopier ce que le code dit deja (arborescence, liste d'endpoints, schema) : lire le code (`backend/prisma/schema.prisma`, `backend/src/routes/`).
- Session interrompue : ecrire l'etat dans le `README.md` du chantier (section "Reprise").

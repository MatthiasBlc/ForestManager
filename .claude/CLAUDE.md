# Forest Manager

Plateforme d'espaces prives (famille, amis, colocs) organisee en modules. Module principal : recettes partagees. Modules suivants : planning de repas, liste de courses.

## Etat actuel

**Chantier en cours : Rework V2. CDC 1.0 valide le 2026-11-05 : phase de realisation. C1 (socle API), C2 (design system, shell, ecrans du socle) et C3 (Recettes) termines ; C4 (referentiels et admin) et C5 (planning) termines ; C6 (notifications, activite, temps reel, changelog) termine ; C6b (recherche, export, widgets) termine ; C7 (E2E, suivi d'erreurs, CI, preprod) en cours, plan `24-Plan-C7.md` : C7.1 a C7.6 faits, C7.7 (preprod) en cours ; preprod et prod se deploient depuis ce poste, pas a pas avec le proprietaire (D201).**
Point de reprise : `.claude/docs/Rework-V2/README.md`, puis la premiere case non cochee de `4-Roadmap.md`.

La V1 est obsolete et supprimee de l'arbre (reference : tag git `v1-final`).

## Contexte de session

Des que le contexte depasse 30 a 40 % et qu'un point de reprise propre existe (tache terminee, etat ecrit dans le `README.md` du chantier, travail committe), **marquer une pause et prevenir l'utilisateur** qu'il faut nettoyer le contexte (`/clear`) avant de continuer. Ne pas enchainer sur l'etape suivante.

## Stack

Monorepo npm workspaces (npm 11) : `apps/api`, `apps/web`, `packages/shared`, `packages/test-utils`.
Node 22 (types TS effaces nativement, pas de build API) + TypeScript 6 strict + Express 5 + Zod 4 | React 19 + Vite 8 | PostgreSQL 17 + Prisma (a partir de C1.4) | Vitest 5 | Docker + GitHub Actions + Portainer + Traefik.
Cible complete et versions : `.claude/docs/Rework-V2/14-Architecture.md`.

## Commandes

Tout tourne sous Docker (`docker/`). Ne jamais lancer les tests hors Docker (env vars absentes). Lint, typecheck et format tournent sur l'hote (Node de `.nvmrc`).

```bash
npm run docker:up:build        # stack de dev (web :3000, API :3001) ; a relancer apres un changement de dependances
npm run docker:logs            # logs
npm run docker:down            # arreter (docker:clean supprime aussi la base de dev)
npm test                       # tous les tests, dans docker/compose.test.yml (PostgreSQL de test en memoire)
npm run test:api               # idem par projet : test:web, test:shared
npm run test:down              # arreter la base de test
npm run e2e                    # parcours Playwright dans docker/compose.e2e.yml (front en image prod) ; e2e:down pour arreter
npm run lint && npm run typecheck
npm run prisma:migrate         # migrations (a partir de C1.4) ; prisma:studio sur :5555
npm run admin:create           # compte super admin dans la stack de dev (2FA a la premiere connexion)
```

## Conventions

- **TDD par defaut** (D151) : ecrire le test, le lancer et le voir echouer, puis le code minimal, puis nettoyer. Exceptions : outillage, configuration, Docker, CI.
- **Langue** : code 100% anglais. Commentaires et docs en francais.
- **Accents** : aucun dans le code et les docs (ASCII only).
- **IDs** : UUID v4. UUID "not found" en test : `00000000-0000-4000-8000-000000000000`.
- **Soft delete** (`deletedAt`) sur les entites principales ; hard delete en cascade sur les pivots.
- **Codes erreur** : constantes centralisees dans `packages/shared/src/errors/index.ts`, jamais de string literal.
- **Seed** : idempotent (upsert only, jamais de truncate). Preprod et prod sont persistantes et le seed tourne a chaque deploy.
- **Admin** : `AdminUser` isole des users, session dediee 30 min, 2FA TOTP obligatoire.

## Git

- Flux : branche de travail -> PR vers `Developement` (code de preprod) -> PR `Developement` -> `master` (deploy preprod a chaque push sur la PR) -> fusion = prod (deploy auto au push sur `master`). Pendant la preprod V2, travail direct sur `Developement`. Le proprietaire pousse et fusionne.
- Commit uniquement sur demande. **Jamais de Co-Authored-By pour Claude.**

## Documentation

Tout est dans `.claude/docs/` (index : `.claude/docs/README.md`). Regles :

- **Un chantier = un dossier** `.claude/docs/<Chantier>/` avec des fichiers numerotes : `README.md` (etat + ordre de lecture), `1-CDC`, `3-Journal-des-Decisions`, `4-Roadmap`, et les artefacts HTML.
- **Le CDC porte la conclusion, le journal porte le debat.** Une decision = un numero `D##` dans le journal, reprise en une ligne dans le CDC.
- **Roadmap** : cases `- [ ]` ; la premiere non cochee est le point de reprise. Cocher au fil de l'eau.
- **Artefacts** : toujours ecrire la copie locale dans le dossier du chantier AVANT de publier (lisible hors ligne), puis publier depuis ce fichier.
- **Un compteur ou un statut a un seul endroit** ; ailleurs on renvoie, on ne recopie pas.
- **Chantier termine** -> son dossier part dans `.claude/docs/Archive/` et n'est plus lu par defaut. Dans un chantier en cours, une etude terminee (conclusions reportees au CDC et au journal) va dans son sous-dossier `archive/`.
- **V1** : code et docs retires de l'arbre, lisibles dans le tag git `v1-final` (`git show v1-final:<chemin>`).
- Ne pas recopier ce que le code dit deja (arborescence, liste d'endpoints, schema) : lire le code (`apps/api/prisma/schema.prisma`, les `routes.ts` de `apps/api/src/`).
- Session interrompue : ecrire l'etat dans le `README.md` du chantier (section "Reprise").

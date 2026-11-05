# Rework V2

Refonte de Forest Manager : clarifier les concepts de la V1, refaire l'interface (shadcn/ui + Tailwind), decider entre faire evoluer et reecrire.

## Ordre de lecture

1. Ce README.
2. `4-Roadmap.md` : la premiere case non cochee est le point de reprise.
3. Le plan de l'etape en cours (`18-Plan-C2.md` pour C2 ; `17-Plan-C1.md` pour C1, termine).
4. `1-CDC-V2.md` : S1 a S3 (vision, glossaire, roles) pour tout le monde, puis la section du module concerne.
5. `3-Journal-des-Decisions.md` : seulement pour comprendre le pourquoi d'une regle (chercher le `D##`).

## Fichiers

| Fichier                       | Role                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `1-CDC-V2.md`                 | Cahier des charges cible. La version est dans son en-tete.                                                    |
| `3-Journal-des-Decisions.md`  | Decisions `D##` avec constat, options, choix, statut.                                                         |
| `4-Roadmap.md`                | Phases et cases a cocher.                                                                                     |
| `10-Design-System/project/`   | Copie locale du design system (tokens, README, 25 composants, apercus). Source de verite : `tokens.json`.     |
| `11-Modele-Donnees/`          | Schema Prisma cible (`schema.prisma`), page de presentation generee (`generer-page.py`).                      |
| `12-Permissions.md` / `.html` | Matrice des permissions par acteur et par module.                                                             |
| `13-Parcours.md` / `.html`    | 17 parcours et inventaire des 54 ecrans.                                                                      |
| `14-Architecture.md`          | Architecture technique cible.                                                                                 |
| `15-Plan-Tests.md`            | Plan de tests.                                                                                                |
| `16-Maquettes/`               | 4 canevas de maquettes (copies locales) et `BRIEF.md` (conventions, donnees d'exemple).                       |
| `17-Plan-C1.md`               | Plan de realisation du socle (C1) : perimetre, reprise de la V1, sous-etapes.                                 |
| `18-Plan-C2.md`               | Plan de C2 : design system en code, app shell, ecrans du socle.                                               |
| `archive/`                    | Etudes terminees (phase A et B5b) : leurs conclusions sont dans le CDC et le journal. Ne pas lire par defaut. |

`archive/` contient : l'analyse de la V1 (`2-Analyse-V1.html`), les etudes adaptations (5) et recettes composees (6, 7), les directions visuelles (8), la revue du brainstorming (9), les ecarts des maquettes traites en B5b.

## References V1 (tag git `v1-final`)

Le code et la documentation de la V1 ne sont plus dans l'arbre. Pour reprendre une partie a la main : `git show v1-final:<chemin>`. Utile pour :

- C3 import : `.claude/docs/V1/features/recipe-import/SPEC_RECIPE_IMPORT.md`, `MANUAL_TESTS.md` (cas HelloFresh), `backend/src/services/recipeImportService.ts` ;
- C3 stockage : `.claude/docs/V1/features/photo-upload/GUIDE_MINIO.md` ;
- C4 admin 2FA : `backend/src/admin/` ;
- C5 generation du planning : `.claude/docs/V1/features/meal-plan/SPEC_MEAL_GENERATION.md`, `backend/src/services/mealGenerationService.ts`.

## Reprise

- Derniere session : 2026-11-05. Contexte remis a zero apres cette session : tout l'etat est ici et dans les fichiers cites.
- Fait : etude (A), design system (B4), modele de donnees (B1), permissions (B2), parcours (B3), architecture (B6), tests (B8), maquettes (B5). Version et couverture du CDC : son en-tete.
- Fait aussi : decisions D01 a D142 (journal). Points ouverts B9 tranches le 2026-11-05 (D140 a D142) : copie independante supprimee, liste de courses a role minimal reglable, schema mis a jour avec les decisions des maquettes, super admin sans modification de recette, statuts des documents au journal, D37 et D130 definitifs, D12 et D14 non utilises.
- CDC 1.0 valide par le proprietaire le 2026-11-05 (B9) : la phase d'etude est terminee, le code est autorise.
- Plan de C1 valide le 2026-11-05 (`17-Plan-C1.md`, D143 a D146) : la V2 remplace la V1 des C1.1, API seule en C1, PostgreSQL 17, avatars en C3.
- C1.1 fait le 2026-11-05 : V1 supprimee de l'arbre, workspaces `apps/api`, `apps/web`, `packages/shared`, `packages/test-utils`, TypeScript 6.0 strict, ESLint 9 flat (typescript-eslint strict type-checked), Vitest 5 en projets. Lint, typecheck, tests et build web verts dans `node:22-alpine`.
  - Versions : regle des deux semaines appliquee le 2026-11-05 (Vite 8.3.5, Vitest 5.0.5 car la 5.1.0 date du 2026-11-02, plugin React 6.1.2, typescript-eslint 8.72.0). ESLint reste en 9 comme prevu au plan (la 10 existe).
  - **npm 11 obligatoire** (`packageManager: npm@11.21.1`) : npm 10 (fourni avec Node 22) plante sur les peers de vitest (`Cannot read properties of null (reading 'edgesOut')`). Les Dockerfiles de C1.2 installent npm 11.
  - Node de l'hote : `.nvmrc` = 22 (meme version que les images Docker) ; le hook pre-commit charge cette version via nvm, quel que soit le Node par defaut de l'hote. lint-staged en 17.
  - API provisoire : `node apps/api/src/server.ts` (types effaces nativement par Node 22.18+, d'ou `erasableSyntaxOnly`), `GET /health` seulement.
  - Tag `v1-final` present sur GitHub (verifie le 2026-11-05).
- C1.2 fait le 2026-11-05 : `docker/` (api et web en multi-etapes dev/prod, `compose.dev.yml`, `compose.test.yml`, nginx du front), scripts racine, `CLAUDE.md` a jour.
  - Dev : node_modules vient de l'image (volume anonyme renouvele par `docker:up:build`), volume `postgres_data` recree en PostgreSQL 17 (l'ancien volume V1 en 15 a ete supprime).
  - Tests : conteneur jetable `tests` (image dev de l'API) + PostgreSQL 17 en tmpfs, projet compose `forestmanager-test` force par `-p` (sinon `COMPOSE_PROJECT_NAME` du `.env` gagne). La CI de C1.10 lancera la meme commande.
  - Prod : API sans build, utilisateur `node`, tini ; front nginx (SPA, en-tetes de securite, cache long sur `/assets/`, proxy `/api/` vers `forestmanager-backend:3001` comme en V1). Images verifiees a la main ensemble.
  - Reste pour C1.4 : Prisma dans `apps/api`, extensions `pg_trgm` et `unaccent` dans la premiere migration, `migrate deploy` + seed au demarrage de l'image prod (comme en V1), variables d'env (`SESSION_SECRET`...) dans les compose.
  - D147 (demande du proprietaire) : la CI et le deploy reprennent la V1 (memes secrets, images, stacks Portainer, Traefik). Ecrit en C1.10.
- C1.3 fait le 2026-11-05 : `packages/shared` (zod 4.6.7) avec `errors/` (codes par domaine, statut HTTP, message francais accentue [D87], cle `errors.<CODE>`), `permissions/` (matrice du socle, `can()`, permissions de module par role minimal, reglable si `configurable` [D58]), `modules/` (contrat commun, `validateModuleDefinitions`), `schemas/` (auth, profil, preferences, espaces, membres, transfert, liens, invitations, modules, pagination). 209 tests unitaires, dont la matrice recopiee a la main.
  - Regles posees : un non-membre recoit `SPACE_001` (404) comme un espace inexistant (pas d'enumeration) ; `can()` ne porte que le role, les cases "Cond." et "Soi" sont des regles des services ; mot de passe 10 a 128 caracteres ; connexion par email ou username (`identifier`).
- C1.4 fait le 2026-11-05 : `apps/api/src/core/` (`config/env.ts` Zod, `db/client.ts` Prisma 7 + adapter pg, `http/` app Express 5 injectable, helmet strict JSON, CSRF double submit **signe** (HMAC, actif aussi en test), limiteur de debit au format unique, `handle()` / `reply()` pour valider entrees et sorties, gestionnaire d'erreurs unique, pino avec `X-Request-Id`), `GET /health`, `GET /api/v1/config`.
  - Prisma : `apps/api/prisma/schema.prisma` = sections 1 a 3 du schema cible + `AdminUser` reduit ; client genere dans `apps/api/src/generated/` (ignore par git, regenere au demarrage du conteneur dev, par l'entree des tests et dans l'image prod). Migration `socle` : extensions `pg_trgm` / `unaccent`, index partiels et CHECK, username unique sans casse.
  - Demarrage (`docker/api-start.sh`) : `migrate deploy`, seed, serveur (dev et prod). Seed : catalogue `Module` ; le statut n'est ecrit qu'a la creation (il appartient ensuite au super admin).
  - Tests : `apps/api/test/helpers/` (base videe hors referentiels avant chaque fichier, client Supertest avec CSRF, fabriques `createUser`, `createSpace`, `addMember`, `grantModule`) ; constructeurs purs dans `packages/test-utils`.
- C1.5 fait le 2026-11-05 : `core/auth/` (inscription avec espace perso et modules par defaut, connexion par email ou username sans casse, "rester connecte" 30 jours, rotation de session, deconnexion, `GET/PATCH /me`, `PUT /me/password` qui ferme les autres sessions, `PATCH /me/preferences`), emails optionnels (`core/mail/`, verification non bloquante, mot de passe oublie sans enumeration, jetons hashes a usage unique, AUTH_007 sans SMTP), argon2id, liste locale de mots de passe faibles + regles (username, repetitions, suites), rate limit connexion / inscription / oubli. Store de sessions maison (D148).
  - Mot de passe temporaire de l'admin (D134) : en C4 avec l'admin.
- C1.6 fait le 2026-11-05 : `core/spaces/` (`access.ts` : membre actif puis `can()`, SPACE_001 pour un non-membre, SPACE_003 pour une action impossible dans l'espace perso ; `service.ts` ; `routes.ts`). Creer (plafond 20, D51), lister (avec les espaces supprimes restaurables chez l'OWNER), lire avec modules actifs, modifier (perso : teinte seule), membres (promouvoir, retrograder, exclure D53, quitter), transfert propose / accepte / refuse / annule (D92, `GET /me/transfers` en attendant les notifications de C6), suppression masquee, restauration, purge horaire avec crochets `onSpaceDeleted` (`core/modules/hooks.ts`, vides en C1). D149 : `Membership.excludedAt`.
  - Tests de permissions generes : `apps/api/test/helpers/roles.ts` (`describePermissions`, un test par route et par acteur, attendu tire de `can()`).
- C1.7 fait le 2026-11-05 : `core/spaces/invitations.ts` et `invitations-routes.ts`. Liens (code 128 bits hache, 1/7/30 jours, nombre de personnes, compteur incremente sous condition en SQL, apercu public D62, revocation), invitations par username (202 dans tous les cas, D150 ; doublon PENDING ignore par l'index partiel), `GET /me/invitations`, accepter / refuser / annuler. Un exclu ne revient pas par lien (SPACE_015) mais par invitation directe ; rejoindre accepte l'invitation directe en attente. Rate limit sur les codes et les invitations.
- Methode a partir de C1.8 : TDD (D151).
- C1.8 fait le 2026-11-05 (TDD) : `core/modules/registry.ts` (type `ApiModule`, validation au demarrage avec codes reserves, crochets, `syncCatalog` appele par le seed, D152), `guards.ts` (`requireModule`, `requirePermission`), `service.ts` et `routes.ts` (catalogue, demande, annulation, activation, ordre). Manifestes dans `apps/api/src/modules/` (Recettes minimal avec une route provisoire `GET /spaces/:id/recipes`, Planning et Courses declares), injectes par `server.ts`, le seed et `test/helpers/app.ts`.
- C1.9 fait le 2026-11-05 (TDD) : `core/auth/deletion.ts`, `GET /me/deletion-preview` (issue par espace : TRANSFERRED avec l'heritier, DELETED, LEFT) et `DELETE /me` (mot de passe). D153.
- C1.10 fait le 2026-11-05 : `.github/workflows/ci.yml` (verification identique au poste : format, lint, typecheck, audit des dependances de prod, `npm test` ; images `backend` et `frontend` taguees `sha-<court>`, + `latest` sur master ; PR vers master = preprod, push master = prod puis tag `v<version>`), `docker/compose.prod.yml` et `compose.preprod.yml` (V1 a l'identique sauf PostgreSQL 17 sur un volume neuf `postgres17_data[_dev]`, logs sur stdout), `docker/deploy.sh` (envsubst limite a une liste, fichier temporaire nettoye). Image prod verifiee a la main (migrations, seed, `/health`). Les fichiers HTML d'artefacts de `.claude/docs` sont exclus de Prettier (copies exactes).
  - Changelog en base apres la prod : en C6 avec le modele `Changelog` (seul le tag est pose d'ici la).
  - **A verifier** : premier passage de la CI sur GitHub (pas encore pousse au 2026-11-05).
- **C1 termine le 2026-11-05.**
- Plan de C2 ecrit le 2026-11-05 (`18-Plan-C2.md`, D154 a D157), sans validation formelle : le proprietaire a demande d'avancer sans questions pendant cette session ; a relire.
- C2.1 fait le 2026-11-05 : dependances web (versions dans `18-Plan-C2.md`), Tailwind 4 dont le theme lit les tokens, `tokens.css` et `ds.css` copies du design system, polices @fontsource (D156), client API (`lib/api.ts` : CSRF, erreurs `ApiRequestError`, reponses validees), resolver Zod maison (`lib/form.ts`, messages Zod en francais ; `@hookform/resolvers` ecarte pour un conflit de peers), i18next (`core`, `errors`), TanStack Query, Vitest jsdom + MSW 3 (`onUnhandledFrame: "error"`), proxy `/api` de Vite (`API_PROXY_TARGET`). Les caches Vite des conteneurs sont masques par un volume anonyme (`/app/apps/web/node_modules`) pour ne plus creer de dossier root sur l'hote.
- Prochaine etape : C2.2 (composants du design system).
- Tout est publie et committe au 2026-11-05 : DS v10, Acces v39, Recettes v35, Planning v26, Admin v26, Permissions v5, Parcours v6, Modele de donnees v5. Maquettes revues dans Chrome le 2026-11-05 (B5b, voir `archive/16-Maquettes-ECARTS.md`).
  - Chaque canevas se met a jour depuis sa copie locale `16-Maquettes/<canevas>/project/` a son URL (le dossier `ds/` n'existe que dans l'artefact) : relire l'artefact (action read sur l'URL), puis publier avec `root` = le dossier du canevas, `file_path` = un fichier modifie, `files` = les autres (`project/...`).
  - Les numeros de version des artefacts avancent aussi a la simple consultation : comparer le contenu en ligne au commit avant d'ecraser.
  - Page du modele de donnees : `python3 generer-page.py schema.prisma Modele-Donnees.html` depuis `11-Modele-Donnees/`, puis prettier sur le .html.
- Methode : copie locale d'abord, puis publication ; commits en francais, autonomes, sans Co-Authored-By ; taches independantes en agents paralleles.
- Artefacts :
  - Analyse V1 : https://claude.ai/artifact/2j7eohGZT8qonftWqb1wUw (`archive/2-Analyse-V1.html`)
  - Recettes composees : https://claude.ai/artifact/LCuB3UZkuVhQqqDMvnP8ae (`archive/7-Proposition-Recettes-Composees.html`)
  - Directions visuelles : https://claude.ai/artifact/DEwK7Soo52ZvKi7qsbzpPr (`archive/8-Directions-Visuelles.html`)
  - Design System : https://claude.ai/artifact/7Q9Uy9qGhUyPYt3bWVa5yc (`10-Design-System/project/`)
  - Modele de donnees : https://claude.ai/artifact/T1MdLYv3PmTx1vDQQM3ajD (`11-Modele-Donnees/Modele-Donnees.html`, regenere par `generer-page.py`)
  - Permissions : https://claude.ai/artifact/Hkq6p1cHvv6SnEgV4VNGzE (`12-Permissions.html`)
  - Parcours : https://claude.ai/artifact/Ryd9M1F6DKM3Ni7wuyNjqX (`13-Parcours.html`)
  - Maquettes Acces et espaces : https://claude.ai/artifact/BT5twLkx7ayNLTsBSjGWuB (`16-Maquettes/1-Acces-Espaces/project/`)
  - Maquettes Recettes : https://claude.ai/artifact/D3NXrW3qfML3cWURVAARLJ (`16-Maquettes/2-Recettes/project/`)
  - Maquettes Planning et profil : https://claude.ai/artifact/8SoeKigajmFtEK4q8RPRrY (`16-Maquettes/3-Planning-Profil/project/`)
  - Maquettes Administration : https://claude.ai/artifact/BW2txaUya8r2YnpHH8GF17 (`16-Maquettes/4-Administration/project/`)

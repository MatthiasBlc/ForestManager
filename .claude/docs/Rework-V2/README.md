# Rework V2

Refonte de Forest Manager : clarifier les concepts de la V1, refaire l'interface (shadcn/ui + Tailwind), decider entre faire evoluer et reecrire.

## Ordre de lecture

1. Ce README.
2. `4-Roadmap.md` : la premiere case non cochee est le point de reprise.
3. Le plan de l'etape en cours (`17-Plan-C1.md` pour C1).
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
- Prochaine etape : C1.4 (squelette API, Prisma, seed, harnais de test).
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

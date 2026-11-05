# Plan C1 - Socle

Statut : voir le journal (D143 a D147). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `14-Architecture.md` (cible), `11-Modele-Donnees/schema.prisma` (sections 1 a 3), `12-Permissions.md` (Compte, Espace perso, Espace groupe, Modules), `15-Plan-Tests.md` (Socle).

## 1. Perimetre

**Dans C1** : monorepo, package partage, environnement Docker V2, squelette API (securite, erreurs, validation), comptes (inscription, connexion, sessions, emails optionnels, profil, suppression), espaces, membres et roles, transfert de propriete, suppression et restauration d'espace, invitations (lien et username), registre de modules cote API (catalogue, demande d'acces, activation), CI V2 reprise de la V1 (deploy preprod et prod ecrit, inactif avant C7) [D147].

**Hors C1** (etape cible entre parentheses) :

- Ecrans web : seulement un squelette Vite qui demarre ; le design system, l'app shell et les ecrans du socle sont en C2 [D144].
- Decision du super admin sur les demandes d'acces, mot de passe temporaire [D134], 2FA, audit (C4). En C1, les tests accordent un module via une fabrique.
- Notifications, fil d'activite, temps reel Socket.IO, exports [D37], recherche (C6). En C1, les invitations en attente se lisent par `GET /api/v1/me/invitations` ; C6 branchera les notifications sur les actions existantes.
- Avatars (utilisateur, espace) et stockage MinIO : C3, avec les photos de recettes (un seul chantier stockage) [D146].

## 2. Remplacement de la V1 [D143]

La V1 n'est plus utilisee : la V2 la remplace des C1, sans periode de coexistence.

- **Avant de supprimer** : tag git `v1-final` sur le dernier commit V1. Les parties encore a reprendre plus tard (import JSON-LD en C3, generation du planning en C5, admin 2FA en C4) se relisent depuis ce tag (`git show v1-final:backend/src/...`).
- **C1.1 supprime** `backend/`, `frontend/`, `scripts/`, `deploy_prod.sh`, les `docker-compose*.yml` racine et `.github/workflows/deploy.yml`. La V2 prend les noms courts (`npm run docker:up`, `npm test`...).
- **Prod et preprod** : les stacks Portainer V1 continuent de tourner sans etre redeployees (plus aucun workflow de deploy jusqu'a C7). Rien ne part sur `master` avant C7.
- **CI** : `.github/workflows/ci.yml` (C1.10, D147) : verification sur tout push, preprod sur PR vers `master`, prod au push sur `master`. Rien ne part vers `master` avant C7.
- `CLAUDE.md` (Etat actuel, Commandes, Stack) est mis a jour en C1.2, quand les nouvelles commandes existent.

## 3. Reprise de la V1 (relue depuis `v1-final` puis recopiee a la main)

Regle pour toute la phase C : rien n'est recopie tel quel. Chaque partie reprise est relue avec un oeil performance, securite, optimisation et qualite, et ameliore au passage (demande du proprietaire, 2026-11-05). Les ameliorations notables sont signalees dans le message de commit.

| V1                                                            | V2                                              | Changement                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `middleware/csrf.ts`, `security.ts`, `config/rateLimiter.ts`  | `core/http/`                                    | Express 5 ; rate limit ajoute sur inscription et mot de passe oublie.            |
| `middleware/errorHandler.ts`, `constants/errorCodes.ts`       | `core/http/errors.ts`, `packages/shared/errors` | Format unique `{ error: { code, message, details } }` [D72], codes par domaine.  |
| `middleware/validateBody.ts`, `validateUUID.ts`               | `core/http/validate.ts`                         | Un seul middleware `params/query/body` sur les schemas Zod 4 partages, `strict`. |
| `util/logger.ts`, `middleware/httpLogger.ts`                  | `core/http/logger.ts`                           | pino 10, identifiant de requete.                                                 |
| `util/validateEnv.ts`                                         | `core/config/env.ts`                            | Zod au lieu d'envalid ; `SMTP_URL` optionnel [D21].                              |
| `config/session.ts` (`@quixo3/prisma-session-store`, 1 h)     | `core/auth/session.ts`                          | Store PostgreSQL, 1 jour glissant ou 30 jours [D13], rotation a la connexion.    |
| `controllers/auth.ts` (bcrypt)                                | `core/auth/`                                    | argon2id, politique 10 caracteres + liste locale de mots de passe faibles.       |
| `controllers/communities.ts`, `members.ts`, `invites.ts`      | `core/spaces/` (reecrits)                       | Nouveau modele (espace perso, liens d'invitation, transfert propose).            |
| `backend/Dockerfile`, `docker-compose.test.yml`, `deploy.yml` | `docker/`, `.github/workflows/v2-ci.yml`        | Contexte de build monorepo ; meme structure multi-etapes.                        |
| `__tests__/setup`                                             | `apps/api/test/setup`, `packages/test-utils`    | TRUNCATE hors referentiels entre fichiers, fabriques partagees [D79].            |

## 4. Sous-etapes (dans l'ordre, un commit ou plus chacune)

Chaque sous-etape se termine par des tests verts dans Docker.

### C1.1 Monorepo et outillage

- Suppression du code et de l'infra V1 (section 2). Le tag `v1-final` est deja pose (2026-11-05, avant le menage de la documentation) et present sur GitHub.
- Workspaces `apps/api`, `apps/web` (squelette Vite + React 19 qui affiche une page vide), `packages/shared`, `packages/test-utils`.
- `tsconfig.base.json` (TypeScript 6.0, strict, ESM), alias `@fm/shared` et `@fm/test-utils`.
- ESLint 9 flat + typescript-eslint, Prettier (config racine existante), Vitest 5.
- Versions : celles de `14-Architecture.md` S14, reverifiees le 2026-11-05 (inchangees : Prisma reste en 7.10, la 8 est encore en rc ; TypeScript reste en 6.0 malgre la 7.0).

### C1.2 Docker V2

- `docker/api.Dockerfile`, `docker/web.Dockerfile` (multi-etapes, Node 22 alpine).
- `docker/compose.dev.yml` (postgres, api, web ; volumes montes sur les sources) et `docker/compose.test.yml` (PostgreSQL de test).
- Scripts racine aux noms courts (`docker:up:build`, `docker:logs`, `test`, `test:api`, `test:web`, `prisma:migrate`, `prisma:studio`) ; ports d'origine (web 3000, API 3001).
- `CLAUDE.md` mis a jour (commandes, stack, etat).
- PostgreSQL 17 [D145] (base neuve, rien a migrer) ; extensions `pg_trgm` et `unaccent` creees par la premiere migration.

### C1.3 Package partage

- `errors/` : codes `AUTH_`, `SPACE_`, `MODULE_`, `VALIDATION_`, `COMMON_` avec message francais par defaut et cle i18n.
- `permissions/` : cles du socle et matrice role -> permissions de `12-Permissions.md` (Compte, Espace perso, Espace groupe, Modules) ; fonction pure `can(context, key)`. Tests unitaires exhaustifs (table de cas tiree de la matrice).
- `modules/` : types du manifeste (API et web).
- `schemas/` : auth, profil, espaces, membres, invitations, modules (entrees et sorties).

### C1.4 Squelette API

- App Express 5 : helmet, CORS, limite de corps, CSRF double submit, request id, logger, gestion d'erreurs au format unique.
- `GET /health`, `GET /api/v1/config` (`features.email`).
- Prisma 7 : **seulement les modeles du socle** (sections 1 a 3 du schema cible + `AdminUser` reduit si une relation l'exige). Chaque etape suivante (C3, C4, C5, C6) ajoute ses modeles par sa propre migration. Index partiels et CHECK en SQL dans la migration.
- Seed idempotent : catalogue `Module` (`recipes` AVAILABLE + `isDefault`, `meal-plan` et `shopping` COMING_SOON).
- Harnais de test : base de test, TRUNCATE entre fichiers, Supertest, fabriques (`user`, `space`, `membership`, `grantModule`).

### C1.5 Comptes et sessions (F-ACC-1 a 4)

- Inscription (cree l'espace perso + accorde et active Recettes), connexion avec "Rester connecte", deconnexion, `GET /me`.
- Emails optionnels : nodemailer si `SMTP_URL`, verification d'email (non bloquante), mot de passe oublie et reinitialisation ; sans SMTP, routes desactivees et `features.email: false`.
- Profil : username, email, mot de passe (ferme les autres sessions), preferences d'affichage (ambiance, mode, densite, taille du texte, langue).
- Rate limit sur connexion, inscription, mot de passe oublie.

### C1.6 Espaces et membres (F-SPC-1, F-SPC-4, F-SPC-5)

- Creer un espace groupe, lister mes espaces, lire un espace (avec ses modules actifs), modifier nom, description, teinte.
- Membres : lister, promouvoir, retrograder, exclure [D53], quitter (OWNER bloque sans transfert ; dernier membre -> suppression confirmee), retour d'un ancien membre [D59].
- Transfert de propriete propose, accepte, refuse, annule [D92].
- Suppression (masquee, `purgeAfter` = +30 jours), restauration, job de purge [D22]. Le job appelle les crochets `onSpaceDeleted` du registre (vides en C1 ; Recettes les remplira pour D83).
- Crochet `onMemberLeft` declare dans le registre (vide en C1 ; D18 et D84 en C3).

### C1.7 Invitations (F-SPC-2, F-SPC-3)

- Lien : creation (1, 7 ou 30 jours ; nombre de personnes), jeton 128 bits stocke hache, apercu public de l'espace par le code, rejoindre, revoquer [D07][D94].
- Username exact : inviter, accepter, refuser, annuler ; une seule PENDING par couple ; reponse identique que le compte existe ou non (pas d'enumeration) [D07][D50].
- `GET /api/v1/me/invitations`.

### C1.8 Registre de modules (F-SPC-6)

- Liste statique des manifestes, validation au demarrage (codes uniques, permissions sans collision), synchro du catalogue (COMING_SOON pour un code nouveau, RETIRED pour un code retire).
- `requireModule(code)` (`MODULE_001`), `requirePermission(key)` branche sur `can()` du partage.
- Catalogue (visible par tous les membres [D54]), demande d'acces par l'OWNER, annulation, redemande apres refus [D124], activation, desactivation (Recettes non desactivable [D91]), ordre des modules [D131].
- Un manifeste `recipes` minimal (code, permissions, routeur vide) pour prouver le branchement sans que le socle l'importe.

### C1.9 Suppression du compte (F-ACC-5, socle)

- Anonymisation [D20], depart de tous les espaces, transfert automatique de propriete et plafond de 20 espaces possedes [D51], espace perso supprime. Les consequences par espace sont calculees par l'API (ecran D116 en C2) ; l'export propose arrive en C6.

### C1.10 CI V2 [D147]

- Reprise de `.github/workflows/deploy.yml`, `deploy_prod.sh` et des compose preprod et prod de la V1 (tag `v1-final`) : memes secrets, memes images, memes stacks Portainer, memes labels Traefik et reseaux externes (`proxy`, `minio-net`).
- Verification : format, lint, typecheck, audit, tests dans `docker/compose.test.yml` (comme en local), build des images.
- Deploy : PR vers `master` = preprod, push sur `master` = prod, puis changelog et tag. Rien ne part vers `master` avant C7 [D143].

## 5. Definition de fini de C1

- Toutes les routes du socle couvertes en integration, un test par role (OWNER, MODERATOR, MEMBER, non-membre, anonyme) genere depuis la matrice.
- CI V2 verte sur la branche de travail.
- Plus aucune trace de la V1 dans l'arbre (hors tag `v1-final`).
- README du chantier et roadmap a jour.

## 6. Questions pour le proprietaire (tranchees le 2026-11-05)

- Q-C1-1 Coexistence : la V1 est obsolete, la V2 la remplace des C1 (D143).
- Q-C1-2 Ecrans dans C1 : API seule (D144).
- Q-C1-3 PostgreSQL : 17 (D145).
- Q-C1-4 Avatars et MinIO : en C3 (D146).

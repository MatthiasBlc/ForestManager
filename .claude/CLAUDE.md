# Forest Manager

App de gestion de communautes pour partage de recettes. Communautes privees (invite-only), recettes collaboratives avec propositions/variantes, admin plateforme via SuperAdmin.

## Stack

React 18 + TS + Vite + TailwindCSS | Node.js + Express + TS | PostgreSQL + Prisma | Docker + GitHub Actions + Portainer

## Conventions

- **Langue**: Code 100% anglais (variables, fonctions, modeles). Commentaires francais OK
- **Accents**: Aucun dans le code/docs (ASCII only)
- **Soft delete**: `deletedAt` sur entites principales (User, Community, Recipe...)
- **Hard delete**: Tables pivot (RecipeTag, RecipeIngredient) via Cascade
- **IDs**: UUID v4 partout
- **Roles communaute**: MEMBER | MODERATOR
- **Admin**: AdminUser (plateforme, isole du systeme user)
- **Sessions**: 2 systemes isoles (user `connect.sid` 1h / admin `admin.sid` 30min)
- **Securite admin**: 2FA TOTP obligatoire, rate limiting, audit log, sessions isolees

## Commandes essentielles

```bash
npm run docker:up:build        # Demarrer dev
npm run docker:logs            # Logs
npm test                       # Tous les tests (backend + frontend)
npm run test:backend           # Backend seul
npm run test:frontend          # Frontend seul
npx prisma migrate dev         # Migrations (dans container)
npx prisma studio              # DB GUI :5555
```

## Git

- **Main**: master
- **Branche courante**: Developement
- **Commits**: Ne JAMAIS ajouter de Co-Authored-By pour Claude

## Phase actuelle

MVP complet (phases 0-17). Voir `.claude/context/PROGRESS.md` pour les features en cours.

## Codes erreur

**User API** : AUTH_001-011 | USER_001 | COMMUNITY_001-006 | RECIPE_001-009 | INVITE_001-006 | MEMBER_001-004 | PROPOSAL_001-004 | SHARE_001-006 | PUBLISH_001-003 | TAG_001-007 | INGREDIENT_003 | NOTIF_001-005 | IMPORT_001-003 | VALIDATION_001

**Admin API** : ADMIN_001-011 | ADMIN_TAG_001-006 | ADMIN_ING_001-009 | ADMIN_UNIT_001-007 | ADMIN_REC_001-003 | ADMIN_COM_001-003 | ADMIN_FEAT_001-006

## Regle: maintenir `.claude/` a jour

Apres chaque modification (nouveau fichier, endpoint, migration, test, phase, branche), mettre a jour :

- `.claude/context/` (PROGRESS, TESTS, API_MAP, DB_MODELS, FILE_MAP selon pertinence)
- La **roadmap de la feature en cours** (cocher les taches dans `docs/features/*/ROADMAP.md`)

Si une tache est en cours et que les tokens arrivent a leur limite, generer `.claude/context/RESUME.md` avec: tache en cours, etapes faites, etapes restantes, fichiers modifies, et tout contexte necessaire pour reprendre sans perte.

### PROGRESS.md : garder le fichier compact

- Juste un lien vers la phase en cours (spec + roadmap dans `docs/features/`)
- Pas de duplication de la roadmap dans PROGRESS

## Organisation docs/

```
docs/
  0 - brainstorming futur.md       # Idees futures (transversal)
  features/                         # Specs par feature post-MVP
    tags-rework/
      SPEC_TAGS_REWORK.md
    ingredients-rework/
      SPEC_INGREDIENTS_REWORK.md
    recipe-rework-v2/
      SPEC_RECIPE_REWORK_V2.md
    notifications-rework/
      SPEC_NOTIFICATIONS_REWORK.md
    input-validation-security/
      SPEC_INPUT_VALIDATION.md
    photo-upload/
      SPEC_PHOTO_UPLOAD.md
      GUIDE_MINIO.md
    audit-refactorisation/
      SPEC_AUDIT_REFACTORISATION.md
    recipe-import/                    # EN COURS
      SPEC_RECIPE_IMPORT.md
      ROADMAP.md
    e2e-testing/                      # PLANIFIE
      SPEC_E2E_TESTING.md
      ROADMAP.md
```

Chaque nouvelle feature a son dossier dans `docs/features/` avec au minimum une spec et une roadmap.

## Contexte approfondi (lire selon le besoin)

| Besoin                              | Fichier                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| Avancement & phase en cours         | `.claude/context/PROGRESS.md`                                       |
| Tests: commandes, inventaire, infra | `.claude/context/TESTS.md`                                          |
| Endpoints API complets              | `.claude/context/API_MAP.md`                                        |
| Schema DB & modeles Prisma          | `.claude/context/DB_MODELS.md`                                      |
| Arborescence fichiers source        | `.claude/context/FILE_MAP.md`                                       |
| Idees futures                       | `docs/0 - brainstorming futur.md`                                   |
| **Feature : Recipe Import**         |                                                                     |
| Spec Recipe Import                  | `docs/features/recipe-import/SPEC_RECIPE_IMPORT.md`                 |
| Roadmap Recipe Import               | `docs/features/recipe-import/ROADMAP.md`                            |
| **Feature : E2E Testing**           |                                                                     |
| Spec E2E Testing                    | `docs/features/e2e-testing/SPEC_E2E_TESTING.md`                     |
| Roadmap E2E Testing                 | `docs/features/e2e-testing/ROADMAP.md`                              |
| **Specs features (reference)**      |                                                                     |
| Tags Rework                         | `docs/features/tags-rework/SPEC_TAGS_REWORK.md`                     |
| Ingredients Rework                  | `docs/features/ingredients-rework/SPEC_INGREDIENTS_REWORK.md`       |
| Recipe Rework v2                    | `docs/features/recipe-rework-v2/SPEC_RECIPE_REWORK_V2.md`           |
| Input Validation                    | `docs/features/input-validation-security/SPEC_INPUT_VALIDATION.md`  |
| Notifications Rework                | `docs/features/notifications-rework/SPEC_NOTIFICATIONS_REWORK.md`   |
| Photo Upload                        | `docs/features/photo-upload/SPEC_PHOTO_UPLOAD.md`                   |
| Guide MinIO                         | `docs/features/photo-upload/GUIDE_MINIO.md`                         |
| Audit Refactorisation               | `docs/features/audit-refactorisation/SPEC_AUDIT_REFACTORISATION.md` |

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
- **Branche courante**: CommunitiesBases
- **Commits**: Ne JAMAIS ajouter de Co-Authored-By pour Claude

## Phase actuelle

**Phase 3** (Communautes & Invitations) - Backend 3.1-3.3 COMPLETE, Frontend 3.4-3.5 A FAIRE.
Voir `.claude/context/PROGRESS.md` pour le detail.

## Codes erreur

AUTH_001 (non auth) | COMMUNITY_001-006 | RECIPE_001-002 | INVITE_001-003 | ADMIN_001-012

## Regle: maintenir `.claude/` a jour

Apres chaque modification (nouveau fichier, endpoint, migration, test, phase, branche), mettre a jour les fichiers `.claude/context/` concernes avant de terminer la session.
Si une tache est en cours et que les tokens arrivent a leur limite, generer `.claude/context/RESUME.md` avec: tache en cours, etapes faites, etapes restantes, fichiers modifies, et tout contexte necessaire pour reprendre sans perte.

## Contexte approfondi (lire selon le besoin)

| Besoin | Fichier |
|--------|---------|
| Avancement phases & resume | `.claude/context/PROGRESS.md` |
| Tests: commandes, fichiers, infra | `.claude/context/TESTS.md` |
| Endpoints API complets | `.claude/context/API_MAP.md` |
| Schema DB & modeles Prisma | `.claude/context/DB_MODELS.md` |
| Arborescence fichiers source | `.claude/context/FILE_MAP.md` |
| Regles metier detaillees | `docs/BUSINESS_RULES.md` |
| User stories | `docs/USER_STORIES.md` |
| Architecture & patterns | `docs/ARCHITECTURE.md` |
| Roadmap & plan de tests | `docs/DEVELOPMENT_ROADMAP.md` |
| Spec API (contrat REST) | `docs/API_SPECIFICATION.md` |
| Roadmap tests par sprint | `docs/TESTS_IMPLEMENTATION_PLAN.md` |

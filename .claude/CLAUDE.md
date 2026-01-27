# Forest Manager - Context

## Project

Application de gestion de communautes pour partage de recettes. Systeme de communautes privees (invite-only), recettes collaboratives avec propositions/variantes, et administration plateforme via SuperAdmin.

## Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **DB**: PostgreSQL + Prisma ORM
- **Auth**: express-session + @quixo3/prisma-session-store
- **Admin 2FA**: otplib + qrcode (TOTP)
- **Deploy**: Docker + GitHub Actions + Portainer

## Architecture

```
backend/src/
├── controllers/     # Logique metier
├── middleware/      # Auth, validation
├── routes/          # Endpoints API
├── admin/           # Module SuperAdmin isole
│   ├── controllers/
│   ├── routes/
│   └── middleware/
└── scripts/         # CLI (admin:create)

frontend/src/
├── components/
├── pages/
├── network/         # Client API
└── contexts/
```

## Sessions (2 systemes isoles)

| Type | Cookie | Model | Duree | Secret |
|------|--------|-------|-------|--------|
| User | `connect.sid` | Session | 1h | SESSION_SECRET |
| Admin | `admin.sid` | AdminSession | 30min | ADMIN_SESSION_SECRET |

## Conventions

- **Langue**: Code en anglais uniquement (variables, fonctions, modeles DB, etc.). Commentaires en francais autorises.
- **Soft delete**: `deletedAt` sur entites principales (User, Community, Recipe, etc.)
- **Hard delete**: Tables pivot (RecipeTag, RecipeIngredient) via Cascade
- **IDs**: UUID v4 partout
- **Accents**: Aucun dans le code/docs (ASCII only)
- **Roles**: MEMBER | MODERATOR (communaute), AdminUser (SuperAdmin plateforme, isole)

## Modeles cles

- **User/Community**: Relation N:N via UserCommunity (avec role)
- **Recipe**: Peut etre personnelle (communityId=null) ou communautaire
- **originRecipeId**: Lien vers recette d'origine (variante, fork, lien perso/communautaire)
- **Feature**: Briques attribuables aux communautes (MVP par defaut)
- **CommunityInvite**: Workflow PENDING → ACCEPTED/REJECTED/CANCELLED

## Securite Admin (CRITIQUE)

L'authentification SuperAdmin est un point ultra-sensible. Mesures obligatoires:

### Backend
- **Sessions isolees**: Cookie `admin.sid` separe, model `AdminSession` distinct
- **2FA obligatoire**: TOTP via otplib (Google Authenticator, Authy)
- **Rate limiting**: 5 tentatives / 15min sur `/api/admin/auth/*`
- **Session courte**: 30min, non renouvelable automatiquement
- **Cookie flags**: `httpOnly`, `secure` (prod), `sameSite=strict`
- **Audit**: Toutes les actions loguees dans `AdminActivityLog`

### Frontend
- **Pas de stockage sensible**: Aucun token/secret en localStorage/sessionStorage
- **Context isole**: `AdminAuthProvider` separe de `AuthProvider` user
- **Routes protegees**: Verification session via API avant affichage

### Production
- **HTTPS obligatoire**: Certificat SSL/TLS
- **Headers securite**: CSP, X-Frame-Options, X-Content-Type-Options (helmet)
- **Secrets**: Variables d'environnement, jamais dans le code

## Phase actuelle

**Phase 0.5**: SuperAdmin & Briques (en cours)
- AdminUser + 2FA TOTP
- Feature system
- CLI admin:create
- Frontend admin minimal (/admin/login, /admin/dashboard)

## Documentation detaillee

| Besoin | Fichier |
|--------|---------|
| Schema DB complet | `docs/PRISMA_SCHEMA.prisma` |
| Regles metier | `docs/BUSINESS_RULES.md` |
| Endpoints API | `docs/API_SPECIFICATION.md` |
| Roadmap dev | `docs/DEVELOPMENT_ROADMAP.md` |
| User stories | `docs/USER_STORIES.md` |
| Architecture | `docs/ARCHITECTURE.md` |

## Commandes

```bash
# Dev
npm run docker:up:build    # Demarrer tous les services
npm run admin:create       # Creer un SuperAdmin (CLI)

# Prisma
npx prisma migrate dev     # Appliquer migrations
npx prisma studio          # Interface DB (localhost:5555)
npx prisma db seed         # Seed data

# URLs
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# Prisma:   http://localhost:5555
```

## Codes erreur frequents

- `AUTH_001`: Non authentifie
- `COMMUNITY_001-006`: Erreurs communaute/role
- `RECIPE_001-002`: Erreurs recette
- `INVITE_001-003`: Erreurs invitation
- `ADMIN_001-012`: Erreurs SuperAdmin

## Git

- **Branch principale**: master
- **Branch actuelle**: Developement

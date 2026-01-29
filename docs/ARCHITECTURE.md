# Architecture Technique - Forest Manager

## Vue d'ensemble

Forest Manager suit une architecture client-serveur classique avec separation frontend/backend, containerisee avec Docker.

```
+---------------------------------------------------------------------+
|                         Client (Browser)                             |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                     Frontend (React + Vite)                          |
|                        localhost:3000                                |
|  +-------------+  +-------------+  +---------------------------+    |
|  |   Pages     |  | Components  |  |    State Management       |    |
|  +-------------+  +-------------+  +---------------------------+    |
|                          |                                          |
|                   +------+------+                                   |
|                   |  API Client |                                   |
|                   +-------------+                                   |
+---------------------------------------------------------------------+
                                |
                          HTTP/REST
                                |
+---------------------------------------------------------------------+
|                    Backend (Express + Node.js)                       |
|                        localhost:3001                                |
|  +-------------+  +-------------+  +---------------------------+    |
|  |   Routes    |->| Controllers |->|       Services            |    |
|  +-------------+  +-------------+  +---------------------------+    |
|         |                                      |                    |
|         v                                      v                    |
|  +-------------+                      +---------------------+       |
|  | Middleware  |                      |   Prisma Client     |       |
|  | (Auth, etc) |                      +---------------------+       |
|  +-------------+                               |                    |
+---------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------+
|                      PostgreSQL Database                             |
|                        localhost:5432                                |
+---------------------------------------------------------------------+
```

---

## Stack Technique

### Frontend

| Technologie | Version | Role |
|-------------|---------|------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| TailwindCSS | 3.x | Styling |
| daisyUI | 4.x | Component library |
| Axios | 1.x | HTTP client |
| React Router | 6.x | Routing |

### Backend

| Technologie | Version | Role |
|-------------|---------|------|
| Node.js | 20.x | Runtime |
| Express | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| Prisma | 6.x | ORM |
| bcrypt | 5.x | Password hashing |
| express-session | 1.x | Session management |
| **@quixo3/prisma-session-store** | 3.x | **Session store (PostgreSQL via Prisma)** |
| **otplib** | 12.x | **2FA TOTP (SuperAdmin)** |
| **qrcode** | 1.x | **Generation QR code 2FA** |

### Infrastructure

| Technologie | Role |
|-------------|------|
| PostgreSQL 16 | Base de donnees |
| Docker | Containerisation |
| Docker Compose | Orchestration locale |
| GitHub Actions | CI/CD |
| Portainer | Deploiement |

---

## Structure du projet

```
ForestManager/
├── backend/
│   ├── @types/                  # Types TypeScript personnalises
│   │   └── session.d.ts         # Extension session Express
│   ├── prisma/
│   │   ├── schema.prisma        # Schema de base de donnees
│   │   ├── migrations/          # Migrations Prisma
│   │   └── seed.js              # Donnees de seed
│   ├── src/
│   │   ├── controllers/         # Logique metier par domaine
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── communities.ts
│   │   │   ├── invites.ts       # NOUVEAU: Invitations
│   │   │   ├── members.ts       # NOUVEAU: Gestion membres
│   │   │   ├── recipes.ts
│   │   │   └── proposals.ts
│   │   ├── middleware/          # Middleware Express
│   │   │   ├── auth.ts          # Verification session
│   │   │   ├── memberOf.ts      # Verification membership
│   │   │   ├── adminOf.ts       # Verification role ADMIN
│   │   │   └── errorHandler.ts  # Gestion erreurs globale
│   │   ├── routes/              # Definition des routes
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── communities.ts
│   │   │   ├── invites.ts       # NOUVEAU
│   │   │   ├── recipes.ts
│   │   │   └── proposals.ts
│   │   ├── services/            # Services metier
│   │   │   ├── recipeService.ts
│   │   │   ├── proposalService.ts
│   │   │   ├── inviteService.ts  # NOUVEAU
│   │   │   ├── memberService.ts  # NOUVEAU
│   │   │   └── activityService.ts
│   │   ├── admin/               # MODULE SUPERADMIN (isole)
│   │   │   ├── controllers/
│   │   │   │   ├── auth.ts      # Login/logout 2FA
│   │   │   │   ├── tags.ts      # CRUD tags global
│   │   │   │   ├── ingredients.ts
│   │   │   │   ├── communities.ts
│   │   │   │   └── features.ts  # Attribution briques
│   │   │   ├── routes/
│   │   │   │   ├── index.ts     # Router /api/admin
│   │   │   │   ├── auth.ts
│   │   │   │   ├── tags.ts
│   │   │   │   ├── ingredients.ts
│   │   │   │   ├── communities.ts
│   │   │   │   └── features.ts
│   │   │   ├── middleware/
│   │   │   │   └── requireSuperAdmin.ts
│   │   │   └── services/
│   │   │       └── totpService.ts
│   │   ├── scripts/             # CLI scripts
│   │   │   └── createAdmin.ts   # npm run admin:create
│   │   ├── util/
│   │   │   ├── db.ts            # Instance Prisma
│   │   │   ├── validateEnv.ts   # Validation variables env
│   │   │   └── assertIsDefined.ts
│   │   ├── app.ts               # Configuration Express
│   │   └── server.ts            # Point d'entree
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Composants reutilisables
│   │   │   ├── common/          # Boutons, inputs, etc.
│   │   │   ├── layout/          # Header, Sidebar, Footer
│   │   │   ├── recipe/          # Composants recette
│   │   │   ├── community/       # Composants communaute
│   │   │   ├── invite/          # NOUVEAU: Composants invitation
│   │   │   └── activity/        # NOUVEAU: Composants feed
│   │   ├── pages/               # Pages/routes
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── recipes/
│   │   │   ├── communities/
│   │   │   └── invites/         # NOUVEAU
│   │   ├── hooks/               # Custom hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useRecipes.ts
│   │   │   ├── useCommunities.ts
│   │   │   ├── useInvites.ts    # NOUVEAU
│   │   │   └── useActivity.ts   # NOUVEAU
│   │   ├── context/             # React Context
│   │   │   ├── AuthContext.tsx
│   │   │   └── NotificationContext.tsx # NOUVEAU
│   │   ├── network/
│   │   │   └── api.ts           # Client API Axios
│   │   ├── models/              # Types TypeScript
│   │   ├── utils/               # Utilitaires
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                        # Documentation technique
├── docker-compose.yml           # Config developpement
├── docker-compose.prod.yml      # Config production
└── .github/workflows/           # CI/CD
```

---

## Patterns et conventions

### Backend

#### Session Store avec Prisma

Configuration de express-session avec @quixo3/prisma-session-store :

```typescript
// app.ts
import session from 'express-session';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { prisma } from './util/db';

app.use(
  session({
    cookie: {
      maxAge: 60 * 60 * 1000, // 1 heure
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,  // Nettoyage sessions expirees toutes les 2min
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);
```

#### Controllers
Les controllers recoivent la requete, valident les donnees, appellent les services et retournent la reponse.

```typescript
// controllers/recipes.ts
export const createRecipe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId;
    const data = validateRecipeInput(req.body);
    const recipe = await recipeService.create(userId, data);
    res.status(201).json(recipe);
  } catch (error) {
    next(error);
  }
};
```

#### Services
Les services contiennent la logique metier complexe.

```typescript
// services/recipeService.ts
export const create = async (userId: string, data: RecipeInput) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Creer recette personnelle
    const personalRecipe = await tx.recipe.create({...});

    // 2. Si communityId, creer copie communautaire
    if (data.communityId) {
      const communityRecipe = await tx.recipe.create({...});
      await activityService.log(tx, 'RECIPE_CREATED', {...});
    }

    return personalRecipe;
  });
};
```

#### Middleware

```typescript
// middleware/memberOf.ts
export const memberOf = (paramName: string = 'communityId') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const communityId = req.params[paramName];
    const userId = req.session.userId;

    const membership = await prisma.userCommunity.findFirst({
      where: { userId, communityId, deletedAt: null }
    });

    if (!membership) {
      throw createHttpError(403, 'Not a member of this community');
    }

    req.membership = membership;
    next();
  };
};

// middleware/adminOf.ts
export const adminOf = (paramName: string = 'communityId') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const communityId = req.params[paramName];
    const userId = req.session.userId;

    const membership = await prisma.userCommunity.findFirst({
      where: { userId, communityId, role: 'ADMIN', deletedAt: null }
    });

    if (!membership) {
      throw createHttpError(403, 'Admin access required');
    }

    req.membership = membership;
    next();
  };
};
```

#### Soft Delete Pattern

Toutes les queries doivent filtrer les entites soft-deleted :

```typescript
// Middleware Prisma recommande pour filtrage automatique
// util/db.ts
prisma.$use(async (params, next) => {
  const softDeleteModels = ['User', 'Community', 'UserCommunity', 'Recipe', 'RecipeUpdateProposal', 'CommunityInvite'];

  if (softDeleteModels.includes(params.model || '')) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    }
  }
  return next(params);
});
```

### Frontend

#### API Client
Utilisation d'Axios avec intercepteurs pour la gestion des erreurs.

```typescript
// network/api.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

#### Custom Hooks

```typescript
// hooks/useRecipes.ts
export const useRecipes = (communityId?: string) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const data = await api.getRecipes(communityId);
      setRecipes(data);
      setLoading(false);
    };
    fetch();
  }, [communityId]);

  return { recipes, loading };
};

// hooks/useInvites.ts (NOUVEAU)
export const useInvites = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = async () => {
    const data = await api.getMyInvites();
    setInvites(data.filter(i => i.status === 'PENDING'));
    setLoading(false);
  };

  const acceptInvite = async (inviteId: string) => {
    await api.acceptInvite(inviteId);
    fetchInvites();
  };

  const rejectInvite = async (inviteId: string) => {
    await api.rejectInvite(inviteId);
    fetchInvites();
  };

  useEffect(() => { fetchInvites(); }, []);

  return { invites, loading, acceptInvite, rejectInvite, pendingCount: invites.length };
};
```

---

## Gestion des erreurs

### Backend

```typescript
// Types d'erreurs personnalises
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
  }
}

// Middleware global
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});
```

### Frontend

```typescript
// Composant ErrorBoundary
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

---

## Securite

### Authentification Utilisateurs
- Sessions stockees en base de donnees (PostgreSQL via @quixo3/prisma-session-store)
- Cookie httpOnly, secure en production
- CSRF protection via SameSite=Strict
- Duree de session: 1 heure (rolling)

### Authentification SuperAdmin (Securite Renforcee)

**Isolation complete du systeme utilisateur:**

| Aspect | Users | SuperAdmin |
|--------|-------|------------|
| Model | `User` | `AdminUser` |
| Session | `Session` | `AdminSession` |
| Cookie | `connect.sid` | `admin.sid` |
| Duree | 1 heure | 30 minutes |
| Secret | `SESSION_SECRET` | `ADMIN_SESSION_SECRET` |
| 2FA | Non | **TOTP obligatoire** |

**Flux d'authentification 2FA:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PREMIERE CONNEXION                           │
├─────────────────────────────────────────────────────────────────┤
│  1. POST /api/admin/auth/login { username, password }           │
│  2. Verification credentials                                    │
│  3. totpEnabled = false → Retourne QR code + secret             │
│  4. Admin scanne avec Google Authenticator                      │
│  5. POST /api/admin/auth/totp/verify { token: "123456" }        │
│  6. totpEnabled = true, cree session                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CONNEXIONS SUIVANTES                         │
├─────────────────────────────────────────────────────────────────┤
│  1. POST /api/admin/auth/login { username, password, totpToken }│
│  2. Verification credentials + TOTP                             │
│  3. Cree AdminSession                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Configuration sessions separees:**

```typescript
// app.ts - Sessions isolees via Routers separes

import { Router } from 'express';

// Router API utilisateurs (exclu /api/admin)
const userRouter = Router();
userRouter.use(session({
  name: 'connect.sid',
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000, // 1h
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
}));

// Router API admin (completement isole)
const adminRouter = Router();
adminRouter.use(session({
  name: 'admin.sid',
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
    sessionModelName: 'AdminSession',
  }),
  secret: env.ADMIN_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 60 * 1000, // 30min
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
}));

// Montage des routers (ordre important: admin AVANT api)
app.use('/api/admin', adminRouter);
app.use('/api', userRouter);
```

**Note:** L'ordre de montage est critique. `/api/admin` doit etre monte AVANT `/api` pour eviter que le middleware user session ne s'applique aux routes admin.

**Middleware SuperAdmin:**

```typescript
// admin/middleware/requireSuperAdmin.ts
export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.adminId) {
    return next(createHttpError(401, 'Admin authentication required'));
  }
  if (!req.session.totpVerified) {
    return next(createHttpError(401, '2FA verification required'));
  }
  next();
};
```

**CLI creation admin (server-side only):**

```bash
# Execution cote serveur uniquement
npm run admin:create
# Prompt: username, email, password
# Genere totpSecret, admin cree avec totpEnabled=false
# A la premiere connexion: scan QR → activation 2FA
```

### Autorisation
- Verification de session sur toutes les routes protegees
- Verification de membership pour les ressources communautaires
- Verification de role pour les actions admin communaute
- Middleware chainable: requireAuth -> memberOf -> adminOf
- SuperAdmin: requireSuperAdmin (isole)

### Validation
- Validation des inputs cote serveur (format, longueur)
- Sanitization des donnees avant stockage
- Echappement HTML dans les reponses

### Mots de passe
- Hashage bcrypt avec salt (cost factor: 10)
- Pas de stockage en clair
- Pas de transmission en clair (HTTPS en prod)

---

## Performance

### Base de donnees
- Index sur les colonnes frequemment requetees
- Pagination sur toutes les listes
- Soft delete avec index partiel (WHERE deletedAt IS NULL)

### Caching (futur)
- Cache des tags populaires
- Cache des metadata communautes

### Frontend
- Code splitting par route
- Lazy loading des images
- Optimistic updates pour UX

---

## Deploiement

### Developpement
```bash
npm run docker:up:build
```

### Production
- Build des images via GitHub Actions
- Push vers registry prive
- Deploiement via Portainer API
- Migration automatique au demarrage

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `SESSION_SECRET` | Secret pour les sessions utilisateurs (min 32 chars) |
| `ADMIN_SESSION_SECRET` | Secret pour les sessions admin (min 32 chars, different de SESSION_SECRET) |
| `CORS_ORIGIN` | Origine autorisee CORS (ex: http://localhost:3000) |
| `NODE_ENV` | development / production |

### Configuration CORS

```typescript
// app.ts - CORS avec credentials pour cookies
import cors from 'cors';

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true, // Requis pour cookies connect.sid et admin.sid
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));
```

**Note:** `credentials: true` est obligatoire pour que les cookies de session soient envoyes cross-origin. Le frontend doit utiliser `withCredentials: true` dans Axios.

---

## Systeme de Briques (Features)

### Concept

L'application est structuree en "briques" (modules/features) attribuables aux communautes :

| Feature | Code | Default | Description |
|---------|------|---------|-------------|
| MVP | `MVP` | Oui | Catalogue recettes, communautes, partage |
| Planificateur | `MEAL_PLANNER` | Non | Planification repas hebdomadaire |
| (Futur) | `...` | Non | Autres fonctionnalites |

### Attribution

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATION COMMUNAUTE                          │
├─────────────────────────────────────────────────────────────────┤
│  1. User cree une communaute                                    │
│  2. Query: SELECT * FROM Feature WHERE isDefault = true         │
│  3. Insert: CommunityFeature (communityId, featureId, null)     │
│  4. Communaute a acces au MVP automatiquement                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ATTRIBUTION MANUELLE                         │
├─────────────────────────────────────────────────────────────────┤
│  1. SuperAdmin POST /api/admin/communities/:id/features/:fId    │
│  2. Insert: CommunityFeature (communityId, featureId, adminId)  │
│  3. Log: AdminActivityLog (FEATURE_GRANTED)                     │
│  4. Communaute a acces a la nouvelle brique                     │
└─────────────────────────────────────────────────────────────────┘
```

### Verification d'acces (futur)

```typescript
// middleware/hasFeature.ts
export const hasFeature = (featureCode: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const communityId = req.params.communityId;

    const access = await prisma.communityFeature.findFirst({
      where: {
        communityId,
        feature: { code: featureCode },
        revokedAt: null,
      }
    });

    if (!access) {
      throw createHttpError(403, `Feature ${featureCode} not available`);
    }

    next();
  };
};

// Utilisation
router.get('/meal-plan', requireAuth, memberOf(), hasFeature('MEAL_PLANNER'), getMealPlan);
```

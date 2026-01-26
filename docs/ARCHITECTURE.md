# Architecture Technique - Forest Manager

## Vue d'ensemble

Forest Manager suit une architecture client-serveur classique avec séparation frontend/backend, containerisée avec Docker.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                      │
│                        localhost:3000                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pages     │  │ Components  │  │    State Management     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                          │                                       │
│                   ┌──────┴──────┐                               │
│                   │  API Client │                               │
│                   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                          HTTP/REST
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Express + Node.js)                   │
│                        localhost:3001                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Routes    │─▶│ Controllers │─▶│       Services          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │                                      │                 │
│         ▼                                      ▼                 │
│  ┌─────────────┐                      ┌─────────────────────┐   │
│  │ Middleware  │                      │   Prisma Client     │   │
│  │ (Auth, etc) │                      └─────────────────────┘   │
│  └─────────────┘                               │                 │
└─────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
│                        localhost:5432                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack Technique

### Frontend

| Technologie | Version | Rôle |
|-------------|---------|------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| TailwindCSS | 3.x | Styling |
| daisyUI | 4.x | Component library |
| Axios | 1.x | HTTP client |
| React Router | 6.x | Routing |

### Backend

| Technologie | Version | Rôle |
|-------------|---------|------|
| Node.js | 20.x | Runtime |
| Express | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| Prisma | 6.x | ORM |
| bcrypt | 5.x | Password hashing |
| express-session | 1.x | Session management |

### Infrastructure

| Technologie | Rôle |
|-------------|------|
| PostgreSQL 16 | Base de données |
| Docker | Containerisation |
| Docker Compose | Orchestration locale |
| GitHub Actions | CI/CD |
| Portainer | Déploiement |

---

## Structure du projet

```
ForestManager/
├── backend/
│   ├── @types/                  # Types TypeScript personnalisés
│   │   └── session.d.ts         # Extension session Express
│   ├── prisma/
│   │   ├── schema.prisma        # Schéma de base de données
│   │   ├── migrations/          # Migrations Prisma
│   │   └── seed.js              # Données de seed
│   ├── src/
│   │   ├── controllers/         # Logique métier par domaine
│   │   │   ├── users.ts
│   │   │   ├── communities.ts
│   │   │   ├── recipes.ts
│   │   │   └── proposals.ts
│   │   ├── middleware/          # Middleware Express
│   │   │   ├── auth.ts          # Vérification session
│   │   │   ├── memberOf.ts      # Vérification membership
│   │   │   └── errorHandler.ts  # Gestion erreurs globale
│   │   ├── routes/              # Définition des routes
│   │   │   ├── users.ts
│   │   │   ├── communities.ts
│   │   │   ├── recipes.ts
│   │   │   └── proposals.ts
│   │   ├── services/            # Services métier (à créer)
│   │   │   ├── recipeService.ts
│   │   │   ├── proposalService.ts
│   │   │   └── activityService.ts
│   │   ├── util/
│   │   │   ├── db.ts            # Instance Prisma
│   │   │   ├── validateEnv.ts   # Validation variables env
│   │   │   └── assertIsDefined.ts
│   │   ├── app.ts               # Configuration Express
│   │   └── server.ts            # Point d'entrée
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Composants réutilisables
│   │   │   ├── common/          # Boutons, inputs, etc.
│   │   │   ├── layout/          # Header, Sidebar, Footer
│   │   │   ├── recipe/          # Composants recette
│   │   │   └── community/       # Composants communauté
│   │   ├── pages/               # Pages/routes
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── recipes/
│   │   │   └── communities/
│   │   ├── hooks/               # Custom hooks
│   │   ├── context/             # React Context (auth, etc.)
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
├── docker-compose.yml           # Config développement
├── docker-compose.prod.yml      # Config production
└── .github/workflows/           # CI/CD
```

---

## Patterns et conventions

### Backend

#### Controllers
Les controllers reçoivent la requête, valident les données, appellent les services et retournent la réponse.

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
Les services contiennent la logique métier complexe.

```typescript
// services/recipeService.ts
export const create = async (userId: string, data: RecipeInput) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Créer recette personnelle
    const personalRecipe = await tx.recipe.create({...});

    // 2. Si communityId, créer copie communautaire
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
```

---

## Gestion des erreurs

### Backend

```typescript
// Types d'erreurs personnalisés
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

## Sécurité

### Authentification
- Sessions stockées en base de données (PostgreSQL)
- Cookie httpOnly, secure en production
- CSRF protection via SameSite=Strict

### Autorisation
- Vérification de session sur toutes les routes protégées
- Vérification de membership pour les ressources communautaires
- Vérification de rôle pour les actions admin

### Validation
- Validation des inputs côté serveur (format, longueur)
- Sanitization des données avant stockage
- Échappement HTML dans les réponses

### Mots de passe
- Hashage bcrypt avec salt (cost factor: 10)
- Pas de stockage en clair
- Pas de transmission en clair (HTTPS en prod)

---

## Performance

### Base de données
- Index sur les colonnes fréquemment requêtées
- Pagination sur toutes les listes
- Soft delete avec index partiel

### Caching (futur)
- Cache des tags populaires
- Cache des metadata communautés

### Frontend
- Code splitting par route
- Lazy loading des images
- Optimistic updates pour UX

---

## Déploiement

### Développement
```bash
npm run docker:up:build
```

### Production
- Build des images via GitHub Actions
- Push vers registry privé
- Déploiement via Portainer API
- Migration automatique au démarrage

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `SESSION_SECRET` | Secret pour les sessions |
| `CORS_ORIGIN` | Origine autorisée CORS |
| `NODE_ENV` | development / production |

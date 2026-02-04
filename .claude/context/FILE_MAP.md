# File Map - Arborescence source

## Backend (backend/src/)

### Controllers (logique metier)
```
controllers/
├── auth.ts            # signup, login, logout, me
├── communities.ts     # CRUD communautes
├── communityRecipes.ts # create, list recettes communautaires
├── members.ts         # list, promote, kick/leave membres
├── invites.ts         # create, list, cancel, accept, reject invitations
├── recipes.ts         # CRUD recettes (perso + communautaires via detail/update/delete)
├── tags.ts            # autocomplete tags
├── ingredients.ts     # autocomplete ingredients
└── users.ts           # search users, update profile
```

### Routes (endpoints API)
```
routes/
├── auth.ts            # /api/auth/*
├── communities.ts     # /api/communities/* (incl. members, invites)
├── invites.ts         # /api/invites/:id/accept|reject
├── recipes.ts         # /api/recipes/*
├── tags.ts            # /api/tags
├── ingredients.ts     # /api/ingredients
└── users.ts           # /api/users/search, /api/users/me, /api/users/me/invites
```

### Middleware
```
middleware/
├── auth.ts            # requireAuth (verifie session.userId)
├── community.ts       # memberOf, requireCommunityRole
└── security.ts        # helmet, CORS, rate limiting
```

### Admin (module isole)
```
admin/
├── controllers/
│   ├── authController.ts         # login 2FA, TOTP verify, logout, me
│   ├── communitiesController.ts  # list, detail, update, delete, grant/revoke feature
│   ├── membersController.ts      # admin member management
│   ├── tagsController.ts         # CRUD + merge tags
│   ├── ingredientsController.ts  # CRUD + merge ingredients
│   ├── featuresController.ts     # CRUD features
│   ├── dashboardController.ts    # stats globales
│   └── activityController.ts     # logs activite admin
├── routes/
│   ├── authRoutes.ts
│   ├── communitiesRoutes.ts
│   ├── tagsRoutes.ts
│   ├── ingredientsRoutes.ts
│   ├── featuresRoutes.ts
│   ├── dashboardRoutes.ts
│   └── activityRoutes.ts
└── middleware/
    └── requireSuperAdmin.ts      # verifie adminId + totpVerified
```

### Autres backend
```
app.ts                 # Config Express, montage routes, sessions
server.ts              # Entry point (listen)
types/
├── express.d.ts       # Extension types Express
└── session.d.ts       # Types session
util/                  # Utilitaires
scripts/
└── createAdmin.ts     # CLI creation SuperAdmin
```

### Tests backend
```
__tests__/
├── setup/
│   ├── globalSetup.ts    # Setup DB test
│   └── testHelpers.ts    # createTestUser, cleanupTestData, etc.
└── integration/
    ├── auth.test.ts
    ├── recipes.test.ts
    ├── tags.test.ts
    ├── ingredients.test.ts
    ├── communities.test.ts
    ├── communityRecipes.test.ts
    ├── invitations.test.ts
    ├── members.test.ts
    ├── adminAuth.test.ts
    ├── adminTags.test.ts
    ├── adminIngredients.test.ts
    ├── adminFeatures.test.ts
    ├── adminCommunities.test.ts
    ├── adminDashboard.test.ts
    └── adminActivity.test.ts
```

---

## Frontend (frontend/src/)

### Pages
```
pages/
├── HomePage.tsx              # Accueil (redirect vers dashboard si connecte)
├── DashboardPage.tsx         # Dashboard (communautes + recettes)
├── RecipesPage.tsx           # Liste recettes
├── RecipeDetailPage.tsx      # Detail recette
├── RecipeFormPage.tsx        # Creation/edition recette
├── CommunitiesPage.tsx       # Liste communautes user
├── CommunityCreatePage.tsx   # Creation communaute
├── CommunityDetailPage.tsx   # Detail communaute (onglets)
├── CommunityEditPage.tsx     # Edition communaute (MODERATOR)
├── InvitationsPage.tsx       # Invitations recues
├── ProfilePage.tsx           # Profil utilisateur (edit username/email/password)
├── SignUpPage.tsx            # Inscription
├── PrivacyPage.tsx           # Politique confidentialite
├── NotFoundPage.tsx          # 404
└── admin/
    ├── AdminLoginPage.tsx    # Login admin 2FA
    └── AdminDashboardPage.tsx # Dashboard admin
```

### Components
```
components/
├── Layout/
│   ├── MainLayout.tsx        # Layout principal (sidebar + content)
│   └── Sidebar.tsx           # Sidebar navigation communautes
├── Navbar/
│   ├── NavBar.tsx            # Barre navigation
│   ├── NotificationDropdown.tsx # Dropdown notifications (invitations)
│   ├── NavBarLoggedInView/   # Nav connecte (icone user + dropdown menu)
│   └── NavBarLoggedOutView/  # Nav deconnecte
├── communities/
│   ├── CommunityCard.tsx     # Carte communaute (grille)
│   ├── CommunityRecipesList.tsx # Liste recettes communaute (filtres, pagination, permissions)
│   └── MembersList.tsx       # Liste membres (promote, kick, leave)
├── invitations/
│   ├── InviteCard.tsx        # Carte invitation recue (accept/reject)
│   ├── InviteUserModal.tsx   # Modal inviter un utilisateur
│   ├── SentInvitesList.tsx   # Liste invitations envoyees
│   └── InvitationBadge.tsx   # Badge compteur invitations PENDING
├── recipes/
│   ├── RecipeCard.tsx        # Carte recette (grille)
│   ├── RecipeFilters.tsx     # Filtres search/tags
│   └── RecipeListRow.tsx     # Ligne recette (liste)
├── form/
│   ├── TagSelector.tsx       # Multi-select tags (debounce, create on-the-fly)
│   ├── IngredientSelector.tsx # Selecteur ingredients
│   └── IngredientList.tsx    # Liste ingredients dynamique
├── admin/
│   ├── AdminLayout.tsx       # Layout admin
│   └── AdminProtectedRoute.tsx # Guard admin
├── AddEditRecipeDialog.tsx   # Dialog creation/edition
├── LoginModal.tsx            # Modal login
├── Modal.tsx                 # Composant modal generique
├── ProtectedRoute.tsx        # Guard user
└── Recipe.tsx                # Affichage recette
```

### Contexts & Network
```
contexts/
├── AuthContext.tsx            # Auth user (session, login/logout)
└── AdminAuthContext.tsx       # Auth admin (isole, 2FA)

network/
└── api.ts                    # Client Axios, fonctions API
```

### Models & Types
```
models/
├── user.ts                   # User types
├── recipe.ts                 # Recipe, Tag, Ingredient types
├── tag.ts                    # Tag types
├── community.ts              # Community, Member, Invite types
└── admin.ts                  # AdminUser types
```

### Autres frontend
```
App.tsx                       # Routes React Router
main.tsx                      # Entry point React
hooks/                        # Custom hooks
utils/                        # Utilitaires
errors/                       # Classes erreur
assets/                       # Assets statiques
styles/                       # CSS
```

### Tests frontend
```
__tests__/
├── setup/
│   ├── vitestSetup.ts        # Setup Testing Library
│   ├── mswHandlers.ts        # MSW mock handlers
│   └── testUtils.tsx         # Render utils avec providers
└── unit/
    ├── AuthContext.test.tsx
    ├── AdminAuthContext.test.tsx
    ├── LoginModal.test.tsx
    ├── Modal.test.tsx
    ├── SignUpPage.test.tsx
    ├── ProtectedRoute.test.tsx
    ├── NavBar.test.tsx
    ├── AdminProtectedRoute.test.tsx
    ├── AdminLoginPage.test.tsx
    ├── AdminDashboardPage.test.tsx
    ├── AdminLayout.test.tsx
    ├── RecipeCard.test.tsx
    ├── RecipeFilters.test.tsx
    ├── TagSelector.test.tsx
    ├── IngredientList.test.tsx
    ├── RecipesPage.test.tsx
    ├── MainLayout.test.tsx
    ├── Sidebar.test.tsx
    ├── HomePage.test.tsx
    ├── pages/
    │   ├── CommunitiesPage.test.tsx
    │   └── CommunityDetailPage.test.tsx
    └── components/
        ├── InviteCard.test.tsx
        ├── MembersList.test.tsx
        └── InviteUserModal.test.tsx
```

---

## Configuration racine

```
docker-compose.yml            # Dev (postgres, backend:3001, frontend:3000)
docker-compose.test.yml       # DB test (postgres:5433, tmpfs)
docker-compose.prod.yml       # Production
docker-compose.preprod.yml    # Pre-production
.github/workflows/deploy.yml  # CI/CD (test → build → deploy)
.env.example                  # Variables d'environnement
package.json                  # Scripts racine (docker, test)
```

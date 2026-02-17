# File Map - Arborescence source

## Backend (backend/src/)

### Controllers (logique metier)
```
controllers/
├── activity.ts        # getCommunityActivity, getMyActivity
├── auth.ts            # signup, login, logout, me
├── communities.ts     # CRUD communautes
├── communityRecipes.ts # create, list recettes communautaires
├── communityTags.ts   # CRUD + approve/reject tags communaute (moderateur)
├── members.ts         # list, promote, kick/leave membres
├── invites.ts         # create, list, cancel, accept, reject invitations
├── proposals.ts       # create, list, detail, accept, reject propositions
├── recipes.ts         # CRUD recettes personnelles (get, create, update, delete)
├── recipeVariants.ts  # getVariants (liste variantes d'une recette)
├── recipeShare.ts     # shareRecipe, publishToCommunities, getRecipeCommunities
├── tagPreferences.ts  # tag visibility & moderator notification prefs (5 handlers)
├── tagSuggestions.ts  # create, accept, reject tag suggestions
├── tags.ts            # autocomplete tags (scope-aware)
├── ingredients.ts     # autocomplete ingredients
└── users.ts           # search users, update profile
```

### Routes (endpoints API)
```
routes/
├── auth.ts            # /api/auth/*
├── communities.ts     # /api/communities/* (incl. members, invites)
├── invites.ts         # /api/invites/:id/accept|reject
├── proposals.ts       # /api/proposals/:id, /api/proposals/:id/accept|reject
├── recipes.ts         # /api/recipes/* (incl. /api/recipes/:id/proposals)
├── tagSuggestions.ts  # /api/tag-suggestions/*
├── tags.ts            # /api/tags
├── ingredients.ts     # /api/ingredients
└── users.ts           # /api/users/* (incl. tag-preferences, notification-preferences)
```

### Middleware
```
middleware/
├── auth.ts            # requireAuth (verifie session.userId)
├── community.ts       # memberOf, requireCommunityRole
├── httpLogger.ts      # pino-http middleware (remplace morgan)
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

### Services
```
services/
├── tagService.ts      # Logique scope-aware tags (resolve, autocomplete, fork)
├── recipeService.ts   # upsertTags, upsertIngredients, createRecipe, updateRecipe
├── communityRecipeService.ts # createCommunityRecipe (perso + comm)
├── shareService.ts    # forkRecipe, publishRecipe, getRecipeFamilyCommunities
├── membershipService.ts # requireRecipeAccess, requireRecipeOwnership
├── orphanHandling.ts  # Gestion recettes orphelines (auto-reject proposals)
├── notificationService.ts  # getModeratorIdsForTagNotification (filtre par prefs)
├── tagSuggestionService.ts # create, accept, reject tag suggestions
├── eventEmitter.ts    # AppEventEmitter singleton (emit activity events)
└── socketServer.ts    # Socket.IO server init, auth middleware, room management
```

### Autres backend
```
app.ts                 # Config Express, montage routes, sessions
server.ts              # Entry point (listen)
types/
├── express.d.ts       # Extension types Express
└── session.d.ts       # Types session
util/
├── logger.ts          # Logger Pino central (silent test, pretty dev, JSON prod)
├── pagination.ts      # parsePagination, buildPaginationMeta
├── validation.ts      # normalizeNames, isValidHttpUrl, regex constants
├── responseFormatters.ts # formatTags, formatIngredients
├── db.ts              # Prisma client singleton
└── validateEnv.ts     # envalid env vars
scripts/
└── createAdmin.ts     # CLI creation SuperAdmin
```

### Tests backend
```
__tests__/
├── setup/
│   ├── globalSetup.ts    # Setup DB test
│   └── testHelpers.ts    # createTestUser, cleanupTestData, etc.
├── unit/
│   ├── eventEmitter.test.ts       # Event emitter unit tests
│   ├── pagination.test.ts         # Pagination utils
│   ├── validation.test.ts         # Validation utils & constants
│   ├── responseFormatters.test.ts # Response formatters
│   └── middleware/
│       ├── auth.test.ts           # requireAuth
│       ├── requireSuperAdmin.test.ts # requireSuperAdmin, requireAdminSession
│       └── security.test.ts       # requireHttps, rate limiters
└── integration/
    ├── websocket.test.ts
    ├── activity.test.ts
    ├── auth.test.ts
    ├── recipes.test.ts
    ├── tags.test.ts
    ├── ingredients.test.ts
    ├── communities.test.ts
    ├── communityRecipes.test.ts
    ├── communityTags.test.ts
    ├── invitations.test.ts
    ├── members.test.ts
    ├── adminAuth.test.ts
    ├── adminTags.test.ts
    ├── adminIngredients.test.ts
    ├── adminFeatures.test.ts
    ├── adminCommunities.test.ts
    ├── adminDashboard.test.ts
    ├── adminActivity.test.ts
    ├── proposals.test.ts
    ├── share.test.ts
    └── variants.test.ts
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
├── CommunityDetailPage.tsx   # Detail communaute (icones + side panel)
├── CommunityEditPage.tsx     # Edition communaute (fallback route, edit inline via SidePanel)
├── InvitationsPage.tsx       # Invitations recues
├── ProfilePage.tsx           # Profil utilisateur (edit username/email/password)
├── SignUpPage.tsx            # Inscription
├── PrivacyPage.tsx           # Politique confidentialite
├── NotFoundPage.tsx          # 404
└── admin/
    ├── AdminLoginPage.tsx         # Login admin 2FA
    ├── AdminDashboardPage.tsx     # Dashboard admin (stats)
    ├── AdminTagsPage.tsx          # CRUD + merge tags
    ├── AdminIngredientsPage.tsx   # CRUD + merge ingredients
    ├── AdminFeaturesPage.tsx      # CRUD features (code, name, isDefault)
    ├── AdminCommunitiesPage.tsx   # Liste, detail, delete, grant/revoke features
    └── AdminActivityPage.tsx      # Logs activite admin paginee
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
│   ├── CommunityTagsList.tsx # Gestion tags communaute moderateur (CRUD, approve/reject)
│   ├── MembersList.tsx       # Liste membres (promote, kick, leave)
│   └── SidePanel.tsx         # Volet lateral redimensionnable (members/activity/invitations/tags)
├── invitations/
│   ├── InviteCard.tsx        # Carte invitation recue (accept/reject)
│   ├── InviteUserModal.tsx   # Modal inviter un utilisateur
│   ├── SentInvitesList.tsx   # Liste invitations envoyees
│   └── InvitationBadge.tsx   # Badge compteur invitations PENDING
├── activity/
│   ├── index.ts              # Exports
│   └── ActivityFeed.tsx      # Feed activite (community + personal)
├── proposals/
│   ├── index.ts              # Exports
│   ├── ProposeModificationModal.tsx # Modal proposer modifications
│   ├── ProposalsList.tsx     # Liste propositions (owner view)
│   └── VariantsDropdown.tsx  # Dropdown variantes recette
├── share/
│   ├── index.ts              # Exports
│   ├── ShareRecipeModal.tsx  # Modal partage recette inter-communautes (checkboxes multi-select)
│   └── SharePersonalRecipeModal.tsx # Modal publier recette perso vers communautes
├── recipes/
│   ├── RecipeCard.tsx        # Carte recette (grille)
│   ├── RecipeFilters.tsx     # Filtres search/tags (scope-aware via communityId)
│   ├── RecipeListRow.tsx     # Ligne recette (liste)
│   ├── SuggestTagModal.tsx   # Modal suggestion de tag sur recette d'autrui
│   ├── TagBadge.tsx          # Badge tag avec style pending/approved
│   └── TagSuggestionsList.tsx # Liste suggestions de tags (owner view, accept/reject)
├── form/
│   ├── TagSelector.tsx       # Multi-select tags (debounce, create on-the-fly)
│   ├── IngredientSelector.tsx # Selecteur ingredients
│   └── IngredientList.tsx    # Liste ingredients dynamique
├── admin/
│   ├── AdminLayout.tsx       # Layout admin (sidebar + header + outlet)
│   └── AdminProtectedRoute.tsx # Guard admin
├── AddEditRecipeDialog.tsx   # Dialog creation/edition
├── ErrorBoundary.tsx         # Error boundary React (crash → fallback UI)
├── LoginModal.tsx            # Modal login
├── Modal.tsx                 # Composant modal generique
├── ProtectedRoute.tsx        # Guard user
└── Recipe.tsx                # Affichage recette
```

### Contexts & Network
```
contexts/
├── AuthContext.tsx            # Auth user (session, login/logout)
├── AdminAuthContext.tsx       # Auth admin (isole, 2FA)
├── ThemeContext.tsx           # Theme (forest/winter), localStorage, system pref
└── SocketContext.tsx          # Socket.IO client, auto-connect/disconnect

network/
└── api.ts                    # Client Axios, fonctions API
```

### Models & Types
```
models/
├── user.ts                   # User types
├── recipe.ts                 # Recipe, Tag, Ingredient types
├── tag.ts                    # Tag types
├── tagSuggestion.ts          # TagSuggestion types
├── community.ts              # Community, Member, Invite types
└── admin.ts                  # AdminUser types
```

### Autres frontend
```
App.tsx                       # Routes React Router
main.tsx                      # Entry point React
hooks/
├── useClickOutside.ts        # Detect clicks outside a ref element
├── useDebouncedEffect.ts     # Effect with configurable delay
├── useConfirm.tsx            # Confirmation dialog hook (promise-based)
├── usePaginatedList.ts       # Generic paginated list with loadMore
├── useRecipeActions.ts       # Recipe CRUD actions
├── useSocketEvent.ts         # Subscribe/unsubscribe to socket events
├── useCommunityRoom.ts       # Join/leave community socket room
└── useNotificationToasts.ts  # Toast notifications from socket events
utils/
├── format.Date.ts            # formatDate, formatDateShort
└── communityEvents.ts        # Event bus for community refresh
errors/                       # Classes erreur
assets/                       # Assets statiques
styles/                       # CSS
```

### Tests frontend
```
__tests__/
├── setup/
│   ├── vitestSetup.ts        # Setup Testing Library + MSW
│   ├── mswServer.ts          # MSW server instance
│   ├── mswHandlers.ts        # MSW mock handlers
│   └── testUtils.tsx         # Render utils avec providers
└── unit/
    ├── contexts/
    │   ├── AuthContext.test.tsx
    │   ├── AdminAuthContext.test.tsx
    │   ├── ThemeContext.test.tsx
    │   └── SocketContext.test.tsx
    ├── hooks/
    │   ├── useClickOutside.test.ts
    │   ├── useDebouncedEffect.test.ts
    │   ├── useConfirm.test.tsx
    │   ├── useSocketEvent.test.ts
    │   ├── useCommunityRoom.test.ts
    │   ├── useNotificationToasts.test.ts
    │   └── usePaginatedList.test.ts
    ├── utils/
    │   ├── formatDate.test.ts
    │   └── communityEvents.test.ts
    ├── pages/
    │   ├── CommunitiesPage.test.tsx
    │   ├── CommunityDetailPage.test.tsx
    │   ├── DashboardPage.test.tsx
    │   ├── HomePage.test.tsx
    │   ├── NotFoundPage.test.tsx
    │   ├── ProfilePage.test.tsx
    │   ├── RecipesPage.test.tsx
    │   ├── RecipeFormPage.test.tsx
    │   ├── SignUpPage.test.tsx
    │   └── admin/
    │       ├── AdminLoginPage.test.tsx
    │       ├── AdminDashboardPage.test.tsx
    │       ├── AdminTagsPage.test.tsx
    │       ├── AdminIngredientsPage.test.tsx
    │       ├── AdminFeaturesPage.test.tsx
    │       ├── AdminCommunitiesPage.test.tsx
    │       └── AdminActivityPage.test.tsx
    └── components/
        ├── communities/
        │   └── CommunityTagsList.test.tsx
        ├── Layout/
        │   ├── MainLayout.test.tsx
        │   └── Sidebar.test.tsx
        ├── admin/
        │   ├── AdminLayout.test.tsx
        │   └── AdminProtectedRoute.test.tsx
        ├── recipes/
        │   ├── RecipeCard.test.tsx
        │   ├── RecipeFilters.test.tsx
        │   ├── SuggestTagModal.test.tsx
        │   ├── TagBadge.test.tsx
        │   └── TagSuggestionsList.test.tsx
        ├── form/
        │   ├── TagSelector.test.tsx
        │   └── IngredientList.test.tsx
        ├── ActivityFeed.test.tsx
        ├── ErrorBoundary.test.tsx
        ├── InviteCard.test.tsx
        ├── InviteUserModal.test.tsx
        ├── LoginModal.test.tsx
        ├── MembersList.test.tsx
        ├── Modal.test.tsx
        ├── NavBar.test.tsx
        ├── ProtectedRoute.test.tsx
        └── ShareRecipeModal.test.tsx
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

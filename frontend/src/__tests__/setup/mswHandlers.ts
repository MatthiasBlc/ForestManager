import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3001';

// Donnees mock
export const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
};

export const mockAdmin = {
  id: 'test-admin-id',
  username: 'testadmin',
  email: 'admin@example.com',
};

export const mockRecipe = {
  id: 'test-recipe-id',
  title: 'Test Recipe',
  content: 'Test recipe content',
  imageUrl: null,
  creatorId: 'test-user-id',
  creator: { id: 'test-user-id', username: 'testuser' },
  tags: [{ id: 'tag-1', name: 'dessert' }],
  ingredients: [{ id: 'ing-1', name: 'sugar', quantity: '100g', order: 0 }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockRecipes = [mockRecipe];

// Mock admin data
export const mockTags = [
  { id: 'tag-1', name: 'dessert', recipeCount: 5 },
  { id: 'tag-2', name: 'dinner', recipeCount: 3 },
  { id: 'tag-3', name: 'breakfast', recipeCount: 2 },
];

export const mockIngredients = [
  { id: 'ing-1', name: 'sugar', recipeCount: 10 },
  { id: 'ing-2', name: 'flour', recipeCount: 8 },
  { id: 'ing-3', name: 'butter', recipeCount: 5 },
];

export const mockFeatures = [
  { id: 'feat-1', code: 'MVP', name: 'MVP Feature', description: 'Default feature', isDefault: true, communityCount: 3 },
  { id: 'feat-2', code: 'PREMIUM', name: 'Premium Feature', description: 'Premium only', isDefault: false, communityCount: 1 },
];

export const mockCommunities = [
  {
    id: 'com-1',
    name: 'Test Community',
    description: 'A test community',
    visibility: 'PRIVATE',
    memberCount: 5,
    recipeCount: 10,
    features: ['MVP'],
    createdAt: new Date().toISOString(),
    deletedAt: null,
  },
];

export const mockActivities = [
  {
    id: 'act-1',
    type: 'TAG_CREATED',
    targetType: 'Tag',
    targetId: 'tag-1',
    metadata: { name: 'dessert' },
    createdAt: new Date().toISOString(),
    admin: mockAdmin,
  },
];

// Mock community data for user-side endpoints
export const mockUserCommunities = [
  {
    id: 'community-1',
    name: 'Baking Club',
    description: 'A community for baking enthusiasts',
    role: 'MODERATOR' as const,
    membersCount: 5,
    recipesCount: 10,
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'community-2',
    name: 'Vegan Recipes',
    description: 'Plant-based recipes',
    role: 'MEMBER' as const,
    membersCount: 12,
    recipesCount: 25,
    joinedAt: new Date().toISOString(),
  },
];

export const mockCommunityDetail = {
  id: 'community-1',
  name: 'Baking Club',
  description: 'A community for baking enthusiasts',
  visibility: 'PRIVATE',
  createdAt: new Date().toISOString(),
  membersCount: 3,
  recipesCount: 10,
  currentUserRole: 'MODERATOR' as const,
};

export const mockMembers = [
  { id: 'test-user-id', username: 'testuser', role: 'MODERATOR' as const, joinedAt: new Date().toISOString() },
  { id: 'user-2', username: 'alice', role: 'MEMBER' as const, joinedAt: new Date().toISOString() },
  { id: 'user-3', username: 'bob', role: 'MEMBER' as const, joinedAt: new Date().toISOString() },
];

export const mockCommunityInvites = [
  {
    id: 'invite-1',
    status: 'PENDING' as const,
    createdAt: new Date().toISOString(),
    respondedAt: null,
    invitee: { id: 'user-4', username: 'charlie', email: 'charlie@example.com' },
    inviter: { id: 'test-user-id', username: 'testuser' },
  },
];

export const mockReceivedInvites = [
  {
    id: 'recv-invite-1',
    status: 'PENDING' as const,
    createdAt: new Date().toISOString(),
    respondedAt: null,
    community: { id: 'community-3', name: 'Italian Cooking', description: 'Best pasta recipes' },
    inviter: { id: 'user-5', username: 'david' },
  },
];

// Mock user activity feed data
export const mockUserActivityFeed = [
  {
    id: 'activity-1',
    type: 'RECIPE_CREATED' as const,
    metadata: null,
    createdAt: new Date().toISOString(),
    user: { id: 'test-user-id', username: 'testuser' },
    recipe: { id: 'test-recipe-id', title: 'Test Recipe', isDeleted: false },
    community: { id: 'community-1', name: 'Baking Club', isDeleted: false },
  },
  {
    id: 'activity-2',
    type: 'VARIANT_PROPOSED' as const,
    metadata: null,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    user: { id: 'user-2', username: 'alice' },
    recipe: { id: 'test-recipe-id', title: 'Test Recipe', isDeleted: false },
    community: { id: 'community-1', name: 'Baking Club', isDeleted: false },
  },
  {
    id: 'activity-3',
    type: 'USER_JOINED' as const,
    metadata: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    user: { id: 'user-3', username: 'bob' },
    recipe: null,
    community: { id: 'community-1', name: 'Baking Club', isDeleted: false },
  },
];

// Etat mock pour simuler l'authentification
let isUserAuthenticated = false;
let isAdminAuthenticated = false;
let isAdminTotpPending = false;

// Helpers pour controler l'etat dans les tests
export function setUserAuthenticated(value: boolean) {
  isUserAuthenticated = value;
}

export function setAdminAuthenticated(value: boolean) {
  isAdminAuthenticated = value;
}

export function setAdminTotpPending(value: boolean) {
  isAdminTotpPending = value;
}

export function resetAuthState() {
  isUserAuthenticated = false;
  isAdminAuthenticated = false;
  isAdminTotpPending = false;
}

// Handlers MSW
export const handlers = [
  // =====================================
  // Auth User
  // =====================================

  // GET /api/auth/me
  http.get(`${API_URL}/api/auth/me`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ user: mockUser });
  }),

  // POST /api/auth/signup
  http.post(`${API_URL}/api/auth/signup`, async ({ request }) => {
    const body = await request.json() as Record<string, string>;

    if (!body.username || !body.email || !body.password) {
      return HttpResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { error: 'AUTH_002: Email already exists' },
        { status: 409 }
      );
    }

    isUserAuthenticated = true;
    return HttpResponse.json(
      { user: { ...mockUser, username: body.username, email: body.email } },
      { status: 201 }
    );
  }),

  // POST /api/auth/login
  http.post(`${API_URL}/api/auth/login`, async ({ request }) => {
    const body = await request.json() as Record<string, string>;

    if (body.username === 'testuser' && body.password === 'Test123!') {
      isUserAuthenticated = true;
      return HttpResponse.json({ user: mockUser });
    }

    return HttpResponse.json(
      { error: 'AUTH_008: Invalid credentials' },
      { status: 401 }
    );
  }),

  // POST /api/auth/logout
  http.post(`${API_URL}/api/auth/logout`, () => {
    isUserAuthenticated = false;
    return HttpResponse.json({ message: 'Logged out' });
  }),

  // =====================================
  // Admin Auth
  // =====================================

  // GET /api/admin/auth/me
  http.get(`${API_URL}/api/admin/auth/me`, () => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ admin: mockAdmin });
  }),

  // POST /api/admin/auth/login
  http.post(`${API_URL}/api/admin/auth/login`, async ({ request }) => {
    const body = await request.json() as Record<string, string>;

    if (body.email === 'admin@example.com' && body.password === 'AdminTest123!') {
      isAdminTotpPending = true;
      return HttpResponse.json({
        message: 'TOTP verification required',
        requiresTotpSetup: false,
        // Pas de qrCode car TOTP deja configure
      });
    }

    if (body.email === 'newadmin@example.com' && body.password === 'AdminTest123!') {
      isAdminTotpPending = true;
      return HttpResponse.json({
        message: 'TOTP setup required',
        requiresTotpSetup: true,
        qrCode: 'data:image/png;base64,mockQrCode',
      });
    }

    return HttpResponse.json(
      { error: 'ADMIN_003: Invalid credentials' },
      { status: 401 }
    );
  }),

  // POST /api/admin/auth/totp/verify
  http.post(`${API_URL}/api/admin/auth/totp/verify`, async ({ request }) => {
    if (!isAdminTotpPending) {
      return HttpResponse.json(
        { error: 'ADMIN_005: No pending TOTP verification' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, string>;

    if (body.code === '123456') {
      isAdminTotpPending = false;
      isAdminAuthenticated = true;
      return HttpResponse.json({
        message: 'TOTP verified',
        admin: mockAdmin,
      });
    }

    return HttpResponse.json(
      { error: 'ADMIN_006: Invalid TOTP code' },
      { status: 401 }
    );
  }),

  // POST /api/admin/auth/logout
  http.post(`${API_URL}/api/admin/auth/logout`, () => {
    isAdminAuthenticated = false;
    isAdminTotpPending = false;
    return HttpResponse.json({ message: 'Admin logged out' });
  }),

  // =====================================
  // Recipes
  // =====================================

  // GET /api/recipes
  http.get(`${API_URL}/api/recipes`, ({ request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let filteredRecipes = [...mockRecipes];

    if (search) {
      filteredRecipes = filteredRecipes.filter(r =>
        r.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    return HttpResponse.json({
      data: filteredRecipes.slice(0, limit),
      pagination: {
        total: filteredRecipes.length,
        limit,
        offset: 0,
        hasMore: filteredRecipes.length > limit,
      },
    });
  }),

  // GET /api/recipes/:id
  http.get(`${API_URL}/api/recipes/:id`, ({ params }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const recipe = mockRecipes.find(r => r.id === params.id);

    if (!recipe) {
      return HttpResponse.json(
        { error: 'RECIPE_001: Recipe not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json(recipe);
  }),

  // POST /api/recipes
  http.post(`${API_URL}/api/recipes`, async ({ request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, unknown>;

    if (!body.title) {
      return HttpResponse.json(
        { error: 'RECIPE_003: Title is required' },
        { status: 400 }
      );
    }

    if (!body.content) {
      return HttpResponse.json(
        { error: 'RECIPE_004: Content is required' },
        { status: 400 }
      );
    }

    const newRecipe = {
      ...mockRecipe,
      id: `recipe-${Date.now()}`,
      title: body.title as string,
      content: body.content as string,
    };

    return HttpResponse.json(newRecipe, { status: 201 });
  }),

  // PATCH /api/recipes/:id
  http.patch(`${API_URL}/api/recipes/:id`, async ({ params, request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const recipe = mockRecipes.find(r => r.id === params.id);

    if (!recipe) {
      return HttpResponse.json(
        { error: 'RECIPE_001: Recipe not found' },
        { status: 404 }
      );
    }

    const body = await request.json() as Record<string, unknown>;

    return HttpResponse.json({
      ...recipe,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  // DELETE /api/recipes/:id
  http.delete(`${API_URL}/api/recipes/:id`, ({ params }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const recipe = mockRecipes.find(r => r.id === params.id);

    if (!recipe) {
      return HttpResponse.json(
        { error: 'RECIPE_001: Recipe not found' },
        { status: 404 }
      );
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // =====================================
  // Tags
  // =====================================

  http.get(`${API_URL}/api/tags`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      data: [
        { id: 'tag-1', name: 'dessert', recipeCount: 5 },
        { id: 'tag-2', name: 'dinner', recipeCount: 3 },
      ],
    });
  }),

  // =====================================
  // Ingredients
  // =====================================

  http.get(`${API_URL}/api/ingredients`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      data: [
        { id: 'ing-1', name: 'sugar', recipeCount: 10 },
        { id: 'ing-2', name: 'flour', recipeCount: 8 },
      ],
    });
  }),

  // =====================================
  // Admin Dashboard
  // =====================================

  http.get(`${API_URL}/api/admin/dashboard/stats`, () => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      totals: {
        users: 100,
        communities: 10,
        recipes: 500,
        tags: 50,
        ingredients: 200,
        features: 5,
      },
      lastWeek: {
        newUsers: 5,
        newCommunities: 1,
        newRecipes: 20,
      },
      topCommunities: [
        { id: 'com-1', name: 'Test Community', memberCount: 5, recipeCount: 10 },
      ],
    });
  }),

  // =====================================
  // Admin Tags
  // =====================================

  http.get(`${API_URL}/api/admin/tags`, ({ request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    let filteredTags = [...mockTags];
    if (search) {
      filteredTags = filteredTags.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return HttpResponse.json({ tags: filteredTags });
  }),

  http.post(`${API_URL}/api/admin/tags`, async ({ request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, string>;

    if (!body.name) {
      return HttpResponse.json(
        { error: 'ADMIN_TAG_001: Name is required' },
        { status: 400 }
      );
    }

    const newTag = {
      id: `tag-${Date.now()}`,
      name: body.name.toLowerCase().trim(),
      recipeCount: 0,
    };

    return HttpResponse.json({ tag: newTag }, { status: 201 });
  }),

  http.patch(`${API_URL}/api/admin/tags/:id`, async ({ params, request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const tag = mockTags.find(t => t.id === params.id);
    if (!tag) {
      return HttpResponse.json(
        { error: 'ADMIN_TAG_003: Tag not found' },
        { status: 404 }
      );
    }

    const body = await request.json() as Record<string, string>;

    return HttpResponse.json({
      tag: { ...tag, name: body.name?.toLowerCase().trim() || tag.name },
    });
  }),

  http.delete(`${API_URL}/api/admin/tags/:id`, ({ params }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const tag = mockTags.find(t => t.id === params.id);
    if (!tag) {
      return HttpResponse.json(
        { error: 'ADMIN_TAG_003: Tag not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ message: 'Tag deleted' });
  }),

  // =====================================
  // Admin Ingredients
  // =====================================

  http.get(`${API_URL}/api/admin/ingredients`, ({ request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    let filteredIngredients = [...mockIngredients];
    if (search) {
      filteredIngredients = filteredIngredients.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return HttpResponse.json({ ingredients: filteredIngredients });
  }),

  http.post(`${API_URL}/api/admin/ingredients`, async ({ request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, string>;

    if (!body.name) {
      return HttpResponse.json(
        { error: 'ADMIN_ING_001: Name is required' },
        { status: 400 }
      );
    }

    const newIngredient = {
      id: `ing-${Date.now()}`,
      name: body.name.toLowerCase().trim(),
      recipeCount: 0,
    };

    return HttpResponse.json({ ingredient: newIngredient }, { status: 201 });
  }),

  // =====================================
  // Admin Features
  // =====================================

  http.get(`${API_URL}/api/admin/features`, () => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    return HttpResponse.json({ features: mockFeatures });
  }),

  http.post(`${API_URL}/api/admin/features`, async ({ request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, unknown>;

    if (!body.code) {
      return HttpResponse.json(
        { error: 'ADMIN_FEAT_001: Code is required' },
        { status: 400 }
      );
    }

    if (!body.name) {
      return HttpResponse.json(
        { error: 'ADMIN_FEAT_002: Name is required' },
        { status: 400 }
      );
    }

    const newFeature = {
      id: `feat-${Date.now()}`,
      code: (body.code as string).toUpperCase(),
      name: body.name,
      description: body.description || null,
      isDefault: Boolean(body.isDefault),
      communityCount: 0,
    };

    return HttpResponse.json({ feature: newFeature }, { status: 201 });
  }),

  // =====================================
  // Admin Communities
  // =====================================

  http.get(`${API_URL}/api/admin/communities`, ({ request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    let filteredCommunities = [...mockCommunities];
    if (search) {
      filteredCommunities = filteredCommunities.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return HttpResponse.json({ communities: filteredCommunities });
  }),

  http.get(`${API_URL}/api/admin/communities/:id`, ({ params }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const community = mockCommunities.find(c => c.id === params.id);
    if (!community) {
      return HttpResponse.json(
        { error: 'ADMIN_COM_001: Community not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      community: {
        ...community,
        members: [
          { id: 'user-1', username: 'user1', email: 'user1@test.com', role: 'ADMIN', joinedAt: new Date().toISOString() },
        ],
        features: [
          { id: 'feat-1', code: 'MVP', name: 'MVP Feature', grantedAt: new Date().toISOString(), grantedBy: 'system', revokedAt: null },
        ],
      },
    });
  }),

  // =====================================
  // User Communities
  // =====================================

  http.get(`${API_URL}/api/communities`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ data: mockUserCommunities });
  }),

  http.post(`${API_URL}/api/communities`, async ({ request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, string>;

    if (!body.name) {
      return HttpResponse.json(
        { error: 'Community must have a name' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      id: `community-${Date.now()}`,
      name: body.name,
      description: body.description || null,
      visibility: 'PRIVATE',
      createdAt: new Date().toISOString(),
      membersCount: 1,
      recipesCount: 0,
      currentUserRole: 'MODERATOR',
    }, { status: 201 });
  }),

  http.get(`${API_URL}/api/communities/:communityId`, ({ params }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    if (params.communityId === 'not-found') {
      return HttpResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      ...mockCommunityDetail,
      id: params.communityId,
    });
  }),

  http.patch(`${API_URL}/api/communities/:communityId`, async ({ params, request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, string>;

    return HttpResponse.json({
      ...mockCommunityDetail,
      id: params.communityId,
      ...body,
    });
  }),

  // =====================================
  // Community Members
  // =====================================

  http.get(`${API_URL}/api/communities/:communityId/members`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ data: mockMembers });
  }),

  http.patch(`${API_URL}/api/communities/:communityId/members/:userId`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ message: 'User promoted to MODERATOR' });
  }),

  http.delete(`${API_URL}/api/communities/:communityId/members/:userId`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ message: 'Left community successfully' });
  }),

  // =====================================
  // Community Invitations
  // =====================================

  http.get(`${API_URL}/api/communities/:communityId/invites`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ data: mockCommunityInvites });
  }),

  http.post(`${API_URL}/api/communities/:communityId/invites`, async ({ request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, string>;

    if (body.username === 'notfound') {
      return HttpResponse.json(
        { error: 'INVITE_003: User not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      id: `invite-${Date.now()}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      respondedAt: null,
      invitee: { id: 'user-new', username: body.username || 'invited', email: body.email || 'invited@example.com' },
      inviter: { id: 'test-user-id', username: 'testuser' },
    }, { status: 201 });
  }),

  http.delete(`${API_URL}/api/communities/:communityId/invites/:inviteId`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ message: 'Invitation cancelled' });
  }),

  // =====================================
  // User Invitations
  // =====================================

  http.get(`${API_URL}/api/users/me/invites`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ data: mockReceivedInvites });
  }),

  http.post(`${API_URL}/api/invites/:inviteId/accept`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({
      message: 'Invitation accepted',
      community: { id: 'community-3', name: 'Italian Cooking' },
    });
  }),

  http.post(`${API_URL}/api/invites/:inviteId/reject`, () => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ message: 'Invitation rejected' });
  }),

  // =====================================
  // User Activity Feed
  // =====================================

  http.get(`${API_URL}/api/communities/:communityId/activity`, ({ request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const activities = mockUserActivityFeed.slice(offset, offset + limit);

    return HttpResponse.json({
      data: activities,
      pagination: {
        total: mockUserActivityFeed.length,
        limit,
        offset,
        hasMore: offset + limit < mockUserActivityFeed.length,
      },
    });
  }),

  http.get(`${API_URL}/api/users/me/activity`, ({ request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const activities = mockUserActivityFeed.slice(offset, offset + limit);

    return HttpResponse.json({
      data: activities,
      pagination: {
        total: mockUserActivityFeed.length,
        limit,
        offset,
        hasMore: offset + limit < mockUserActivityFeed.length,
      },
    });
  }),

  // =====================================
  // Recipe Share
  // =====================================

  http.post(`${API_URL}/api/recipes/:recipeId/share`, async ({ params, request }) => {
    if (!isUserAuthenticated) {
      return HttpResponse.json(
        { error: 'AUTH_001: Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, string>;
    const { targetCommunityId } = body;

    if (!targetCommunityId) {
      return HttpResponse.json(
        { error: 'RECIPE_006: Target community required' },
        { status: 400 }
      );
    }

    // Simulate permission error for specific test case
    if (targetCommunityId === 'no-permission') {
      return HttpResponse.json(
        { error: 'RECIPE_007: Cannot share - must be MODERATOR or recipe creator' },
        { status: 403 }
      );
    }

    const newRecipe = {
      id: `shared-recipe-${Date.now()}`,
      title: 'Shared Recipe',
      content: 'Shared recipe content',
      imageUrl: null,
      creatorId: mockUser.id,
      creator: mockUser,
      communityId: targetCommunityId,
      originRecipeId: params.recipeId,
      sharedFromCommunityId: 'community-1',
      sharedFromCommunity: { id: 'community-1', name: 'Baking Club' },
      tags: [],
      ingredients: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ recipe: newRecipe }, { status: 201 });
  }),

  // =====================================
  // Admin Activity
  // =====================================

  http.get(`${API_URL}/api/admin/activity`, ({ request }) => {
    if (!isAdminAuthenticated) {
      return HttpResponse.json(
        { error: 'ADMIN_001: Not authenticated' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const type = url.searchParams.get('type');

    let filteredActivities = [...mockActivities];
    if (type) {
      filteredActivities = filteredActivities.filter(a => a.type === type);
    }

    return HttpResponse.json({
      activities: filteredActivities.slice(offset, offset + limit),
      pagination: {
        total: filteredActivities.length,
        limit,
        offset,
        hasMore: offset + limit < filteredActivities.length,
      },
    });
  }),
];

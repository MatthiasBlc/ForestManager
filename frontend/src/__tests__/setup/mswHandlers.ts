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
        requireTotp: true,
        qrCodeUrl: null, // TOTP deja configure
      });
    }

    if (body.email === 'newadmin@example.com' && body.password === 'AdminTest123!') {
      isAdminTotpPending = true;
      return HttpResponse.json({
        message: 'TOTP setup required',
        requireTotp: true,
        qrCodeUrl: 'data:image/png;base64,mockQrCode',
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
      last7Days: {
        users: 5,
        communities: 1,
        recipes: 20,
      },
      topCommunities: [],
    });
  }),
];

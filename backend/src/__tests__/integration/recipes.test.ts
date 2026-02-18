import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestUser, createTestRecipe, extractSessionCookie } from '../setup/testHelpers';

describe('Recipes API', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let sessionCookie: string | null;

  beforeEach(async () => {
    // Creer un user et obtenir sa session
    testUser = await createTestUser();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      });
    sessionCookie = extractSessionCookie(loginRes);
  });

  // =====================================
  // POST /api/recipes
  // =====================================
  describe('POST /api/recipes', () => {
    it('should create recipe with minimal data (title + content)', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Cookie', sessionCookie!)
        .send({
          title: 'Ma recette',
          content: 'Contenu de la recette',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Ma recette');
      expect(res.body.content).toBe('Contenu de la recette');
      expect(res.body.id).toBeDefined();
    });

    it('should create recipe with tags and ingredients', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Cookie', sessionCookie!)
        .send({
          title: 'Recette complete',
          content: 'Contenu',
          tags: ['dessert', 'rapide'],
          ingredients: [
            { name: 'sucre', quantity: 100 },
            { name: 'farine', quantity: 200 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.tags).toHaveLength(2);
      expect(res.body.ingredients).toHaveLength(2);
    });

    it('should return 400 when title is missing', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Cookie', sessionCookie!)
        .send({
          content: 'Contenu',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('RECIPE_003');
    });

    it('should return 400 when content is missing', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Cookie', sessionCookie!)
        .send({
          title: 'Titre',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('RECIPE_004');
    });

    it('should deduplicate tags (case insensitive)', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Cookie', sessionCookie!)
        .send({
          title: 'Recette',
          content: 'Contenu',
          tags: ['Dessert', 'dessert', 'DESSERT'],
        });

      expect(res.status).toBe(201);
      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0].name).toBe('dessert');
    });

    it('should create tags on-the-fly', async () => {
      const uniqueTag = `tag_${Date.now()}`;
      const res = await request(app)
        .post('/api/recipes')
        .set('Cookie', sessionCookie!)
        .send({
          title: 'Recette',
          content: 'Contenu',
          tags: [uniqueTag],
        });

      expect(res.status).toBe(201);
      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0].name).toBe(uniqueTag);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .send({
          title: 'Recette',
          content: 'Contenu',
        });

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/recipes
  // =====================================
  describe('GET /api/recipes', () => {
    beforeEach(async () => {
      // Creer quelques recettes
      await createTestRecipe(testUser.id, { title: 'Recette 1' });
      await createTestRecipe(testUser.id, { title: 'Recette 2', tags: ['dessert'] });
      await createTestRecipe(testUser.id, { title: 'Gateau chocolat', tags: ['dessert', 'chocolat'] });
    });

    it('should list recipes with default pagination', async () => {
      const res = await request(app)
        .get('/api/recipes')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination.limit).toBe(20);
    });

    it('should respect limit parameter', async () => {
      const res = await request(app)
        .get('/api/recipes?limit=2')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.hasMore).toBe(true);
    });

    it('should respect offset parameter', async () => {
      const res = await request(app)
        .get('/api/recipes?limit=2&offset=2')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.offset).toBe(2);
    });

    it('should cap limit at 100', async () => {
      const res = await request(app)
        .get('/api/recipes?limit=200')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });

    it('should filter by tags (AND logic)', async () => {
      const res = await request(app)
        .get('/api/recipes?tags=dessert,chocolat')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Gateau chocolat');
    });

    it('should filter by single tag', async () => {
      const res = await request(app)
        .get('/api/recipes?tags=dessert')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should search by title (case insensitive)', async () => {
      const res = await request(app)
        .get('/api/recipes?search=gateau')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toContain('Gateau');
    });

    it('should return empty array when no match', async () => {
      const res = await request(app)
        .get('/api/recipes?search=inexistant')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .get('/api/recipes');

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/recipes/:id
  // =====================================
  describe('GET /api/recipes/:id', () => {
    it('should return recipe details', async () => {
      const recipe = await createTestRecipe(testUser.id, {
        title: 'Ma recette',
        content: 'Mon contenu',
        tags: ['tag1'],
        ingredients: [{ name: 'ingredient1', quantity: 100 }],
      });

      const res = await request(app)
        .get(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Ma recette');
      expect(res.body.content).toBe('Mon contenu');
      expect(res.body.tags).toBeDefined();
      expect(res.body.ingredients).toBeDefined();
    });

    it('should return 404 for non-existent recipe', async () => {
      const res = await request(app)
        .get('/api/recipes/00000000-0000-0000-0000-000000000000')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('RECIPE_001');
    });

    it('should return 403 for another users recipe', async () => {
      // Creer un autre user et sa recette
      const otherUser = await createTestUser({ username: 'otheruser' });
      const otherRecipe = await createTestRecipe(otherUser.id, { title: 'Other recipe' });

      const res = await request(app)
        .get(`/api/recipes/${otherRecipe.id}`)
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('RECIPE_002');
    });
  });

  // =====================================
  // PATCH /api/recipes/:id
  // =====================================
  describe('PATCH /api/recipes/:id', () => {
    it('should update recipe title', async () => {
      const recipe = await createTestRecipe(testUser.id, { title: 'Ancien titre' });

      const res = await request(app)
        .patch(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!)
        .send({ title: 'Nouveau titre' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Nouveau titre');
    });

    it('should update recipe content', async () => {
      const recipe = await createTestRecipe(testUser.id, { content: 'Ancien contenu' });

      const res = await request(app)
        .patch(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!)
        .send({ content: 'Nouveau contenu' });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('Nouveau contenu');
    });

    it('should replace tags completely', async () => {
      const recipe = await createTestRecipe(testUser.id, {
        title: 'Recette',
        tags: ['ancien'],
      });

      const res = await request(app)
        .patch(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!)
        .send({ tags: ['nouveau', 'tag'] });

      expect(res.status).toBe(200);
      expect(res.body.tags).toHaveLength(2);
      expect(res.body.tags.map((t: { name: string }) => t.name)).not.toContain('ancien');
    });

    it('should allow empty tags array', async () => {
      const recipe = await createTestRecipe(testUser.id, {
        title: 'Recette',
        tags: ['tag'],
      });

      const res = await request(app)
        .patch(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!)
        .send({ tags: [] });

      expect(res.status).toBe(200);
      expect(res.body.tags).toHaveLength(0);
    });

    it('should return 400 for empty title', async () => {
      const recipe = await createTestRecipe(testUser.id);

      const res = await request(app)
        .patch(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('RECIPE_003');
    });

    it('should return 400 for empty content', async () => {
      const recipe = await createTestRecipe(testUser.id);

      const res = await request(app)
        .patch(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!)
        .send({ content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('RECIPE_004');
    });

    it('should return 404 for non-existent recipe', async () => {
      const res = await request(app)
        .patch('/api/recipes/00000000-0000-0000-0000-000000000000')
        .set('Cookie', sessionCookie!)
        .send({ title: 'New title' });

      expect(res.status).toBe(404);
    });

    it('should return 403 for another users recipe', async () => {
      const otherUser = await createTestUser({ username: 'otheruser2' });
      const otherRecipe = await createTestRecipe(otherUser.id);

      const res = await request(app)
        .patch(`/api/recipes/${otherRecipe.id}`)
        .set('Cookie', sessionCookie!)
        .send({ title: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // DELETE /api/recipes/:id
  // =====================================
  describe('DELETE /api/recipes/:id', () => {
    it('should soft delete recipe', async () => {
      const recipe = await createTestRecipe(testUser.id, { title: 'A supprimer' });

      const res = await request(app)
        .delete(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(204);
    });

    it('should not appear in list after delete', async () => {
      const recipe = await createTestRecipe(testUser.id, { title: 'A supprimer' });

      await request(app)
        .delete(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!);

      const listRes = await request(app)
        .get('/api/recipes')
        .set('Cookie', sessionCookie!);

      expect(listRes.body.data.find((r: { id: string }) => r.id === recipe.id)).toBeUndefined();
    });

    it('should return 404 when getting deleted recipe', async () => {
      const recipe = await createTestRecipe(testUser.id);

      await request(app)
        .delete(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!);

      const res = await request(app)
        .get(`/api/recipes/${recipe.id}`)
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(404);
    });

    it('should return 403 for another users recipe', async () => {
      const otherUser = await createTestUser({ username: 'otheruser3' });
      const otherRecipe = await createTestRecipe(otherUser.id);

      const res = await request(app)
        .delete(`/api/recipes/${otherRecipe.id}`)
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent recipe', async () => {
      const res = await request(app)
        .delete('/api/recipes/00000000-0000-0000-0000-000000000000')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(404);
    });
  });
});

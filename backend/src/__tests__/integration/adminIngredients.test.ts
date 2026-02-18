import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestIngredient,
  createTestUser,
  createTestRecipe,
  loginAsAdmin,
} from '../setup/testHelpers';
import { testPrisma } from '../setup/globalSetup';

describe('Admin Ingredients API', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/ingredients
  // =====================================
  describe('GET /api/admin/ingredients', () => {
    it('should return all ingredients with recipe counts', async () => {
      await createTestIngredient('sugar');
      await createTestIngredient('flour');
      await createTestIngredient('butter');

      const res = await request(app)
        .get('/api/admin/ingredients')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.ingredients).toBeDefined();
      expect(Array.isArray(res.body.ingredients)).toBe(true);
      expect(res.body.ingredients.length).toBeGreaterThanOrEqual(3);

      // Verifier la structure
      const ingredient = res.body.ingredients.find((i: { name: string }) => i.name === 'sugar');
      expect(ingredient).toBeDefined();
      expect(ingredient.id).toBeDefined();
      expect(ingredient.name).toBe('sugar');
      expect(typeof ingredient.recipeCount).toBe('number');
    });

    it('should filter ingredients by search query', async () => {
      await createTestIngredient('chocolate');
      await createTestIngredient('cheese');
      await createTestIngredient('vanilla');

      const res = await request(app)
        .get('/api/admin/ingredients?search=ch')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.ingredients.every((i: { name: string }) =>
        i.name.toLowerCase().includes('ch')
      )).toBe(true);
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/ingredients');

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/admin/ingredients
  // =====================================
  describe('POST /api/admin/ingredients', () => {
    it('should create a new ingredient', async () => {
      const res = await request(app)
        .post('/api/admin/ingredients')
        .set('Cookie', adminCookie)
        .send({ name: 'New Test Ingredient' });

      expect(res.status).toBe(201);
      expect(res.body.ingredient).toBeDefined();
      expect(res.body.ingredient.name).toBe('new test ingredient'); // Normalized to lowercase
      expect(res.body.ingredient.id).toBeDefined();

      // Verifier en DB
      const ingredient = await testPrisma.ingredient.findUnique({
        where: { name: 'new test ingredient' },
      });
      expect(ingredient).not.toBeNull();
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/admin/ingredients')
        .set('Cookie', adminCookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_ING_001');
    });

    it('should return 409 when ingredient already exists', async () => {
      await createTestIngredient('existing');

      const res = await request(app)
        .post('/api/admin/ingredients')
        .set('Cookie', adminCookie)
        .send({ name: 'Existing' }); // Different case, same ingredient

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_ING_002');
    });
  });

  // =====================================
  // PATCH /api/admin/ingredients/:id
  // =====================================
  describe('PATCH /api/admin/ingredients/:id', () => {
    it('should rename an ingredient', async () => {
      const ingredient = await createTestIngredient('oldname');

      const res = await request(app)
        .patch(`/api/admin/ingredients/${ingredient.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'newname' });

      expect(res.status).toBe(200);
      expect(res.body.ingredient.name).toBe('newname');

      // Verifier en DB
      const updated = await testPrisma.ingredient.findUnique({
        where: { id: ingredient.id },
      });
      expect(updated?.name).toBe('newname');
    });

    it('should return 404 for non-existent ingredient', async () => {
      const res = await request(app)
        .patch('/api/admin/ingredients/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie)
        .send({ name: 'newname' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_ING_003');
    });

    it('should return 409 when renaming to existing name', async () => {
      const ing1 = await createTestIngredient('first');
      await createTestIngredient('second');

      const res = await request(app)
        .patch(`/api/admin/ingredients/${ing1.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'second' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_ING_002');
    });
  });

  // =====================================
  // DELETE /api/admin/ingredients/:id
  // =====================================
  describe('DELETE /api/admin/ingredients/:id', () => {
    it('should delete an ingredient', async () => {
      const ingredient = await createTestIngredient('todelete');

      const res = await request(app)
        .delete(`/api/admin/ingredients/${ingredient.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');

      // Verifier en DB
      const deleted = await testPrisma.ingredient.findUnique({
        where: { id: ingredient.id },
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent ingredient', async () => {
      const res = await request(app)
        .delete('/api/admin/ingredients/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_ING_003');
    });
  });

  // =====================================
  // POST /api/admin/ingredients/:id/merge
  // =====================================
  describe('POST /api/admin/ingredients/:id/merge', () => {
    it('should merge source ingredient into target ingredient', async () => {
      const user = await createTestUser();
      const sourceIng = await createTestIngredient('source_ing');
      const targetIng = await createTestIngredient('target_ing');

      // Creer une recette avec l'ingredient source
      await createTestRecipe(user.id, {
        ingredients: [{ name: 'source_ing', quantity: 100 }],
      });

      const res = await request(app)
        .post(`/api/admin/ingredients/${sourceIng.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: targetIng.id });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('merged');

      // Verifier que le source est supprime
      const deletedSource = await testPrisma.ingredient.findUnique({
        where: { id: sourceIng.id },
      });
      expect(deletedSource).toBeNull();

      // Verifier que le target a les recettes
      const targetWithRecipes = await testPrisma.ingredient.findUnique({
        where: { id: targetIng.id },
        include: { recipes: true },
      });
      expect(targetWithRecipes?.recipes.length).toBeGreaterThan(0);
    });

    it('should return 400 when merging ingredient into itself', async () => {
      const ingredient = await createTestIngredient('selfmerge');

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: ingredient.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_ING_005');
    });

    it('should return 400 when targetId is missing', async () => {
      const ingredient = await createTestIngredient('notarget');

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/merge`)
        .set('Cookie', adminCookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_ING_004');
    });
  });
});

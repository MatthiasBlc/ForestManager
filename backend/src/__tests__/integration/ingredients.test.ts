import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestUser,
  createTestRecipe,
  extractSessionCookie,
} from '../setup/testHelpers';

describe('Ingredients API', () => {
  let userCookie: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: user.username,
        password: user.password,
      });

    userCookie = extractSessionCookie(loginRes)!;
  });

  // =====================================
  // GET /api/ingredients
  // =====================================
  describe('GET /api/ingredients', () => {
    it('should return ingredients with recipe counts for authenticated user', async () => {
      // Creer des recettes avec des ingredients
      await createTestRecipe(userId, {
        ingredients: [
          { name: 'flour', quantity: 200 },
          { name: 'sugar', quantity: 100 },
        ],
      });
      await createTestRecipe(userId, {
        ingredients: [
          { name: 'flour', quantity: 300 },
          { name: 'butter', quantity: 50 },
        ],
      });

      const res = await request(app)
        .get('/api/ingredients')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);

      // Verifier la structure
      const flourIngredient = res.body.data.find((i: { name: string }) => i.name === 'flour');
      expect(flourIngredient).toBeDefined();
      expect(flourIngredient.id).toBeDefined();
      expect(flourIngredient.recipeCount).toBe(2); // 2 recettes avec cet ingredient
    });

    it('should filter ingredients by search query', async () => {
      await createTestRecipe(userId, {
        ingredients: [
          { name: 'chocolate' },
          { name: 'cheese' },
          { name: 'vanilla' },
        ],
      });

      const res = await request(app)
        .get('/api/ingredients?search=ch')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.every((i: { name: string }) =>
        i.name.toLowerCase().includes('ch')
      )).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Creer plusieurs ingredients
      const ingredients = [];
      for (let i = 0; i < 10; i++) {
        ingredients.push({ name: `ingredient_${i}` });
      }
      await createTestRecipe(userId, { ingredients });

      const res = await request(app)
        .get('/api/ingredients?limit=5')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should only count recipes owned by the authenticated user', async () => {
      const otherUser = await createTestUser();

      // Creer des recettes avec le meme ingredient par differents users
      await createTestRecipe(userId, {
        ingredients: [{ name: 'shared_ingredient' }],
      });
      await createTestRecipe(otherUser.id, {
        ingredients: [{ name: 'shared_ingredient' }],
      });

      const res = await request(app)
        .get('/api/ingredients')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      const sharedIngredient = res.body.data.find((i: { name: string }) => i.name === 'shared_ingredient');
      expect(sharedIngredient).toBeDefined();
      expect(sharedIngredient.recipeCount).toBe(1); // Seulement la recette de l'user connecte
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/ingredients');

      expect(res.status).toBe(401);
    });
  });
});

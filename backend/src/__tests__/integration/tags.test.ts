import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestUser,
  createTestRecipe,
  createTestTag,
  extractSessionCookie,
} from '../setup/testHelpers';

describe('Tags API', () => {
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
  // GET /api/tags
  // =====================================
  describe('GET /api/tags', () => {
    it('should return tags with recipe counts for authenticated user', async () => {
      // Creer des tags et des recettes
      await createTestRecipe(userId, { tags: ['breakfast', 'healthy'] });
      await createTestRecipe(userId, { tags: ['breakfast', 'quick'] });

      const res = await request(app)
        .get('/api/tags')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);

      // Verifier la structure
      const breakfastTag = res.body.data.find((t: { name: string }) => t.name === 'breakfast');
      expect(breakfastTag).toBeDefined();
      expect(breakfastTag.id).toBeDefined();
      expect(breakfastTag.recipeCount).toBe(2); // 2 recettes avec ce tag
    });

    it('should filter tags by search query', async () => {
      await createTestRecipe(userId, { tags: ['chocolate', 'dessert'] });
      await createTestRecipe(userId, { tags: ['cheese', 'savory'] });

      const res = await request(app)
        .get('/api/tags?search=ch')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.every((t: { name: string }) =>
        t.name.toLowerCase().includes('ch')
      )).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Creer plusieurs tags
      for (let i = 0; i < 10; i++) {
        await createTestRecipe(userId, { tags: [`tag_${i}`] });
      }

      const res = await request(app)
        .get('/api/tags?limit=5')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should only count recipes owned by the authenticated user', async () => {
      const otherUser = await createTestUser();

      // Creer des recettes avec le meme tag par differents users
      await createTestRecipe(userId, { tags: ['shared_tag'] });
      await createTestRecipe(otherUser.id, { tags: ['shared_tag'] });

      const res = await request(app)
        .get('/api/tags')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      const sharedTag = res.body.data.find((t: { name: string }) => t.name === 'shared_tag');
      expect(sharedTag).toBeDefined();
      expect(sharedTag.recipeCount).toBe(1); // Seulement la recette de l'user connecte
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/tags');

      expect(res.status).toBe(401);
    });
  });
});

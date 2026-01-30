import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestUser,
  createTestRecipe,
  createTestCommunity,
  loginAsAdmin,
} from '../setup/testHelpers';

describe('Admin Dashboard API', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/dashboard/stats
  // =====================================
  describe('GET /api/admin/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      // Creer quelques donnees de test
      const user = await createTestUser();
      await createTestRecipe(user.id);
      await createTestCommunity(user.id);

      const res = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);

      // Verifier la structure totals
      expect(res.body.totals).toBeDefined();
      expect(typeof res.body.totals.users).toBe('number');
      expect(typeof res.body.totals.communities).toBe('number');
      expect(typeof res.body.totals.recipes).toBe('number');
      expect(typeof res.body.totals.tags).toBe('number');
      expect(typeof res.body.totals.ingredients).toBe('number');
      expect(typeof res.body.totals.features).toBe('number');

      // Verifier la structure lastWeek
      expect(res.body.lastWeek).toBeDefined();
      expect(typeof res.body.lastWeek.newUsers).toBe('number');
      expect(typeof res.body.lastWeek.newCommunities).toBe('number');
      expect(typeof res.body.lastWeek.newRecipes).toBe('number');

      // Verifier la structure topCommunities
      expect(res.body.topCommunities).toBeDefined();
      expect(Array.isArray(res.body.topCommunities)).toBe(true);
    });

    it('should return correct counts', async () => {
      // Creer des donnees
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      await createTestRecipe(user1.id);
      await createTestRecipe(user1.id);
      await createTestRecipe(user2.id);
      await createTestCommunity(user1.id);

      const res = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);

      // Les counts doivent refleter les nouvelles donnees
      expect(res.body.totals.users).toBeGreaterThanOrEqual(2);
      expect(res.body.totals.recipes).toBeGreaterThanOrEqual(3);
      expect(res.body.totals.communities).toBeGreaterThanOrEqual(1);
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/stats');

      expect(res.status).toBe(401);
    });

    it('should return 401 with user authentication (not admin)', async () => {
      const user = await createTestUser();

      // Login en tant que user normal
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: user.password,
        });

      const userCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0];

      const res = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Cookie', userCookie || '');

      expect(res.status).toBe(401);
    });
  });
});

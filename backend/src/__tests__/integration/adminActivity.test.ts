import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestTag,
  loginAsAdmin,
} from '../setup/testHelpers';

describe('Admin Activity API', () => {
  let adminCookie: string;
  let adminId: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminId = admin.id;
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/activity
  // =====================================
  describe('GET /api/admin/activity', () => {
    it('should return activity logs with pagination', async () => {
      // Creer quelques activites en faisant des operations admin
      await request(app)
        .post('/api/admin/tags')
        .set('Cookie', adminCookie)
        .send({ name: 'activity_test_1' });

      await request(app)
        .post('/api/admin/tags')
        .set('Cookie', adminCookie)
        .send({ name: 'activity_test_2' });

      const res = await request(app)
        .get('/api/admin/activity')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);

      // Verifier la structure activities
      expect(res.body.activities).toBeDefined();
      expect(Array.isArray(res.body.activities)).toBe(true);
      expect(res.body.activities.length).toBeGreaterThanOrEqual(2);

      // Verifier la structure d'une activite
      const activity = res.body.activities[0];
      expect(activity.id).toBeDefined();
      expect(activity.type).toBeDefined();
      expect(activity.createdAt).toBeDefined();
      expect(activity.admin).toBeDefined();
      expect(activity.admin.username).toBeDefined();

      // Verifier la pagination
      expect(res.body.pagination).toBeDefined();
      expect(typeof res.body.pagination.total).toBe('number');
      expect(typeof res.body.pagination.limit).toBe('number');
      expect(typeof res.body.pagination.offset).toBe('number');
      expect(typeof res.body.pagination.hasMore).toBe('boolean');
    });

    it('should filter activity by type', async () => {
      // Creer des activites de differents types
      await request(app)
        .post('/api/admin/tags')
        .set('Cookie', adminCookie)
        .send({ name: 'filter_test_tag' });

      const res = await request(app)
        .get('/api/admin/activity?type=TAG_CREATED')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.activities.length).toBeGreaterThan(0);
      expect(res.body.activities.every((a: { type: string }) => a.type === 'TAG_CREATED')).toBe(true);
    });

    it('should respect limit and offset parameters', async () => {
      // Creer plusieurs activites
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/admin/tags')
          .set('Cookie', adminCookie)
          .send({ name: `pagination_test_${i}` });
      }

      // Tester le limit
      const resLimit = await request(app)
        .get('/api/admin/activity?limit=2')
        .set('Cookie', adminCookie);

      expect(resLimit.status).toBe(200);
      expect(resLimit.body.activities.length).toBeLessThanOrEqual(2);
      expect(resLimit.body.pagination.limit).toBe(2);

      // Tester l'offset
      const resOffset = await request(app)
        .get('/api/admin/activity?limit=2&offset=2')
        .set('Cookie', adminCookie);

      expect(resOffset.status).toBe(200);
      expect(resOffset.body.pagination.offset).toBe(2);
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/activity');

      expect(res.status).toBe(401);
    });
  });
});

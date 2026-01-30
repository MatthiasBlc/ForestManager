import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestUser,
  createTestCommunity,
  createTestFeature,
  loginAsAdmin,
} from '../setup/testHelpers';
import { testPrisma } from '../setup/globalSetup';

describe('Admin Features API', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/features
  // =====================================
  describe('GET /api/admin/features', () => {
    it('should return all features with community counts', async () => {
      await createTestFeature({ code: 'FEATURE_A', name: 'Feature A' });
      await createTestFeature({ code: 'FEATURE_B', name: 'Feature B' });

      const res = await request(app)
        .get('/api/admin/features')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.features).toBeDefined();
      expect(Array.isArray(res.body.features)).toBe(true);
      expect(res.body.features.length).toBeGreaterThanOrEqual(2);

      // Verifier la structure
      const feature = res.body.features.find((f: { code: string }) => f.code === 'FEATURE_A');
      expect(feature).toBeDefined();
      expect(feature.id).toBeDefined();
      expect(feature.code).toBe('FEATURE_A');
      expect(feature.name).toBe('Feature A');
      expect(typeof feature.communityCount).toBe('number');
      expect(typeof feature.isDefault).toBe('boolean');
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/features');

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/admin/features
  // =====================================
  describe('POST /api/admin/features', () => {
    it('should create a new feature', async () => {
      const res = await request(app)
        .post('/api/admin/features')
        .set('Cookie', adminCookie)
        .send({
          code: 'NEW_FEATURE',
          name: 'New Feature',
          description: 'A test feature',
          isDefault: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.feature).toBeDefined();
      expect(res.body.feature.code).toBe('NEW_FEATURE');
      expect(res.body.feature.name).toBe('New Feature');
      expect(res.body.feature.description).toBe('A test feature');
      expect(res.body.feature.isDefault).toBe(false);

      // Verifier en DB
      const feature = await testPrisma.feature.findUnique({
        where: { code: 'NEW_FEATURE' },
      });
      expect(feature).not.toBeNull();
    });

    it('should return 400 when code is missing', async () => {
      const res = await request(app)
        .post('/api/admin/features')
        .set('Cookie', adminCookie)
        .send({ name: 'Feature without code' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_FEAT_001');
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/admin/features')
        .set('Cookie', adminCookie)
        .send({ code: 'CODE_ONLY' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_FEAT_002');
    });

    it('should return 409 when feature code already exists', async () => {
      await createTestFeature({ code: 'EXISTING', name: 'Existing' });

      const res = await request(app)
        .post('/api/admin/features')
        .set('Cookie', adminCookie)
        .send({ code: 'existing', name: 'New Name' }); // Different case

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_FEAT_003');
    });
  });

  // =====================================
  // PATCH /api/admin/features/:id
  // =====================================
  describe('PATCH /api/admin/features/:id', () => {
    it('should update a feature', async () => {
      const feature = await createTestFeature({
        code: 'TO_UPDATE',
        name: 'Old Name',
      });

      const res = await request(app)
        .patch(`/api/admin/features/${feature.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'New Name', isDefault: true });

      expect(res.status).toBe(200);
      expect(res.body.feature.name).toBe('New Name');
      expect(res.body.feature.isDefault).toBe(true);

      // Verifier en DB
      const updated = await testPrisma.feature.findUnique({
        where: { id: feature.id },
      });
      expect(updated?.name).toBe('New Name');
      expect(updated?.isDefault).toBe(true);
    });

    it('should return 404 for non-existent feature', async () => {
      const res = await request(app)
        .patch('/api/admin/features/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_FEAT_004');
    });
  });

  // =====================================
  // POST /api/admin/communities/:communityId/features/:featureId (grant)
  // =====================================
  describe('POST /api/admin/communities/:communityId/features/:featureId', () => {
    it('should grant a feature to a community', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id);
      const feature = await createTestFeature({ code: 'GRANT_TEST', name: 'Grant Test' });

      const res = await request(app)
        .post(`/api/admin/communities/${community.id}/features/${feature.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('granted');

      // Verifier en DB
      const communityFeature = await testPrisma.communityFeature.findUnique({
        where: {
          communityId_featureId: {
            communityId: community.id,
            featureId: feature.id,
          },
        },
      });
      expect(communityFeature).not.toBeNull();
      expect(communityFeature?.revokedAt).toBeNull();
    });

    it('should return 404 for non-existent community', async () => {
      const feature = await createTestFeature({ code: 'GRANT_404', name: 'Grant 404' });

      const res = await request(app)
        .post(`/api/admin/communities/00000000-0000-0000-0000-000000000000/features/${feature.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_COM_001');
    });

    it('should return 409 when feature already granted', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id);
      const feature = await createTestFeature({ code: 'ALREADY_GRANTED', name: 'Already Granted' });

      // Grant d'abord
      await request(app)
        .post(`/api/admin/communities/${community.id}/features/${feature.id}`)
        .set('Cookie', adminCookie);

      // Essayer de re-grant
      const res = await request(app)
        .post(`/api/admin/communities/${community.id}/features/${feature.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_FEAT_005');
    });
  });

  // =====================================
  // DELETE /api/admin/communities/:communityId/features/:featureId (revoke)
  // =====================================
  describe('DELETE /api/admin/communities/:communityId/features/:featureId', () => {
    it('should revoke a feature from a community', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id);
      const feature = await createTestFeature({ code: 'REVOKE_TEST', name: 'Revoke Test' });

      // Grant d'abord
      await request(app)
        .post(`/api/admin/communities/${community.id}/features/${feature.id}`)
        .set('Cookie', adminCookie);

      // Revoke
      const res = await request(app)
        .delete(`/api/admin/communities/${community.id}/features/${feature.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('revoked');

      // Verifier en DB (soft revoke)
      const communityFeature = await testPrisma.communityFeature.findUnique({
        where: {
          communityId_featureId: {
            communityId: community.id,
            featureId: feature.id,
          },
        },
      });
      expect(communityFeature).not.toBeNull();
      expect(communityFeature?.revokedAt).not.toBeNull();
    });

    it('should return 404 when feature not granted to community', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id);
      const feature = await createTestFeature({ code: 'NOT_GRANTED', name: 'Not Granted' });

      const res = await request(app)
        .delete(`/api/admin/communities/${community.id}/features/${feature.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_FEAT_006');
    });
  });
});

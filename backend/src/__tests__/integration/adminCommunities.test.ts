import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestUser,
  createTestCommunity,
  loginAsAdmin,
} from '../setup/testHelpers';
import { testPrisma } from '../setup/globalSetup';

describe('Admin Communities API', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/communities
  // =====================================
  describe('GET /api/admin/communities', () => {
    it('should return all communities with counts', async () => {
      const user = await createTestUser();
      await createTestCommunity(user.id, { name: 'Community A' });
      await createTestCommunity(user.id, { name: 'Community B' });

      const res = await request(app)
        .get('/api/admin/communities')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.communities).toBeDefined();
      expect(Array.isArray(res.body.communities)).toBe(true);
      expect(res.body.communities.length).toBeGreaterThanOrEqual(2);

      // Verifier la structure
      const community = res.body.communities.find((c: { name: string }) => c.name === 'Community A');
      expect(community).toBeDefined();
      expect(community.id).toBeDefined();
      expect(community.name).toBe('Community A');
      expect(typeof community.memberCount).toBe('number');
      expect(typeof community.recipeCount).toBe('number');
      expect(Array.isArray(community.features)).toBe(true);
    });

    it('should filter communities by search query', async () => {
      const user = await createTestUser();
      await createTestCommunity(user.id, { name: 'Alpha Team' });
      await createTestCommunity(user.id, { name: 'Beta Group' });

      const res = await request(app)
        .get('/api/admin/communities?search=alpha')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.communities.length).toBe(1);
      expect(res.body.communities[0].name).toBe('Alpha Team');
    });

    it('should exclude deleted communities by default', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id, { name: 'Deleted Community' });

      // Soft delete
      await testPrisma.community.update({
        where: { id: community.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .get('/api/admin/communities')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const found = res.body.communities.find((c: { id: string }) => c.id === community.id);
      expect(found).toBeUndefined();
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/communities');

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/admin/communities/:id
  // =====================================
  describe('GET /api/admin/communities/:id', () => {
    it('should return community detail with members and features', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id, { name: 'Detail Community' });

      const res = await request(app)
        .get(`/api/admin/communities/${community.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.community).toBeDefined();
      expect(res.body.community.id).toBe(community.id);
      expect(res.body.community.name).toBe('Detail Community');
      expect(Array.isArray(res.body.community.members)).toBe(true);
      expect(Array.isArray(res.body.community.features)).toBe(true);

      // Verifier le membre (createur)
      const creator = res.body.community.members.find((m: { id: string }) => m.id === user.id);
      expect(creator).toBeDefined();
      expect(creator.role).toBe('MODERATOR');
    });

    it('should return 404 for non-existent community', async () => {
      const res = await request(app)
        .get('/api/admin/communities/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_COM_001');
    });
  });

  // =====================================
  // PATCH /api/admin/communities/:id
  // =====================================
  describe('PATCH /api/admin/communities/:id', () => {
    it('should rename a community', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id, { name: 'Old Name' });

      const res = await request(app)
        .patch(`/api/admin/communities/${community.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.community.name).toBe('New Name');

      // Verifier en DB
      const updated = await testPrisma.community.findUnique({
        where: { id: community.id },
      });
      expect(updated?.name).toBe('New Name');
    });

    it('should return 404 for non-existent community', async () => {
      const res = await request(app)
        .patch('/api/admin/communities/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_COM_001');
    });

    it('should return 400 when name is empty', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id);

      const res = await request(app)
        .patch(`/api/admin/communities/${community.id}`)
        .set('Cookie', adminCookie)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_COM_002');
    });
  });

  // =====================================
  // DELETE /api/admin/communities/:id
  // =====================================
  describe('DELETE /api/admin/communities/:id', () => {
    it('should soft delete a community', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id, { name: 'To Delete' });

      const res = await request(app)
        .delete(`/api/admin/communities/${community.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');

      // Verifier en DB (soft delete)
      const deleted = await testPrisma.community.findUnique({
        where: { id: community.id },
      });
      expect(deleted).not.toBeNull();
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it('should return 404 for non-existent community', async () => {
      const res = await request(app)
        .delete('/api/admin/communities/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_COM_001');
    });

    it('should return 400 when community already deleted', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id);

      // Premier delete
      await request(app)
        .delete(`/api/admin/communities/${community.id}`)
        .set('Cookie', adminCookie);

      // Deuxieme delete
      const res = await request(app)
        .delete(`/api/admin/communities/${community.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_COM_003');
    });
  });
});

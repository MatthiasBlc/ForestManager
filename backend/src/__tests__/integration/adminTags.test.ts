import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestTag,
  createTestUser,
  createTestRecipe,
  loginAsAdmin,
} from '../setup/testHelpers';
import { testPrisma } from '../setup/globalSetup';

describe('Admin Tags API', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/tags
  // =====================================
  describe('GET /api/admin/tags', () => {
    it('should return all tags with recipe counts', async () => {
      // Creer des tags de test
      await createTestTag('dessert');
      await createTestTag('dinner');
      await createTestTag('breakfast');

      const res = await request(app)
        .get('/api/admin/tags')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.tags).toBeDefined();
      expect(Array.isArray(res.body.tags)).toBe(true);
      expect(res.body.tags.length).toBeGreaterThanOrEqual(3);

      // Verifier la structure
      const tag = res.body.tags.find((t: { name: string }) => t.name === 'dessert');
      expect(tag).toBeDefined();
      expect(tag.id).toBeDefined();
      expect(tag.name).toBe('dessert');
      expect(typeof tag.recipeCount).toBe('number');
    });

    it('should filter tags by search query', async () => {
      await createTestTag('chocolate');
      await createTestTag('cheese');
      await createTestTag('vanilla');

      const res = await request(app)
        .get('/api/admin/tags?search=ch')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.tags.every((t: { name: string }) =>
        t.name.toLowerCase().includes('ch')
      )).toBe(true);
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/tags');

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/admin/tags
  // =====================================
  describe('POST /api/admin/tags', () => {
    it('should create a new tag', async () => {
      const res = await request(app)
        .post('/api/admin/tags')
        .set('Cookie', adminCookie)
        .send({ name: 'New Test Tag' });

      expect(res.status).toBe(201);
      expect(res.body.tag).toBeDefined();
      expect(res.body.tag.name).toBe('new test tag'); // Normalized to lowercase
      expect(res.body.tag.id).toBeDefined();

      // Verifier en DB
      const tag = await testPrisma.tag.findUnique({
        where: { name: 'new test tag' },
      });
      expect(tag).not.toBeNull();
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/admin/tags')
        .set('Cookie', adminCookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_TAG_001');
    });

    it('should return 409 when tag already exists', async () => {
      await createTestTag('existing');

      const res = await request(app)
        .post('/api/admin/tags')
        .set('Cookie', adminCookie)
        .send({ name: 'Existing' }); // Different case, same tag

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_TAG_002');
    });
  });

  // =====================================
  // PATCH /api/admin/tags/:id
  // =====================================
  describe('PATCH /api/admin/tags/:id', () => {
    it('should rename a tag', async () => {
      const tag = await createTestTag('oldname');

      const res = await request(app)
        .patch(`/api/admin/tags/${tag.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'newname' });

      expect(res.status).toBe(200);
      expect(res.body.tag.name).toBe('newname');

      // Verifier en DB
      const updated = await testPrisma.tag.findUnique({ where: { id: tag.id } });
      expect(updated?.name).toBe('newname');
    });

    it('should return 404 for non-existent tag', async () => {
      const res = await request(app)
        .patch('/api/admin/tags/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie)
        .send({ name: 'newname' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_TAG_003');
    });

    it('should return 409 when renaming to existing name', async () => {
      const tag1 = await createTestTag('first');
      await createTestTag('second');

      const res = await request(app)
        .patch(`/api/admin/tags/${tag1.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'second' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_TAG_002');
    });
  });

  // =====================================
  // DELETE /api/admin/tags/:id
  // =====================================
  describe('DELETE /api/admin/tags/:id', () => {
    it('should delete a tag', async () => {
      const tag = await createTestTag('todelete');

      const res = await request(app)
        .delete(`/api/admin/tags/${tag.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');

      // Verifier en DB
      const deleted = await testPrisma.tag.findUnique({ where: { id: tag.id } });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent tag', async () => {
      const res = await request(app)
        .delete('/api/admin/tags/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_TAG_003');
    });
  });

  // =====================================
  // POST /api/admin/tags/:id/merge
  // =====================================
  describe('POST /api/admin/tags/:id/merge', () => {
    it('should merge source tag into target tag', async () => {
      const user = await createTestUser();
      const sourceTag = await createTestTag('source');
      const targetTag = await createTestTag('target');

      // Creer une recette avec le tag source
      await createTestRecipe(user.id, { tags: ['source'] });

      const res = await request(app)
        .post(`/api/admin/tags/${sourceTag.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: targetTag.id });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('merged');

      // Verifier que le source est supprime
      const deletedSource = await testPrisma.tag.findUnique({
        where: { id: sourceTag.id },
      });
      expect(deletedSource).toBeNull();

      // Verifier que le target a les recettes
      const targetWithRecipes = await testPrisma.tag.findUnique({
        where: { id: targetTag.id },
        include: { recipes: true },
      });
      expect(targetWithRecipes?.recipes.length).toBeGreaterThan(0);
    });

    it('should return 400 when merging tag into itself', async () => {
      const tag = await createTestTag('selfmerge');

      const res = await request(app)
        .post(`/api/admin/tags/${tag.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: tag.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_TAG_005');
    });

    it('should return 400 when targetId is missing', async () => {
      const tag = await createTestTag('notarget');

      const res = await request(app)
        .post(`/api/admin/tags/${tag.id}/merge`)
        .set('Cookie', adminCookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_TAG_004');
    });
  });
});

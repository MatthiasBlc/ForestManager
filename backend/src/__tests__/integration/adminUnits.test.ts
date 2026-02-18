import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestUser,
  createTestUnit,
  createTestIngredient,
  loginAsAdmin,
} from '../setup/testHelpers';
import { testPrisma } from '../setup/globalSetup';

describe('Admin Units API', () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/units
  // =====================================
  describe('GET /api/admin/units', () => {
    it('should return all units with usage counts', async () => {
      await createTestUnit({ name: 'gramme_test', abbreviation: 'gt', category: 'WEIGHT', sortOrder: 1 });
      await createTestUnit({ name: 'litre_test', abbreviation: 'lt', category: 'VOLUME', sortOrder: 1 });

      const res = await request(app)
        .get('/api/admin/units')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.units).toBeDefined();
      expect(Array.isArray(res.body.units)).toBe(true);
      expect(res.body.units.length).toBeGreaterThanOrEqual(2);

      const unit = res.body.units.find((u: { name: string }) => u.name === 'gramme_test');
      expect(unit).toBeDefined();
      expect(unit.abbreviation).toBe('gt');
      expect(unit.category).toBe('WEIGHT');
      expect(typeof unit.usageCount).toBe('number');
      expect(typeof unit.defaultIngredientCount).toBe('number');
    });

    it('should filter by search query', async () => {
      await createTestUnit({ name: 'millilitre_search', abbreviation: 'mls', category: 'VOLUME' });
      await createTestUnit({ name: 'gramme_search', abbreviation: 'gs', category: 'WEIGHT' });

      const res = await request(app)
        .get('/api/admin/units?search=milli')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.units.some((u: { name: string }) => u.name === 'millilitre_search')).toBe(true);
      expect(res.body.units.some((u: { name: string }) => u.name === 'gramme_search')).toBe(false);
    });

    it('should filter by category', async () => {
      await createTestUnit({ name: 'weight_filter', abbreviation: 'wf', category: 'WEIGHT' });
      await createTestUnit({ name: 'volume_filter', abbreviation: 'vf', category: 'VOLUME' });

      const res = await request(app)
        .get('/api/admin/units?category=WEIGHT')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.units.every((u: { category: string }) => u.category === 'WEIGHT')).toBe(true);
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app).get('/api/admin/units');
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/admin/units
  // =====================================
  describe('POST /api/admin/units', () => {
    it('should create a new unit', async () => {
      const res = await request(app)
        .post('/api/admin/units')
        .set('Cookie', adminCookie)
        .send({
          name: 'New Unit',
          abbreviation: 'nu',
          category: 'COUNT',
          sortOrder: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.unit).toBeDefined();
      expect(res.body.unit.name).toBe('new unit');
      expect(res.body.unit.abbreviation).toBe('nu');
      expect(res.body.unit.category).toBe('COUNT');
      expect(res.body.unit.sortOrder).toBe(10);
    });

    it('should create audit log entry', async () => {
      const res = await request(app)
        .post('/api/admin/units')
        .set('Cookie', adminCookie)
        .send({ name: 'Audit Unit', abbreviation: 'au', category: 'WEIGHT' });

      expect(res.status).toBe(201);

      const log = await testPrisma.adminActivityLog.findFirst({
        where: { type: 'UNIT_CREATED', targetId: res.body.unit.id },
      });
      expect(log).toBeDefined();
      expect(log!.targetType).toBe('Unit');
    });

    it('should reject duplicate name', async () => {
      await createTestUnit({ name: 'duplicate_name', abbreviation: 'dn1', category: 'WEIGHT' });

      const res = await request(app)
        .post('/api/admin/units')
        .set('Cookie', adminCookie)
        .send({ name: 'duplicate_name', abbreviation: 'dn2', category: 'WEIGHT' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_UNIT_004');
    });

    it('should reject duplicate abbreviation', async () => {
      await createTestUnit({ name: 'dup_abbr_1', abbreviation: 'dup', category: 'WEIGHT' });

      const res = await request(app)
        .post('/api/admin/units')
        .set('Cookie', adminCookie)
        .send({ name: 'dup_abbr_2', abbreviation: 'dup', category: 'WEIGHT' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_UNIT_005');
    });

    it('should reject missing name', async () => {
      const res = await request(app)
        .post('/api/admin/units')
        .set('Cookie', adminCookie)
        .send({ abbreviation: 'x', category: 'WEIGHT' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_UNIT_001');
    });

    it('should reject missing abbreviation', async () => {
      const res = await request(app)
        .post('/api/admin/units')
        .set('Cookie', adminCookie)
        .send({ name: 'no abbr', category: 'WEIGHT' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_UNIT_002');
    });

    it('should reject invalid category', async () => {
      const res = await request(app)
        .post('/api/admin/units')
        .set('Cookie', adminCookie)
        .send({ name: 'bad cat', abbreviation: 'bc', category: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_UNIT_003');
    });
  });

  // =====================================
  // PATCH /api/admin/units/:id
  // =====================================
  describe('PATCH /api/admin/units/:id', () => {
    it('should update unit name', async () => {
      const unit = await createTestUnit({ name: 'old_name', abbreviation: 'on', category: 'WEIGHT' });

      const res = await request(app)
        .patch(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.unit.name).toBe('new name');
    });

    it('should update unit abbreviation', async () => {
      const unit = await createTestUnit({ name: 'abbr_update', abbreviation: 'ou', category: 'WEIGHT' });

      const res = await request(app)
        .patch(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie)
        .send({ abbreviation: 'NU' });

      expect(res.status).toBe(200);
      expect(res.body.unit.abbreviation).toBe('nu');
    });

    it('should update category and sortOrder', async () => {
      const unit = await createTestUnit({ name: 'cat_update', abbreviation: 'cu', category: 'WEIGHT', sortOrder: 1 });

      const res = await request(app)
        .patch(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie)
        .send({ category: 'VOLUME', sortOrder: 5 });

      expect(res.status).toBe(200);
      expect(res.body.unit.category).toBe('VOLUME');
      expect(res.body.unit.sortOrder).toBe(5);
    });

    it('should create audit log on update', async () => {
      const unit = await createTestUnit({ name: 'audit_upd', abbreviation: 'aup', category: 'WEIGHT' });

      await request(app)
        .patch(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'Audit Updated' });

      const log = await testPrisma.adminActivityLog.findFirst({
        where: { type: 'UNIT_UPDATED', targetId: unit.id },
      });
      expect(log).toBeDefined();
    });

    it('should reject duplicate name on update', async () => {
      await createTestUnit({ name: 'existing_unit', abbreviation: 'eu', category: 'WEIGHT' });
      const unit = await createTestUnit({ name: 'to_rename', abbreviation: 'tr', category: 'WEIGHT' });

      const res = await request(app)
        .patch(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie)
        .send({ name: 'existing_unit' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_UNIT_004');
    });

    it('should return 404 for non-existent unit', async () => {
      const res = await request(app)
        .patch('/api/admin/units/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie)
        .send({ name: 'anything' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_UNIT_006');
    });
  });

  // =====================================
  // DELETE /api/admin/units/:id
  // =====================================
  describe('DELETE /api/admin/units/:id', () => {
    it('should delete an unused unit', async () => {
      const unit = await createTestUnit({ name: 'to_delete', abbreviation: 'td', category: 'WEIGHT' });

      const res = await request(app)
        .delete(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');

      const deleted = await testPrisma.unit.findUnique({ where: { id: unit.id } });
      expect(deleted).toBeNull();
    });

    it('should create audit log on delete', async () => {
      const unit = await createTestUnit({ name: 'audit_del', abbreviation: 'ad', category: 'WEIGHT' });

      await request(app)
        .delete(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie);

      const log = await testPrisma.adminActivityLog.findFirst({
        where: { type: 'UNIT_DELETED', targetId: unit.id },
      });
      expect(log).toBeDefined();
    });

    it('should prevent deleting a unit used in recipes', async () => {
      const unit = await createTestUnit({ name: 'used_unit', abbreviation: 'uu', category: 'WEIGHT' });
      const user = await createTestUser();
      const ingredient = await createTestIngredient('used_ing');

      // Creer une recette avec cet ingredient et cette unite
      const recipe = await testPrisma.recipe.create({
        data: { title: 'Test', content: 'Test', creatorId: user.id },
      });
      await testPrisma.recipeIngredient.create({
        data: { recipeId: recipe.id, ingredientId: ingredient.id, unitId: unit.id, quantity: 100 },
      });

      const res = await request(app)
        .delete(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_UNIT_007');
    });

    it('should prevent deleting a unit used as default', async () => {
      const unit = await createTestUnit({ name: 'default_unit', abbreviation: 'du', category: 'WEIGHT' });
      await createTestIngredient('default_ing', { defaultUnitId: unit.id });

      const res = await request(app)
        .delete(`/api/admin/units/${unit.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_UNIT_007');
    });

    it('should return 404 for non-existent unit', async () => {
      const res = await request(app)
        .delete('/api/admin/units/00000000-0000-0000-0000-000000000000')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('ADMIN_UNIT_006');
    });
  });
});

// =====================================
// User Units API (GET /api/units)
// =====================================
describe('User Units API', () => {
  let userCookie: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: user.password });
    userCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  });

  describe('GET /api/units', () => {
    it('should return units grouped by category', async () => {
      await createTestUnit({ name: 'user_gram', abbreviation: 'ug', category: 'WEIGHT', sortOrder: 1 });
      await createTestUnit({ name: 'user_litre', abbreviation: 'ul', category: 'VOLUME', sortOrder: 1 });

      const res = await request(app)
        .get('/api/units')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data).toBe('object');

      // Verifier la structure groupee
      const hasWeight = res.body.data.WEIGHT?.some((u: { name: string }) => u.name === 'user_gram');
      const hasVolume = res.body.data.VOLUME?.some((u: { name: string }) => u.name === 'user_litre');
      expect(hasWeight).toBe(true);
      expect(hasVolume).toBe(true);
    });

    it('should return unit details without usage counts', async () => {
      await createTestUnit({ name: 'detail_unit', abbreviation: 'dtu', category: 'COUNT', sortOrder: 1 });

      const res = await request(app)
        .get('/api/units')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      const countUnits = res.body.data.COUNT;
      const unit = countUnits?.find((u: { name: string }) => u.name === 'detail_unit');
      expect(unit).toBeDefined();
      expect(unit.abbreviation).toBe('dtu');
      expect(unit.sortOrder).toBe(1);
      // Pas de usageCount expose cote user
      expect(unit.usageCount).toBeUndefined();
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/units');
      expect(res.status).toBe(401);
    });
  });
});

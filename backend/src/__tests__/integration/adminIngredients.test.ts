import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestIngredient,
  createTestUser,
  createTestRecipe,
  createTestUnit,
  loginAsAdmin,
} from '../setup/testHelpers';
import { testPrisma } from '../setup/globalSetup';
import appEvents from '../../services/eventEmitter';

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
    it('should return all ingredients with recipe counts and enriched fields', async () => {
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

      const ingredient = res.body.ingredients.find((i: { name: string }) => i.name === 'sugar');
      expect(ingredient).toBeDefined();
      expect(ingredient.id).toBeDefined();
      expect(ingredient.name).toBe('sugar');
      expect(ingredient.status).toBe('APPROVED');
      expect(typeof ingredient.recipeCount).toBe('number');
      expect(typeof ingredient.proposalCount).toBe('number');
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

    it('should filter ingredients by status', async () => {
      await createTestIngredient('approved_ing', { status: 'APPROVED' });
      await createTestIngredient('pending_ing', { status: 'PENDING' });

      const res = await request(app)
        .get('/api/admin/ingredients?status=PENDING')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.ingredients.every((i: { status: string }) => i.status === 'PENDING')).toBe(true);
      expect(res.body.ingredients.some((i: { name: string }) => i.name === 'pending_ing')).toBe(true);
    });

    it('should include createdBy and defaultUnit in response', async () => {
      const user = await createTestUser();
      const unit = await createTestUnit({ name: 'test_gram', abbreviation: 'tg', category: 'WEIGHT' });
      await createTestIngredient('enriched_ing', {
        status: 'PENDING',
        createdById: user.id,
        defaultUnitId: unit.id,
      });

      const res = await request(app)
        .get('/api/admin/ingredients')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const ing = res.body.ingredients.find((i: { name: string }) => i.name === 'enriched_ing');
      expect(ing).toBeDefined();
      expect(ing.createdBy).toBeDefined();
      expect(ing.createdBy.username).toBe(user.username);
      expect(ing.defaultUnit).toBeDefined();
      expect(ing.defaultUnit.name).toBe('test_gram');
    });

    it('should return 401 without admin authentication', async () => {
      const res = await request(app).get('/api/admin/ingredients');
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/admin/ingredients
  // =====================================
  describe('POST /api/admin/ingredients', () => {
    it('should create a new ingredient as APPROVED', async () => {
      const res = await request(app)
        .post('/api/admin/ingredients')
        .set('Cookie', adminCookie)
        .send({ name: 'New Test Ingredient' });

      expect(res.status).toBe(201);
      expect(res.body.ingredient).toBeDefined();
      expect(res.body.ingredient.name).toBe('new test ingredient');
      expect(res.body.ingredient.status).toBe('APPROVED');
    });

    it('should create ingredient with defaultUnitId', async () => {
      const unit = await createTestUnit({ name: 'create_unit', abbreviation: 'cru', category: 'WEIGHT' });

      const res = await request(app)
        .post('/api/admin/ingredients')
        .set('Cookie', adminCookie)
        .send({ name: 'With Unit', defaultUnitId: unit.id });

      expect(res.status).toBe(201);
      expect(res.body.ingredient.defaultUnitId).toBe(unit.id);
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
        .send({ name: 'Existing' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_ING_002');
    });

    it('should return 400 for invalid defaultUnitId', async () => {
      const res = await request(app)
        .post('/api/admin/ingredients')
        .set('Cookie', adminCookie)
        .send({ name: 'Bad Unit', defaultUnitId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_ING_007');
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
    });

    it('should update defaultUnitId', async () => {
      const ingredient = await createTestIngredient('unit_update');
      const unit = await createTestUnit({ name: 'patch_unit', abbreviation: 'pu', category: 'VOLUME' });

      const res = await request(app)
        .patch(`/api/admin/ingredients/${ingredient.id}`)
        .set('Cookie', adminCookie)
        .send({ defaultUnitId: unit.id });

      expect(res.status).toBe(200);
      expect(res.body.ingredient.defaultUnitId).toBe(unit.id);
    });

    it('should clear defaultUnitId with null', async () => {
      const unit = await createTestUnit({ name: 'clear_unit', abbreviation: 'clu', category: 'WEIGHT' });
      const ingredient = await createTestIngredient('clear_default', { defaultUnitId: unit.id });

      const res = await request(app)
        .patch(`/api/admin/ingredients/${ingredient.id}`)
        .set('Cookie', adminCookie)
        .send({ defaultUnitId: null });

      expect(res.status).toBe(200);
      expect(res.body.ingredient.defaultUnitId).toBeNull();
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

      await createTestRecipe(user.id, {
        ingredients: [{ name: 'source_ing', quantity: 100 }],
      });

      const res = await request(app)
        .post(`/api/admin/ingredients/${sourceIng.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: targetIng.id });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('merged');

      const deletedSource = await testPrisma.ingredient.findUnique({
        where: { id: sourceIng.id },
      });
      expect(deletedSource).toBeNull();

      const targetWithRecipes = await testPrisma.ingredient.findUnique({
        where: { id: targetIng.id },
        include: { recipes: true },
      });
      expect(targetWithRecipes?.recipes.length).toBeGreaterThan(0);
    });

    it('should also merge ProposalIngredient', async () => {
      const user = await createTestUser();
      const sourceIng = await createTestIngredient('proposal_source');
      const targetIng = await createTestIngredient('proposal_target');

      // Creer une recette et une proposal avec le source ingredient
      const recipe = await testPrisma.recipe.create({
        data: { title: 'Test', content: 'Test', creatorId: user.id },
      });
      const proposal = await testPrisma.recipeUpdateProposal.create({
        data: {
          recipeId: recipe.id,
          proposerId: user.id,
          proposedTitle: 'Updated',
          proposedContent: 'Updated content',
        },
      });
      await testPrisma.proposalIngredient.create({
        data: { proposalId: proposal.id, ingredientId: sourceIng.id, quantity: 50 },
      });

      const res = await request(app)
        .post(`/api/admin/ingredients/${sourceIng.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: targetIng.id });

      expect(res.status).toBe(200);

      // Verifier que le ProposalIngredient pointe vers le target
      const proposalIngs = await testPrisma.proposalIngredient.findMany({
        where: { proposalId: proposal.id },
      });
      expect(proposalIngs.length).toBe(1);
      expect(proposalIngs[0].ingredientId).toBe(targetIng.id);
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

  // =====================================
  // POST /api/admin/ingredients/:id/approve
  // =====================================
  describe('POST /api/admin/ingredients/:id/approve', () => {
    it('should approve a PENDING ingredient and create audit log', async () => {
      const ingredient = await createTestIngredient('pending_approve', { status: 'PENDING' });

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/approve`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.ingredient.status).toBe('APPROVED');
      expect(res.body.ingredient.name).toBe('pending_approve');

      // Verify audit log
      const log = await testPrisma.adminActivityLog.findFirst({
        where: { type: 'INGREDIENT_APPROVED', targetId: ingredient.id },
      });
      expect(log).toBeDefined();
    });

    it('should approve and rename in one step', async () => {
      const ingredient = await createTestIngredient('typo_name', { status: 'PENDING' });

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/approve`)
        .set('Cookie', adminCookie)
        .send({ newName: 'Correct Name' });

      expect(res.status).toBe(200);
      expect(res.body.ingredient.status).toBe('APPROVED');
      expect(res.body.ingredient.name).toBe('correct name');
    });

    it('should reject approving an already APPROVED ingredient', async () => {
      const ingredient = await createTestIngredient('already_approved', { status: 'APPROVED' });

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/approve`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_ING_008');
    });

    it('should reject rename to existing name', async () => {
      await createTestIngredient('existing_name');
      const ingredient = await createTestIngredient('to_rename', { status: 'PENDING' });

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/approve`)
        .set('Cookie', adminCookie)
        .send({ newName: 'existing_name' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('ADMIN_ING_002');
    });
  });

  // =====================================
  // POST /api/admin/ingredients/:id/reject
  // =====================================
  describe('POST /api/admin/ingredients/:id/reject', () => {
    it('should reject and delete a PENDING ingredient with audit log', async () => {
      const ingredient = await createTestIngredient('pending_reject', { status: 'PENDING' });

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Too vague, please be more specific' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('rejected');

      // Verify hard delete
      const deleted = await testPrisma.ingredient.findUnique({ where: { id: ingredient.id } });
      expect(deleted).toBeNull();

      // Verify audit log with reason
      const log = await testPrisma.adminActivityLog.findFirst({
        where: { type: 'INGREDIENT_REJECTED', targetId: ingredient.id },
      });
      expect(log).toBeDefined();
      expect((log!.metadata as Record<string, string>).reason).toBe('Too vague, please be more specific');
    });

    it('should cascade delete RecipeIngredient on reject', async () => {
      const user = await createTestUser();
      const ingredient = await createTestIngredient('cascade_reject', { status: 'PENDING' });

      // Creer une recette avec cet ingredient
      const recipe = await testPrisma.recipe.create({
        data: { title: 'Test', content: 'Test', creatorId: user.id },
      });
      await testPrisma.recipeIngredient.create({
        data: { recipeId: recipe.id, ingredientId: ingredient.id, quantity: 50 },
      });

      await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Duplicate' });

      const recipeIngs = await testPrisma.recipeIngredient.findMany({
        where: { recipeId: recipe.id },
      });
      expect(recipeIngs).toHaveLength(0);
    });

    it('should reject rejecting an APPROVED ingredient and require reason', async () => {
      // Cannot reject an APPROVED ingredient
      const approved = await createTestIngredient('approved_reject', { status: 'APPROVED' });

      const res1 = await request(app)
        .post(`/api/admin/ingredients/${approved.id}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Mistake' });

      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('ADMIN_ING_008');

      // Reason is required for PENDING
      const pending = await createTestIngredient('no_reason', { status: 'PENDING' });

      const res2 = await request(app)
        .post(`/api/admin/ingredients/${pending.id}/reject`)
        .set('Cookie', adminCookie)
        .send({});

      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('ADMIN_ING_009');
    });
  });

  // =====================================
  // Phase 11.5 - Notifications WebSocket
  // =====================================
  describe('WebSocket Notifications (Phase 11.5)', () => {
    it('should emit INGREDIENT_APPROVED event when approving a PENDING ingredient with a creator', async () => {
      const creator = await createTestUser();
      const ingredient = await createTestIngredient('notif_approve', {
        status: 'PENDING',
        createdById: creator.id,
      });

      const emittedEvents: unknown[] = [];
      const listener = (event: unknown) => emittedEvents.push(event);
      appEvents.on('activity', listener);

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/approve`)
        .set('Cookie', adminCookie);

      appEvents.off('activity', listener);

      expect(res.status).toBe(200);
      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0] as Record<string, unknown>;
      expect(event.type).toBe('INGREDIENT_APPROVED');
      expect(event.communityId).toBeNull();
      expect(event.targetUserIds).toContain(creator.id);
      expect((event.metadata as Record<string, unknown>).ingredientName).toBe('notif_approve');
    });

    it('should emit INGREDIENT_MODIFIED event when approving with rename', async () => {
      const creator = await createTestUser();
      const ingredient = await createTestIngredient('notif_typo', {
        status: 'PENDING',
        createdById: creator.id,
      });

      const emittedEvents: unknown[] = [];
      const listener = (event: unknown) => emittedEvents.push(event);
      appEvents.on('activity', listener);

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/approve`)
        .set('Cookie', adminCookie)
        .send({ newName: 'Correct Name Notif' });

      appEvents.off('activity', listener);

      expect(res.status).toBe(200);
      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0] as Record<string, unknown>;
      expect(event.type).toBe('INGREDIENT_MODIFIED');
      expect(event.targetUserIds).toContain(creator.id);
      const meta = event.metadata as Record<string, unknown>;
      expect(meta.ingredientName).toBe('notif_typo');
      expect(meta.newName).toBe('correct name notif');
    });

    it('should NOT emit any event when approving an ingredient without a creator', async () => {
      const ingredient = await createTestIngredient('notif_no_creator', { status: 'PENDING' });

      const emittedEvents: unknown[] = [];
      const listener = (event: unknown) => emittedEvents.push(event);
      appEvents.on('activity', listener);

      await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/approve`)
        .set('Cookie', adminCookie);

      appEvents.off('activity', listener);

      expect(emittedEvents).toHaveLength(0);
    });

    it('should emit INGREDIENT_REJECTED event when rejecting a PENDING ingredient with a creator', async () => {
      const creator = await createTestUser();
      const ingredient = await createTestIngredient('notif_reject', {
        status: 'PENDING',
        createdById: creator.id,
      });

      const emittedEvents: unknown[] = [];
      const listener = (event: unknown) => emittedEvents.push(event);
      appEvents.on('activity', listener);

      const res = await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Ingredient trop vague' });

      appEvents.off('activity', listener);

      expect(res.status).toBe(200);
      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0] as Record<string, unknown>;
      expect(event.type).toBe('INGREDIENT_REJECTED');
      expect(event.communityId).toBeNull();
      expect(event.targetUserIds).toContain(creator.id);
      const meta = event.metadata as Record<string, unknown>;
      expect(meta.ingredientName).toBe('notif_reject');
      expect(meta.reason).toBe('Ingredient trop vague');
    });

    it('should NOT emit any event when rejecting an ingredient without a creator', async () => {
      const ingredient = await createTestIngredient('notif_reject_no_creator', { status: 'PENDING' });

      const emittedEvents: unknown[] = [];
      const listener = (event: unknown) => emittedEvents.push(event);
      appEvents.on('activity', listener);

      await request(app)
        .post(`/api/admin/ingredients/${ingredient.id}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'No creator' });

      appEvents.off('activity', listener);

      expect(emittedEvents).toHaveLength(0);
    });

    it('should emit INGREDIENT_MERGED event when merging a source with a creator', async () => {
      const creator = await createTestUser();
      const source = await createTestIngredient('notif_merge_source', {
        status: 'PENDING',
        createdById: creator.id,
      });
      const target = await createTestIngredient('notif_merge_target');

      const emittedEvents: unknown[] = [];
      const listener = (event: unknown) => emittedEvents.push(event);
      appEvents.on('activity', listener);

      await request(app)
        .post(`/api/admin/ingredients/${source.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: target.id });

      appEvents.off('activity', listener);

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0] as Record<string, unknown>;
      expect(event.type).toBe('INGREDIENT_MERGED');
      expect(event.communityId).toBeNull();
      expect(event.targetUserIds).toContain(creator.id);
      const meta = event.metadata as Record<string, unknown>;
      expect(meta.ingredientName).toBe('notif_merge_source');
      expect(meta.targetName).toBe('notif_merge_target');
    });

    it('should NOT emit any event when merging a source without a creator', async () => {
      const source = await createTestIngredient('notif_merge_no_creator');
      const target = await createTestIngredient('notif_merge_no_creator_target');

      const emittedEvents: unknown[] = [];
      const listener = (event: unknown) => emittedEvents.push(event);
      appEvents.on('activity', listener);

      await request(app)
        .post(`/api/admin/ingredients/${source.id}/merge`)
        .set('Cookie', adminCookie)
        .send({ targetId: target.id });

      appEvents.off('activity', listener);

      expect(emittedEvents).toHaveLength(0);
    });
  });
});

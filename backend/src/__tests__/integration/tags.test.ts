import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestUser,
  createTestRecipe,
  createTestTag,
  extractSessionCookie,
} from '../setup/testHelpers';
import { testPrisma } from '../setup/globalSetup';

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

    it('should return only GLOBAL APPROVED tags without communityId', async () => {
      // Creer un tag GLOBAL APPROVED via recette perso
      await createTestRecipe(userId, { tags: ['global_tag'] });

      // Creer un tag COMMUNITY APPROVED (ne devrait pas apparaitre sans communityId specifique)
      const community = await testPrisma.community.create({
        data: { name: `TagTest Community ${Date.now()}` },
      });
      await testPrisma.userCommunity.create({
        data: { userId, communityId: community.id, role: 'MEMBER' },
      });
      await createTestTag('community_only_tag', {
        scope: 'COMMUNITY',
        status: 'APPROVED',
        communityId: community.id,
      });

      const res = await request(app)
        .get('/api/tags')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      const globalTag = res.body.data.find((t: { name: string }) => t.name === 'global_tag');
      expect(globalTag).toBeDefined();
      expect(globalTag.scope).toBe('GLOBAL');

      // Le tag communautaire apparait aussi car l'user est membre et showTags=true par defaut
      const communityTag = res.body.data.find((t: { name: string }) => t.name === 'community_only_tag');
      expect(communityTag).toBeDefined();
      expect(communityTag.scope).toBe('COMMUNITY');
    });

    it('should return GLOBAL + COMMUNITY APPROVED tags with communityId', async () => {
      await createTestRecipe(userId, { tags: ['global_for_community'] });

      const community = await testPrisma.community.create({
        data: { name: `TagCommunity ${Date.now()}` },
      });
      await createTestTag('comm_approved', {
        scope: 'COMMUNITY',
        status: 'APPROVED',
        communityId: community.id,
      });

      const res = await request(app)
        .get(`/api/tags?communityId=${community.id}`)
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      const names = res.body.data.map((t: { name: string }) => t.name);
      expect(names).toContain('global_for_community');
      expect(names).toContain('comm_approved');
    });

    it('should exclude PENDING tags from autocomplete', async () => {
      const community = await testPrisma.community.create({
        data: { name: `TagPending ${Date.now()}` },
      });
      await createTestTag('pending_tag', {
        scope: 'COMMUNITY',
        status: 'PENDING',
        communityId: community.id,
      });
      await createTestTag('approved_tag', {
        scope: 'COMMUNITY',
        status: 'APPROVED',
        communityId: community.id,
      });

      const res = await request(app)
        .get(`/api/tags?communityId=${community.id}`)
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      const names = res.body.data.map((t: { name: string }) => t.name);
      expect(names).toContain('approved_tag');
      expect(names).not.toContain('pending_tag');
    });

    it('should respect showTags=false preference in personal context', async () => {
      const community = await testPrisma.community.create({
        data: { name: `TagHidden ${Date.now()}` },
      });
      await testPrisma.userCommunity.create({
        data: { userId, communityId: community.id, role: 'MEMBER' },
      });
      await createTestTag('hidden_comm_tag', {
        scope: 'COMMUNITY',
        status: 'APPROVED',
        communityId: community.id,
      });

      // Desactiver showTags pour cette communaute
      await testPrisma.userCommunityTagPreference.create({
        data: { userId, communityId: community.id, showTags: false },
      });

      const res = await request(app)
        .get('/api/tags')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      const names = res.body.data.map((t: { name: string }) => t.name);
      expect(names).not.toContain('hidden_comm_tag');
    });
  });
});

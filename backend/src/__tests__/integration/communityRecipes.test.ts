import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import {
  extractSessionCookie,
} from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Community Recipes API", () => {
  let moderator: { id: string; username: string; email: string };
  let moderatorCookie: string;
  let member: { id: string; username: string; email: string };
  let memberCookie: string;
  let _nonMember: { id: string; username: string; email: string };
  let nonMemberCookie: string;
  let community: { id: string; name: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create moderator via signup
    const modSignup = await request(app).post("/api/auth/signup").send({
      username: `crmod_${suffix}`,
      email: `crmod_${suffix}@example.com`,
      password: "Test123!Password",
    });
    moderatorCookie = extractSessionCookie(modSignup)!;
    moderator = (await testPrisma.user.findFirst({
      where: { email: `crmod_${suffix}@example.com` },
    }))!;

    // Create community
    const createRes = await request(app)
      .post("/api/communities")
      .set("Cookie", moderatorCookie)
      .send({ name: `Recipe Community ${suffix}` });
    community = createRes.body;

    // Create member via signup, add to community
    const memSignup = await request(app).post("/api/auth/signup").send({
      username: `crmem_${suffix}`,
      email: `crmem_${suffix}@example.com`,
      password: "Test123!Password",
    });
    memberCookie = extractSessionCookie(memSignup)!;
    member = (await testPrisma.user.findFirst({
      where: { email: `crmem_${suffix}@example.com` },
    }))!;

    // Add member to community directly
    await testPrisma.userCommunity.create({
      data: {
        userId: member.id,
        communityId: community.id,
        role: "MEMBER",
      },
    });

    // Create non-member via signup
    const nonMemSignup = await request(app).post("/api/auth/signup").send({
      username: `crnonm_${suffix}`,
      email: `crnonm_${suffix}@example.com`,
      password: "Test123!Password",
    });
    nonMemberCookie = extractSessionCookie(nonMemSignup)!;
    _nonMember = (await testPrisma.user.findFirst({
      where: { email: `crnonm_${suffix}@example.com` },
    }))!;
  });

  // =====================================
  // POST /api/communities/:communityId/recipes
  // =====================================
  describe("POST /api/communities/:communityId/recipes", () => {
    it("should create both personal and community recipes", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Tarte aux pommes",
          content: "Faire une tarte avec des pommes",
        });

      expect(res.status).toBe(201);
      expect(res.body.personal).toBeDefined();
      expect(res.body.community).toBeDefined();

      // Personal recipe
      expect(res.body.personal.title).toBe("Tarte aux pommes");
      expect(res.body.personal.communityId).toBeNull();
      expect(res.body.personal.creatorId).toBe(member.id);

      // Community recipe
      expect(res.body.community.title).toBe("Tarte aux pommes");
      expect(res.body.community.communityId).toBe(community.id);
      expect(res.body.community.creatorId).toBe(member.id);
      expect(res.body.community.originRecipeId).toBe(res.body.personal.id);
    });

    it("should create recipe with tags and ingredients on both copies", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Recette complete",
          content: "Contenu detaille",
          tags: ["dessert", "rapide"],
          ingredients: [
            { name: "sucre", quantity: "100g" },
            { name: "farine", quantity: "200g" },
          ],
        });

      expect(res.status).toBe(201);

      // Tags on both
      expect(res.body.personal.tags).toHaveLength(2);
      expect(res.body.community.tags).toHaveLength(2);

      // Ingredients on both
      expect(res.body.personal.ingredients).toHaveLength(2);
      expect(res.body.community.ingredients).toHaveLength(2);
    });

    it("should allow moderator to create recipe", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", moderatorCookie)
        .send({
          title: "Recette du mod",
          content: "Contenu du mod",
        });

      expect(res.status).toBe(201);
      expect(res.body.community.creatorId).toBe(moderator.id);
    });

    it("should return 400 when title is missing", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          content: "Contenu",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_003");
    });

    it("should return 400 when content is missing", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Titre",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_004");
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", nonMemberCookie)
        .send({
          title: "Recette",
          content: "Contenu",
        });

      expect(res.status).toBe(403);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .send({
          title: "Recette",
          content: "Contenu",
        });

      expect(res.status).toBe(401);
    });

    it("should create an activity log entry", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Recette avec log",
          content: "Contenu",
        });

      expect(res.status).toBe(201);

      const log = await testPrisma.activityLog.findFirst({
        where: {
          type: "RECIPE_CREATED",
          communityId: community.id,
          recipeId: res.body.community.id,
          userId: member.id,
        },
      });

      expect(log).not.toBeNull();
    });
  });

  // =====================================
  // Tags scope-aware
  // =====================================
  describe("Tags scope-aware (POST /api/communities/:communityId/recipes)", () => {
    it("should use existing GLOBAL APPROVED tag directly", async () => {
      // Creer un tag global via recette perso
      await request(app)
        .post("/api/recipes")
        .set("Cookie", memberCookie)
        .send({ title: "Perso", content: "c", tags: ["existing_global"] });

      // Creer recette communautaire avec le meme tag
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({ title: "Comm", content: "c", tags: ["existing_global"] });

      expect(res.status).toBe(201);
      const communityTags = res.body.community.tags;
      expect(communityTags).toHaveLength(1);
      expect(communityTags[0].name).toBe("existing_global");
      expect(communityTags[0].scope).toBe("GLOBAL");
      expect(communityTags[0].status).toBe("APPROVED");
    });

    it("should create PENDING community tag for unknown tag", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({ title: "Recette", content: "c", tags: ["brand_new_tag"] });

      expect(res.status).toBe(201);

      // La recette communautaire doit avoir un tag PENDING
      const communityTags = res.body.community.tags;
      expect(communityTags).toHaveLength(1);
      expect(communityTags[0].name).toBe("brand_new_tag");
      expect(communityTags[0].scope).toBe("COMMUNITY");
      expect(communityTags[0].status).toBe("PENDING");
      expect(communityTags[0].communityId).toBe(community.id);

      // La recette perso doit avoir un tag GLOBAL APPROVED (creation libre)
      const personalTags = res.body.personal.tags;
      expect(personalTags).toHaveLength(1);
      expect(personalTags[0].name).toBe("brand_new_tag");
      expect(personalTags[0].scope).toBe("GLOBAL");
      expect(personalTags[0].status).toBe("APPROVED");
    });

    it("should reuse existing COMMUNITY APPROVED tag", async () => {
      // Creer un tag APPROVED dans la communaute
      await testPrisma.tag.create({
        data: {
          name: "approved_comm_tag",
          scope: "COMMUNITY",
          status: "APPROVED",
          communityId: community.id,
        },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({ title: "R", content: "c", tags: ["approved_comm_tag"] });

      expect(res.status).toBe(201);
      const communityTags = res.body.community.tags;
      expect(communityTags).toHaveLength(1);
      expect(communityTags[0].name).toBe("approved_comm_tag");
      expect(communityTags[0].scope).toBe("COMMUNITY");
      expect(communityTags[0].status).toBe("APPROVED");
    });

    it("should reuse existing PENDING tag in same community (no duplicate)", async () => {
      // Creer un tag PENDING directement en DB
      const pendingTag = await testPrisma.tag.create({
        data: {
          name: "pending_reuse",
          scope: "COMMUNITY",
          status: "PENDING",
          communityId: community.id,
          createdById: member.id,
        },
      });

      // Creer une recette avec ce tag → doit reutiliser le PENDING existant
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({ title: "R2", content: "c", tags: ["pending_reuse"] });

      expect(res.status).toBe(201);
      const communityTags = res.body.community.tags;
      expect(communityTags).toHaveLength(1);
      expect(communityTags[0].name).toBe("pending_reuse");
      expect(communityTags[0].status).toBe("PENDING");
      expect(communityTags[0].id).toBe(pendingTag.id);

      // Verifier qu'il n'y a qu'un seul tag COMMUNITY dans la DB
      const dbTags = await testPrisma.tag.findMany({
        where: { name: "pending_reuse", communityId: community.id },
      });
      expect(dbTags).toHaveLength(1);
    });

    it("should reject more than 10 tags per recipe (TAG_003)", async () => {
      const tags = Array.from({ length: 11 }, (_, i) => `tag_${i}`);
      const res = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({ title: "Too many tags", content: "c", tags });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_003");
    });
  });

  // =====================================
  // GET /api/communities/:communityId/recipes
  // =====================================
  describe("GET /api/communities/:communityId/recipes", () => {
    beforeEach(async () => {
      // Create some community recipes via API
      await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({ title: "Recette 1", content: "Contenu 1" });

      await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Recette 2",
          content: "Contenu 2",
          tags: ["dessert"],
        });

      await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", moderatorCookie)
        .send({
          title: "Gateau chocolat",
          content: "Contenu 3",
          tags: ["dessert", "chocolat"],
        });
    });

    it("should list community recipes with pagination", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.limit).toBe(20);
    });

    it("should include creator info in response", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      const recipe = res.body.data[0];
      expect(recipe.creator).toBeDefined();
      expect(recipe.creator.id).toBeDefined();
      expect(recipe.creator.username).toBeDefined();
    });

    it("should respect limit parameter", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/recipes?limit=2`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.hasMore).toBe(true);
    });

    it("should filter by tags", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/recipes?tags=dessert,chocolat`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Gateau chocolat");
    });

    it("should search by title", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/recipes?search=gateau`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toContain("Gateau");
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/recipes`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/recipes`);

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/recipes/:id (community recipe)
  // =====================================
  describe("GET /api/recipes/:id (community recipe)", () => {
    let communityRecipeId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Recette detail",
          content: "Contenu detail",
          tags: ["tag1"],
          ingredients: [{ name: "ingredient1", quantity: "50g" }],
        });
      communityRecipeId = createRes.body.community.id;
    });

    it("should allow member to access community recipe", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Recette detail");
      expect(res.body.communityId).toBe(community.id);
      expect(res.body.community).toBeDefined();
      expect(res.body.community.name).toBeDefined();
    });

    it("should return community fields in response", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("communityId");
      expect(res.body).toHaveProperty("originRecipeId");
      expect(res.body).toHaveProperty("isVariant");
      expect(res.body).toHaveProperty("sharedFromCommunityId");
    });

    it("should return 403 for non-member accessing community recipe", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // PATCH /api/recipes/:id (community recipe)
  // =====================================
  describe("PATCH /api/recipes/:id (community recipe)", () => {
    let communityRecipeId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Recette a modifier",
          content: "Contenu original",
        });
      communityRecipeId = createRes.body.community.id;
    });

    it("should allow creator-member to update community recipe", async () => {
      const res = await request(app)
        .patch(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie)
        .send({ title: "Titre modifie" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Titre modifie");
    });

    it("should return 403 for non-creator member", async () => {
      // moderator is a member but not the creator
      const res = await request(app)
        .patch(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", moderatorCookie)
        .send({ title: "Modification interdite" });

      expect(res.status).toBe(403);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .patch(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", nonMemberCookie)
        .send({ title: "Hack" });

      expect(res.status).toBe(403);
    });

    it("should return 403 if creator left community", async () => {
      // Remove member from community
      await testPrisma.userCommunity.updateMany({
        where: {
          userId: member.id,
          communityId: community.id,
        },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .patch(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie)
        .send({ title: "Apres depart" });

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // DELETE /api/recipes/:id (community recipe)
  // =====================================
  describe("DELETE /api/recipes/:id (community recipe)", () => {
    let communityRecipeId: string;
    let personalRecipeId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie)
        .send({
          title: "Recette a supprimer",
          content: "Contenu",
        });
      communityRecipeId = createRes.body.community.id;
      personalRecipeId = createRes.body.personal.id;
    });

    it("should soft delete community recipe", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(204);

      // Verify deleted
      const getRes = await request(app)
        .get(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie);
      expect(getRes.status).toBe(404);
    });

    it("should NOT delete personal recipe when deleting community recipe", async () => {
      await request(app)
        .delete(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie);

      // Personal recipe should still exist
      const getRes = await request(app)
        .get(`/api/recipes/${personalRecipeId}`)
        .set("Cookie", memberCookie);
      expect(getRes.status).toBe(200);
      expect(getRes.body.title).toBe("Recette a supprimer");
    });

    it("should NOT delete community recipe when deleting personal recipe", async () => {
      await request(app)
        .delete(`/api/recipes/${personalRecipeId}`)
        .set("Cookie", memberCookie);

      // Community recipe should still exist
      const getRes = await request(app)
        .get(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie);
      expect(getRes.status).toBe(200);
    });

    it("should return 403 for non-creator member", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(403);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });

    it("should not appear in community recipes list after delete", async () => {
      await request(app)
        .delete(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", memberCookie);

      const listRes = await request(app)
        .get(`/api/communities/${community.id}/recipes`)
        .set("Cookie", memberCookie);

      const found = listRes.body.data.find(
        (r: { id: string }) => r.id === communityRecipeId
      );
      expect(found).toBeUndefined();
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Tag Suggestions API", () => {
  let _moderator: { id: string };
  let moderatorCookie: string;
  let owner: { id: string };
  let ownerCookie: string;
  let suggester: { id: string };
  let suggesterCookie: string;
  let community: { id: string };
  let communityRecipeId: string;

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create moderator (creates community)
    const modSignup = await request(app).post("/api/auth/signup").send({
      username: `tsmod_${suffix}`,
      email: `tsmod_${suffix}@example.com`,
      password: "Test123!Password",
    });
    moderatorCookie = extractSessionCookie(modSignup)!;
    _moderator = (await testPrisma.user.findFirst({
      where: { email: `tsmod_${suffix}@example.com` },
    }))!;

    // Create community
    const createRes = await request(app)
      .post("/api/communities")
      .set("Cookie", moderatorCookie)
      .send({ name: `TagSug Community ${suffix}` });
    community = createRes.body;

    // Create owner (member)
    const ownerSignup = await request(app).post("/api/auth/signup").send({
      username: `tsown_${suffix}`,
      email: `tsown_${suffix}@example.com`,
      password: "Test123!Password",
    });
    ownerCookie = extractSessionCookie(ownerSignup)!;
    owner = (await testPrisma.user.findFirst({
      where: { email: `tsown_${suffix}@example.com` },
    }))!;
    await testPrisma.userCommunity.create({
      data: { userId: owner.id, communityId: community.id, role: "MEMBER" },
    });

    // Create suggester (member)
    const sugSignup = await request(app).post("/api/auth/signup").send({
      username: `tssug_${suffix}`,
      email: `tssug_${suffix}@example.com`,
      password: "Test123!Password",
    });
    suggesterCookie = extractSessionCookie(sugSignup)!;
    suggester = (await testPrisma.user.findFirst({
      where: { email: `tssug_${suffix}@example.com` },
    }))!;
    await testPrisma.userCommunity.create({
      data: { userId: suggester.id, communityId: community.id, role: "MEMBER" },
    });

    // Create a community recipe owned by owner
    const recipeRes = await request(app)
      .post(`/api/communities/${community.id}/recipes`)
      .set("Cookie", ownerCookie)
      .send({ title: "Test Recipe", servings: 4, steps: [{ instruction: "Some content" }] });
    communityRecipeId = recipeRes.body.community.id;
  });

  // =====================================
  // POST /api/recipes/:recipeId/tag-suggestions
  // =====================================
  describe("POST /api/recipes/:recipeId/tag-suggestions", () => {
    it("should create a tag suggestion", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", suggesterCookie)
        .send({ tagName: "Dessert" });

      expect(res.status).toBe(201);
      expect(res.body.tagName).toBe("dessert");
      expect(res.body.status).toBe("PENDING_OWNER");
      expect(res.body.suggestedBy.id).toBe(suggester.id);
    });

    it("should block self-suggestion (TAG_007)", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", ownerCookie)
        .send({ tagName: "myowntag" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_007");
    });

    it("should block duplicate suggestion (TAG_006)", async () => {
      await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", suggesterCookie)
        .send({ tagName: "duplicate" });

      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", suggesterCookie)
        .send({ tagName: "Duplicate" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("TAG_006");
    });

    it("should block non-member", async () => {
      const suffix = uniqueSuffix();
      const outsiderSignup = await request(app).post("/api/auth/signup").send({
        username: `tsout_${suffix}`,
        email: `tsout_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const outsiderCookie = extractSessionCookie(outsiderSignup)!;

      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", outsiderCookie)
        .send({ tagName: "nope" });

      expect(res.status).toBe(403);
    });

    it("should block suggestion on personal recipe", async () => {
      // Create a personal recipe by suggester
      const personalRes = await request(app)
        .post("/api/recipes")
        .set("Cookie", ownerCookie)
        .send({ title: "Personal", servings: 4, steps: [{ instruction: "content" }] });

      const res = await request(app)
        .post(`/api/recipes/${personalRes.body.id}/tag-suggestions`)
        .set("Cookie", suggesterCookie)
        .send({ tagName: "nope" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_007");
    });

    it("should block when recipe has max tags (TAG_003)", async () => {
      // Add 10 tags to the recipe
      for (let i = 0; i < 10; i++) {
        const tag = await testPrisma.tag.create({
          data: { name: `maxtag_${i}_${uniqueSuffix()}`, scope: "GLOBAL", status: "APPROVED" },
        });
        await testPrisma.recipeTag.create({
          data: { recipeId: communityRecipeId, tagId: tag.id },
        });
      }

      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", suggesterCookie)
        .send({ tagName: "one too many" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_003");
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .post("/api/recipes/00000000-0000-0000-0000-000000000000/tag-suggestions")
        .set("Cookie", suggesterCookie)
        .send({ tagName: "nope" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("RECIPE_001");
    });

    it("should validate tag name (TAG_001)", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", suggesterCookie)
        .send({ tagName: "a" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_001");
    });

    it("should reject empty tag name", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", suggesterCookie)
        .send({ tagName: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_001");
    });
  });

  // =====================================
  // GET /api/recipes/:recipeId/tag-suggestions
  // =====================================
  describe("GET /api/recipes/:recipeId/tag-suggestions", () => {
    it("should list suggestions for members", async () => {
      await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "suggestion1",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].tagName).toBe("suggestion1");
      expect(res.body.data[0].suggestedBy.id).toBe(suggester.id);
    });

    it("should filter by status", async () => {
      await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "pending_one",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });
      await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "approved_one",
          suggestedById: suggester.id,
          status: "APPROVED",
          decidedAt: new Date(),
        },
      });

      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/tag-suggestions?status=PENDING_OWNER`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].tagName).toBe("pending_one");
    });

    it("should include pagination", async () => {
      await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "pag1",
          suggestedById: suggester.id,
        },
      });
      await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "pag2",
          suggestedById: suggester.id,
        },
      });

      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/tag-suggestions?limit=1`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .get("/api/recipes/00000000-0000-0000-0000-000000000000/tag-suggestions")
        .set("Cookie", suggesterCookie);

      expect(res.status).toBe(404);
    });

    it("should block non-members", async () => {
      const suffix = uniqueSuffix();
      const outsiderSignup = await request(app).post("/api/auth/signup").send({
        username: `tsout2_${suffix}`,
        email: `tsout2_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const outsiderCookie = extractSessionCookie(outsiderSignup)!;

      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/tag-suggestions`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // POST /api/tag-suggestions/:id/accept
  // =====================================
  describe("POST /api/tag-suggestions/:id/accept", () => {
    it("should accept suggestion with existing global tag -> APPROVED", async () => {
      // Create an existing global tag
      await testPrisma.tag.create({
        data: { name: "global_existing", scope: "GLOBAL", status: "APPROVED" },
      });

      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "global_existing",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/accept`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("APPROVED");

      // RecipeTag should exist
      const recipeTag = await testPrisma.recipeTag.findFirst({
        where: { recipeId: communityRecipeId },
        include: { tag: true },
      });
      expect(recipeTag).not.toBeNull();
      expect(recipeTag!.tag.name).toBe("global_existing");
    });

    it("should accept suggestion with existing community tag -> APPROVED", async () => {
      await testPrisma.tag.create({
        data: {
          name: "comm_existing",
          scope: "COMMUNITY",
          status: "APPROVED",
          communityId: community.id,
        },
      });

      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "comm_existing",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/accept`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("APPROVED");
    });

    it("should accept suggestion with unknown tag -> PENDING_MODERATOR", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "brand_new_tag",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/accept`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("PENDING_MODERATOR");

      // A PENDING community tag should have been created
      const pendingTag = await testPrisma.tag.findFirst({
        where: { name: "brand_new_tag", scope: "COMMUNITY", status: "PENDING", communityId: community.id },
      });
      expect(pendingTag).not.toBeNull();

      // RecipeTag should exist
      const recipeTag = await testPrisma.recipeTag.findFirst({
        where: { recipeId: communityRecipeId, tagId: pendingTag!.id },
      });
      expect(recipeTag).not.toBeNull();
    });

    it("should block non-owner", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "blocked_accept",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/accept`)
        .set("Cookie", suggesterCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("RECIPE_002");
    });

    it("should block already decided suggestion", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "already_done",
          suggestedById: suggester.id,
          status: "APPROVED",
          decidedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/accept`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_007");
    });

    it("should return 404 for non-existent suggestion", async () => {
      const res = await request(app)
        .post("/api/tag-suggestions/00000000-0000-0000-0000-000000000000/accept")
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("TAG_007");
    });

    it("should create activity log", async () => {
      await testPrisma.tag.create({
        data: { name: "log_tag", scope: "GLOBAL", status: "APPROVED" },
      });

      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "log_tag",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/accept`)
        .set("Cookie", ownerCookie);

      const log = await testPrisma.activityLog.findFirst({
        where: { type: "TAG_SUGGESTION_ACCEPTED", recipeId: communityRecipeId },
      });
      expect(log).not.toBeNull();
    });
  });

  // =====================================
  // POST /api/tag-suggestions/:id/reject
  // =====================================
  describe("POST /api/tag-suggestions/:id/reject", () => {
    it("should reject suggestion", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "to_reject",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/reject`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("REJECTED");
      expect(res.body.decidedAt).not.toBeNull();
    });

    it("should block non-owner", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "blocked_reject",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/reject`)
        .set("Cookie", suggesterCookie);

      expect(res.status).toBe(403);
    });

    it("should block already decided suggestion", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "already_rejected",
          suggestedById: suggester.id,
          status: "REJECTED",
          decidedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/reject`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_007");
    });

    it("should return 404 for non-existent suggestion", async () => {
      const res = await request(app)
        .post("/api/tag-suggestions/00000000-0000-0000-0000-000000000000/reject")
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(404);
    });

    it("should create activity log", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "log_reject",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/reject`)
        .set("Cookie", ownerCookie);

      const log = await testPrisma.activityLog.findFirst({
        where: { type: "TAG_SUGGESTION_REJECTED", recipeId: communityRecipeId },
      });
      expect(log).not.toBeNull();
    });
  });

  // =====================================
  // Cascade: moderator approve/reject tag -> update TagSuggestions
  // =====================================
  describe("Cascade: moderator tag decisions", () => {
    it("should cascade approve to PENDING_MODERATOR suggestions", async () => {
      // Create a PENDING tag in the community
      const pendingTag = await testPrisma.tag.create({
        data: {
          name: "cascade_approve",
          scope: "COMMUNITY",
          status: "PENDING",
          communityId: community.id,
          createdById: suggester.id,
        },
      });

      // Create RecipeTag with this pending tag
      await testPrisma.recipeTag.create({
        data: { recipeId: communityRecipeId, tagId: pendingTag.id },
      });

      // Create a TagSuggestion in PENDING_MODERATOR
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "cascade_approve",
          suggestedById: suggester.id,
          status: "PENDING_MODERATOR",
        },
      });

      // Moderator approves the tag
      const res = await request(app)
        .post(`/api/communities/${community.id}/tags/${pendingTag.id}/approve`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);

      // TagSuggestion should now be APPROVED
      const updated = await testPrisma.tagSuggestion.findUnique({
        where: { id: suggestion.id },
      });
      expect(updated!.status).toBe("APPROVED");
      expect(updated!.decidedAt).not.toBeNull();
    });

    it("should cascade reject to PENDING_MODERATOR suggestions", async () => {
      // Create a PENDING tag
      const pendingTag = await testPrisma.tag.create({
        data: {
          name: "cascade_reject",
          scope: "COMMUNITY",
          status: "PENDING",
          communityId: community.id,
          createdById: suggester.id,
        },
      });

      // Create RecipeTag
      await testPrisma.recipeTag.create({
        data: { recipeId: communityRecipeId, tagId: pendingTag.id },
      });

      // Create a TagSuggestion in PENDING_MODERATOR
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "cascade_reject",
          suggestedById: suggester.id,
          status: "PENDING_MODERATOR",
        },
      });

      // Moderator rejects the tag
      await request(app)
        .post(`/api/communities/${community.id}/tags/${pendingTag.id}/reject`)
        .set("Cookie", moderatorCookie);

      // TagSuggestion should now be REJECTED
      const updated = await testPrisma.tagSuggestion.findUnique({
        where: { id: suggestion.id },
      });
      expect(updated!.status).toBe("REJECTED");
      expect(updated!.decidedAt).not.toBeNull();
    });
  });

  // =====================================
  // Orphan recipe: auto-reject
  // =====================================
  describe("Orphan recipe handling", () => {
    it("should auto-reject suggestions on deleted recipes", async () => {
      const suggestion = await testPrisma.tagSuggestion.create({
        data: {
          recipeId: communityRecipeId,
          tagName: "orphan_tag",
          suggestedById: suggester.id,
          status: "PENDING_OWNER",
        },
      });

      // Soft-delete the recipe
      await testPrisma.recipe.update({
        where: { id: communityRecipeId },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .post(`/api/tag-suggestions/${suggestion.id}/accept`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_007");

      // Suggestion should be rejected
      const updated = await testPrisma.tagSuggestion.findUnique({
        where: { id: suggestion.id },
      });
      expect(updated!.status).toBe("REJECTED");
    });
  });
});

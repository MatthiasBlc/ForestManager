import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Share Recipe API", () => {
  let _user1: { id: string };
  let user1Cookie: string;
  let user2: { id: string };
  let user2Cookie: string;
  let sourceCommunity: { id: string; name: string };
  let targetCommunity: { id: string; name: string };
  let communityRecipeId: string;

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create user1 (moderator in both communities)
    const user1Signup = await request(app).post("/api/auth/signup").send({
      username: `shareuser1_${suffix}`,
      email: `shareuser1_${suffix}@example.com`,
      password: "Test123!Password",
    });
    user1Cookie = extractSessionCookie(user1Signup)!;
    _user1 = (await testPrisma.user.findFirst({
      where: { email: `shareuser1_${suffix}@example.com` },
    }))!;

    // Create source community
    const sourceRes = await request(app)
      .post("/api/communities")
      .set("Cookie", user1Cookie)
      .send({ name: `Source Community ${suffix}` });
    sourceCommunity = sourceRes.body;

    // Create target community
    const targetRes = await request(app)
      .post("/api/communities")
      .set("Cookie", user1Cookie)
      .send({ name: `Target Community ${suffix}` });
    targetCommunity = targetRes.body;

    // Create user2 (member)
    const user2Signup = await request(app).post("/api/auth/signup").send({
      username: `shareuser2_${suffix}`,
      email: `shareuser2_${suffix}@example.com`,
      password: "Test123!Password",
    });
    user2Cookie = extractSessionCookie(user2Signup)!;
    user2 = (await testPrisma.user.findFirst({
      where: { email: `shareuser2_${suffix}@example.com` },
    }))!;

    // Add user2 to source community as MEMBER
    await testPrisma.userCommunity.create({
      data: {
        userId: user2.id,
        communityId: sourceCommunity.id,
        role: "MEMBER",
      },
    });

    // Create a recipe in source community
    const recipeRes = await request(app)
      .post(`/api/communities/${sourceCommunity.id}/recipes`)
      .set("Cookie", user1Cookie)
      .send({
        title: "Recipe to Share",
        content: "This recipe will be shared",
        tags: ["sharing", "test"],
        ingredients: [{ name: "ingredient1", quantity: "100g" }],
      });
    communityRecipeId = recipeRes.body.community.id;
  });

  // =====================================
  // POST /api/recipes/:recipeId/share
  // =====================================
  describe("POST /api/recipes/:recipeId/share", () => {
    it("should share a recipe to another community", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Recipe to Share");
      expect(res.body.communityId).toBe(targetCommunity.id);
      expect(res.body.originRecipeId).toBe(communityRecipeId);
      expect(res.body.sharedFromCommunityId).toBe(sourceCommunity.id);
      expect(res.body.isVariant).toBe(false);
    });

    it("should copy tags and ingredients to the fork", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(201);
      expect(res.body.tags).toHaveLength(2);
      expect(res.body.tags.map((t: { name: string }) => t.name)).toContain("sharing");
      expect(res.body.tags.map((t: { name: string }) => t.name)).toContain("test");
      expect(res.body.ingredients).toHaveLength(1);
      expect(res.body.ingredients[0].name).toBe("ingredient1");
    });

    it("should create activity logs in both communities", async () => {
      await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      // Check source community activity
      const sourceActivity = await testPrisma.activityLog.findFirst({
        where: {
          communityId: sourceCommunity.id,
          type: "RECIPE_SHARED",
        },
      });
      expect(sourceActivity).toBeDefined();

      // Check target community activity
      const targetActivity = await testPrisma.activityLog.findFirst({
        where: {
          communityId: targetCommunity.id,
          type: "RECIPE_SHARED",
        },
      });
      expect(targetActivity).toBeDefined();
    });

    it("should increment analytics on source recipe", async () => {
      await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      const analytics = await testPrisma.recipeAnalytics.findUnique({
        where: { recipeId: communityRecipeId },
      });
      expect(analytics).toBeDefined();
      expect(analytics?.shares).toBe(1);
      expect(analytics?.forks).toBe(1);
    });

    it("should allow recipe creator to share even if only MEMBER", async () => {
      // user2 creates a recipe in source community
      const recipeRes = await request(app)
        .post(`/api/communities/${sourceCommunity.id}/recipes`)
        .set("Cookie", user2Cookie)
        .send({
          title: "User2 Recipe",
          content: "Created by user2",
        });
      const user2RecipeId = recipeRes.body.community.id;

      // Add user2 to target community as MEMBER
      await testPrisma.userCommunity.create({
        data: {
          userId: user2.id,
          communityId: targetCommunity.id,
          role: "MEMBER",
        },
      });

      // user2 can share their own recipe even as MEMBER
      const res = await request(app)
        .post(`/api/recipes/${user2RecipeId}/share`)
        .set("Cookie", user2Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(201);
    });

    it("should reject sharing personal recipes", async () => {
      // Create a personal recipe
      const personalRes = await request(app)
        .post("/api/recipes")
        .set("Cookie", user1Cookie)
        .send({
          title: "Personal Recipe",
          content: "This is personal",
        });
      const personalRecipeId = personalRes.body.id;

      const res = await request(app)
        .post(`/api/recipes/${personalRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("SHARE_002");
    });

    it("should reject sharing to the same community", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: sourceCommunity.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("SHARE_003");
    });

    it("should reject if not member of source community", async () => {
      // Create user3 who is only member of target
      const suffix = uniqueSuffix();
      const user3Signup = await request(app).post("/api/auth/signup").send({
        username: `shareuser3_${suffix}`,
        email: `shareuser3_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const user3Cookie = extractSessionCookie(user3Signup)!;
      const user3 = (await testPrisma.user.findFirst({
        where: { email: `shareuser3_${suffix}@example.com` },
      }))!;

      // Add user3 only to target community
      await testPrisma.userCommunity.create({
        data: {
          userId: user3.id,
          communityId: targetCommunity.id,
          role: "MEMBER",
        },
      });

      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user3Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_001");
    });

    it("should reject if not member of target community", async () => {
      // user2 is member of source but not target
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user2Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("SHARE_004");
    });

    it("should reject if not recipe creator and not moderator in any community", async () => {
      // Add user2 to target community as MEMBER
      await testPrisma.userCommunity.create({
        data: {
          userId: user2.id,
          communityId: targetCommunity.id,
          role: "MEMBER",
        },
      });

      // user2 tries to share user1's recipe (user2 is MEMBER in both)
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user2Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("SHARE_005");
    });

    it("should reject if target community does not exist", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: "00000000-0000-0000-0000-000000000000" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("COMMUNITY_002");
    });

    it("should reject if recipe does not exist", async () => {
      const res = await request(app)
        .post("/api/recipes/00000000-0000-0000-0000-000000000000/share")
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("RECIPE_001");
    });

    it("should reject without target community ID", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("SHARE_001");
    });

    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .send({ targetCommunityId: targetCommunity.id });

      expect(res.status).toBe(401);
    });

    it("should reject sharing a recipe already shared to the same community", async () => {
      // First share should succeed
      const first = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });
      expect(first.status).toBe(201);

      // Second share to same community should fail
      const second = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });
      expect(second.status).toBe(400);
      expect(second.body.error).toContain("SHARE_006");
    });
  });

  // =====================================
  // Chain analytics (fork of fork)
  // =====================================
  describe("Chain analytics", () => {
    it("should increment analytics for all ancestors when forking a fork", async () => {
      // Fork recipe to target community
      const fork1Res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });

      const fork1Id = fork1Res.body.id;

      // Create a third community
      const suffix = uniqueSuffix();
      const thirdRes = await request(app)
        .post("/api/communities")
        .set("Cookie", user1Cookie)
        .send({ name: `Third Community ${suffix}` });
      const thirdCommunity = thirdRes.body;

      // Fork the fork to third community
      await request(app)
        .post(`/api/recipes/${fork1Id}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: thirdCommunity.id });

      // Check analytics for original recipe
      const originalAnalytics = await testPrisma.recipeAnalytics.findUnique({
        where: { recipeId: communityRecipeId },
      });
      expect(originalAnalytics?.shares).toBe(2); // First fork + chain increment
      expect(originalAnalytics?.forks).toBe(2);

      // Check analytics for first fork
      const fork1Analytics = await testPrisma.recipeAnalytics.findUnique({
        where: { recipeId: fork1Id },
      });
      expect(fork1Analytics?.shares).toBe(1);
      expect(fork1Analytics?.forks).toBe(1);
    });
  });

  // =====================================
  // Bidirectional sync on update
  // =====================================
  describe("Bidirectional sync", () => {
    let personalRecipeId: string;

    beforeEach(async () => {
      // The beforeEach already creates a community recipe via createCommunityRecipe,
      // which also creates a personal copy. Find the personal recipe.
      const communityRecipe = await testPrisma.recipe.findUnique({
        where: { id: communityRecipeId },
      });
      personalRecipeId = communityRecipe!.originRecipeId!;
    });

    it("should sync title/content from personal recipe to community copies", async () => {
      // Update the personal recipe
      const res = await request(app)
        .patch(`/api/recipes/${personalRecipeId}`)
        .set("Cookie", user1Cookie)
        .send({ title: "Updated Title", content: "Updated Content" });

      expect(res.status).toBe(200);

      // Check community copy is synced
      const communityRecipe = await testPrisma.recipe.findUnique({
        where: { id: communityRecipeId },
      });
      expect(communityRecipe?.title).toBe("Updated Title");
      expect(communityRecipe?.content).toBe("Updated Content");
    });

    it("should sync title/content from community recipe to personal + other copies", async () => {
      // Update the community recipe
      const res = await request(app)
        .patch(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", user1Cookie)
        .send({ title: "Community Updated", content: "Community Content Updated" });

      expect(res.status).toBe(200);

      // Check personal recipe is synced
      const personalRecipe = await testPrisma.recipe.findUnique({
        where: { id: personalRecipeId },
      });
      expect(personalRecipe?.title).toBe("Community Updated");
      expect(personalRecipe?.content).toBe("Community Content Updated");
    });

    it("should sync ingredients from personal recipe to community copies", async () => {
      // Update ingredients on personal recipe
      const res = await request(app)
        .patch(`/api/recipes/${personalRecipeId}`)
        .set("Cookie", user1Cookie)
        .send({
          ingredients: [
            { name: "new ingredient", quantity: "200g" },
            { name: "another ingredient", quantity: "50ml" },
          ],
        });

      expect(res.status).toBe(200);

      // Check community copy ingredients
      const communityIngredients = await testPrisma.recipeIngredient.findMany({
        where: { recipeId: communityRecipeId },
        include: { ingredient: true },
        orderBy: { order: "asc" },
      });
      expect(communityIngredients).toHaveLength(2);
      expect(communityIngredients[0].ingredient.name).toBe("new ingredient");
      expect(communityIngredients[0].quantity).toBe("200g");
      expect(communityIngredients[1].ingredient.name).toBe("another ingredient");
    });

    it("should NOT sync tags (tags are local)", async () => {
      // Update tags on personal recipe
      await request(app)
        .patch(`/api/recipes/${personalRecipeId}`)
        .set("Cookie", user1Cookie)
        .send({ tags: ["newtag1", "newtag2"] });

      // Community recipe tags should remain unchanged
      const communityTags = await testPrisma.recipeTag.findMany({
        where: { recipeId: communityRecipeId },
        include: { tag: true },
      });
      // Original tags: "sharing", "test"
      const tagNames = communityTags.map((rt) => rt.tag.name).sort();
      expect(tagNames).toEqual(["sharing", "test"]);
    });

    it("should NOT sync forks (sharedFromCommunityId != null)", async () => {
      // First share the recipe to target community (creates a fork)
      const shareRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/share`)
        .set("Cookie", user1Cookie)
        .send({ targetCommunityId: targetCommunity.id });
      const forkId = shareRes.body.id;

      // Update the personal recipe
      await request(app)
        .patch(`/api/recipes/${personalRecipeId}`)
        .set("Cookie", user1Cookie)
        .send({ title: "Sync Test Title" });

      // Fork should NOT be synced (it has sharedFromCommunityId)
      const fork = await testPrisma.recipe.findUnique({
        where: { id: forkId },
      });
      expect(fork?.title).toBe("Recipe to Share"); // Original title, not synced
    });
  });

  // =====================================
  // POST /api/recipes/:recipeId/publish
  // =====================================
  describe("POST /api/recipes/:recipeId/publish", () => {
    let personalRecipeId: string;

    beforeEach(async () => {
      // Create a personal recipe
      const res = await request(app)
        .post("/api/recipes")
        .set("Cookie", user1Cookie)
        .send({
          title: "Personal to Publish",
          content: "Content to publish",
          tags: ["publish"],
          ingredients: [{ name: "flour", quantity: "200g" }],
        });
      personalRecipeId = res.body.id;
    });

    it("should publish a personal recipe to multiple communities", async () => {
      const res = await request(app)
        .post(`/api/recipes/${personalRecipeId}/publish`)
        .set("Cookie", user1Cookie)
        .send({ communityIds: [sourceCommunity.id, targetCommunity.id] });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(2);

      // Verify copies exist
      const copies = await testPrisma.recipe.findMany({
        where: { originRecipeId: personalRecipeId, deletedAt: null },
      });
      expect(copies).toHaveLength(2);
    });

    it("should skip communities where recipe is already published", async () => {
      // First publish
      await request(app)
        .post(`/api/recipes/${personalRecipeId}/publish`)
        .set("Cookie", user1Cookie)
        .send({ communityIds: [sourceCommunity.id] });

      // Second publish includes already-shared community
      const res = await request(app)
        .post(`/api/recipes/${personalRecipeId}/publish`)
        .set("Cookie", user1Cookie)
        .send({ communityIds: [sourceCommunity.id, targetCommunity.id] });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(1); // Only target, source skipped
    });

    it("should reject publishing a community recipe", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/publish`)
        .set("Cookie", user1Cookie)
        .send({ communityIds: [targetCommunity.id] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("PUBLISH_002");
    });

    it("should reject if not member of target community", async () => {
      const res = await request(app)
        .post(`/api/recipes/${personalRecipeId}/publish`)
        .set("Cookie", user2Cookie)
        .send({ communityIds: [targetCommunity.id] });

      // user2 is not member of target community
      expect(res.status).toBe(403);
    });

    it("should reject without community IDs", async () => {
      const res = await request(app)
        .post(`/api/recipes/${personalRecipeId}/publish`)
        .set("Cookie", user1Cookie)
        .send({ communityIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("PUBLISH_001");
    });

    it("should copy tags and ingredients to published copies", async () => {
      await request(app)
        .post(`/api/recipes/${personalRecipeId}/publish`)
        .set("Cookie", user1Cookie)
        .send({ communityIds: [sourceCommunity.id] });

      const copy = await testPrisma.recipe.findFirst({
        where: { originRecipeId: personalRecipeId, communityId: sourceCommunity.id },
        include: {
          tags: { include: { tag: true } },
          ingredients: { include: { ingredient: true } },
        },
      });

      expect(copy?.tags).toHaveLength(1);
      expect(copy?.tags[0].tag.name).toBe("publish");
      expect(copy?.ingredients).toHaveLength(1);
      expect(copy?.ingredients[0].ingredient.name).toBe("flour");
    });
  });

  // =====================================
  // GET /api/recipes/:recipeId/communities
  // =====================================
  describe("GET /api/recipes/:recipeId/communities", () => {
    it("should return communities where a personal recipe has copies", async () => {
      // Create personal recipe
      const recipeRes = await request(app)
        .post("/api/recipes")
        .set("Cookie", user1Cookie)
        .send({ title: "Test Communities", content: "Content" });
      const personalRecipeId = recipeRes.body.id;

      // Publish to source community
      await request(app)
        .post(`/api/recipes/${personalRecipeId}/publish`)
        .set("Cookie", user1Cookie)
        .send({ communityIds: [sourceCommunity.id] });

      // Get communities
      const res = await request(app)
        .get(`/api/recipes/${personalRecipeId}/communities`)
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(sourceCommunity.id);
    });
  });
});

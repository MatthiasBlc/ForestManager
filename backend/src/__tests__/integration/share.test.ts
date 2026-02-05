import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Share Recipe API", () => {
  let user1: { id: string };
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
    user1 = (await testPrisma.user.findFirst({
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
});

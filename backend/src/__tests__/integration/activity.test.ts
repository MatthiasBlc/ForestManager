import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Activity Feed API", () => {
  // =====================================
  // Community Activity Feed
  // =====================================
  describe("GET /api/communities/:communityId/activity", () => {
    let creator: { id: string };
    let creatorCookie: string;
    let member: { id: string };
    let memberCookie: string;
    let _nonMember: { id: string };
    let nonMemberCookie: string;
    let community: { id: string };

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create creator (moderator) via signup
      const creatorSignup = await request(app).post("/api/auth/signup").send({
        username: `actcreator_${suffix}`,
        email: `actcreator_${suffix}@example.com`,
        password: "Test123!Password",
      });
      creatorCookie = extractSessionCookie(creatorSignup)!;
      creator = (await testPrisma.user.findFirst({
        where: { email: `actcreator_${suffix}@example.com` },
      }))!;

      // Create community (generates RECIPE_CREATED activity via seed features, etc.)
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", creatorCookie)
        .send({ name: `Activity Community ${suffix}` });
      community = createRes.body;

      // Create member via signup
      const memberSignup = await request(app).post("/api/auth/signup").send({
        username: `actmember_${suffix}`,
        email: `actmember_${suffix}@example.com`,
        password: "Test123!Password",
      });
      memberCookie = extractSessionCookie(memberSignup)!;
      member = (await testPrisma.user.findFirst({
        where: { email: `actmember_${suffix}@example.com` },
      }))!;

      // Add member to community
      await testPrisma.userCommunity.create({
        data: {
          userId: member.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      // Create non-member
      const nonMemberSignup = await request(app).post("/api/auth/signup").send({
        username: `actnonm_${suffix}`,
        email: `actnonm_${suffix}@example.com`,
        password: "Test123!Password",
      });
      nonMemberCookie = extractSessionCookie(nonMemberSignup)!;
      _nonMember = (await testPrisma.user.findFirst({
        where: { email: `actnonm_${suffix}@example.com` },
      }))!;
    });

    it("should return activity feed for a community", async () => {
      // Create a recipe to generate activity
      await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", creatorCookie)
        .send({
          title: "Test Recipe for Activity",
          servings: 4,
          steps: [{ instruction: "Recipe content" }],
        });

      const res = await request(app)
        .get(`/api/communities/${community.id}/activity`)
        .set("Cookie", creatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);

      // Should have RECIPE_CREATED activity
      const recipeCreated = res.body.data.find(
        (a: { type: string }) => a.type === "RECIPE_CREATED"
      );
      expect(recipeCreated).toBeDefined();
    });

    it("should return activity with user and recipe info", async () => {
      // Create a recipe
      const recipeRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", creatorCookie)
        .send({
          title: "Recipe With Full Info",
          servings: 4,
          steps: [{ instruction: "Content here" }],
        });

      const res = await request(app)
        .get(`/api/communities/${community.id}/activity`)
        .set("Cookie", creatorCookie);

      expect(res.status).toBe(200);

      const recipeActivity = res.body.data.find(
        (a: { type: string; recipe?: { title: string } }) =>
          a.type === "RECIPE_CREATED" && a.recipe?.title === "Recipe With Full Info"
      );
      expect(recipeActivity).toBeDefined();
      expect(recipeActivity.user).toBeDefined();
      expect(recipeActivity.user.id).toBe(creator.id);
      expect(recipeActivity.recipe).toBeDefined();
      expect(recipeActivity.recipe.id).toBe(recipeRes.body.community.id);
    });

    it("should allow any member to view activity", async () => {
      // Create a recipe as creator
      await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", creatorCookie)
        .send({
          title: "Recipe for Member View",
          servings: 4,
          steps: [{ instruction: "Content" }],
        });

      // Member should see the activity
      const res = await request(app)
        .get(`/api/communities/${community.id}/activity`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should reject non-members", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/activity`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get(
        `/api/communities/${community.id}/activity`
      );

      expect(res.status).toBe(401);
    });

    it("should support pagination", async () => {
      // Create multiple recipes to generate activity
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/communities/${community.id}/recipes`)
          .set("Cookie", creatorCookie)
          .send({
            title: `Recipe ${i} for Pagination`,
            servings: 4,
            steps: [{ instruction: `Content ${i}` }],
          });
      }

      // Get first page
      const res1 = await request(app)
        .get(`/api/communities/${community.id}/activity?limit=2&offset=0`)
        .set("Cookie", creatorCookie);

      expect(res1.status).toBe(200);
      expect(res1.body.data.length).toBe(2);
      expect(res1.body.pagination.hasMore).toBe(true);

      // Get second page
      const res2 = await request(app)
        .get(`/api/communities/${community.id}/activity?limit=2&offset=2`)
        .set("Cookie", creatorCookie);

      expect(res2.status).toBe(200);
      expect(res2.body.data.length).toBe(2);

      // Verify different items
      expect(res1.body.data[0].id).not.toBe(res2.body.data[0].id);
    });

    it("should return activities sorted by createdAt desc", async () => {
      // Create multiple recipes
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/communities/${community.id}/recipes`)
          .set("Cookie", creatorCookie)
          .send({
            title: `Recipe ${i} Sort Test`,
            servings: 4,
            steps: [{ instruction: `Content ${i}` }],
          });
      }

      const res = await request(app)
        .get(`/api/communities/${community.id}/activity`)
        .set("Cookie", creatorCookie);

      expect(res.status).toBe(200);

      // Verify descending order
      for (let i = 0; i < res.body.data.length - 1; i++) {
        const current = new Date(res.body.data[i].createdAt).getTime();
        const next = new Date(res.body.data[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  // =====================================
  // Personal Activity Feed
  // =====================================
  describe("GET /api/users/me/activity", () => {
    let user1: { id: string };
    let user1Cookie: string;
    let user2: { id: string };
    let user2Cookie: string;
    let community: { id: string };
    let communityRecipeId: string;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create user1 (recipe creator)
      const user1Signup = await request(app).post("/api/auth/signup").send({
        username: `myactuser1_${suffix}`,
        email: `myactuser1_${suffix}@example.com`,
        password: "Test123!Password",
      });
      user1Cookie = extractSessionCookie(user1Signup)!;
      user1 = (await testPrisma.user.findFirst({
        where: { email: `myactuser1_${suffix}@example.com` },
      }))!;

      // Create user2 (proposer)
      const user2Signup = await request(app).post("/api/auth/signup").send({
        username: `myactuser2_${suffix}`,
        email: `myactuser2_${suffix}@example.com`,
        password: "Test123!Password",
      });
      user2Cookie = extractSessionCookie(user2Signup)!;
      user2 = (await testPrisma.user.findFirst({
        where: { email: `myactuser2_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", user1Cookie)
        .send({ name: `My Activity Community ${suffix}` });
      community = createRes.body;

      // Add user2 to community
      await testPrisma.userCommunity.create({
        data: {
          userId: user2.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      // Create a recipe as user1
      const recipeRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", user1Cookie)
        .send({
          title: "User1 Recipe",
          servings: 4,
          steps: [{ instruction: "Recipe content for testing" }],
        });
      communityRecipeId = recipeRes.body.community.id;
    });

    it("should return user's own activity", async () => {
      const res = await request(app)
        .get("/api/users/me/activity")
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);

      // User1 created a recipe
      const ownActivity = res.body.data.find(
        (a: { type: string; user: { id: string } }) =>
          a.type === "RECIPE_CREATED" && a.user.id === user1.id
      );
      expect(ownActivity).toBeDefined();
    });

    it("should include proposals on user's recipes", async () => {
      // User2 creates a proposal on user1's recipe
      await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", user2Cookie)
        .send({
          proposedTitle: "Proposed Changes",
          proposedSteps: [{ instruction: "Better content" }],
        });

      // User1 should see this in their activity
      const res = await request(app)
        .get("/api/users/me/activity")
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);

      // Find the proposal activity
      const proposalActivity = res.body.data.find(
        (a: { type: string; user: { id: string } }) =>
          a.type === "VARIANT_PROPOSED" && a.user.id === user2.id
      );
      expect(proposalActivity).toBeDefined();
    });

    it("should NOT include other users' activity on their own recipes", async () => {
      // User2 creates their own recipe
      const user2RecipeRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", user2Cookie)
        .send({
          title: "User2 Own Recipe",
          servings: 4,
          steps: [{ instruction: "User2 content" }],
        });

      // User1's activity should NOT include user2's recipe creation
      const res = await request(app)
        .get("/api/users/me/activity")
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);

      const otherUserRecipe = res.body.data.find(
        (a: { type: string; recipe?: { id: string } }) =>
          a.type === "RECIPE_CREATED" &&
          a.recipe?.id === user2RecipeRes.body.community.id
      );
      expect(otherUserRecipe).toBeUndefined();
    });

    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get("/api/users/me/activity");

      expect(res.status).toBe(401);
    });

    it("should support pagination", async () => {
      // Create multiple recipes to generate activity
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/communities/${community.id}/recipes`)
          .set("Cookie", user1Cookie)
          .send({
            title: `My Recipe ${i}`,
            servings: 4,
            steps: [{ instruction: `Content ${i}` }],
          });
      }

      const res = await request(app)
        .get("/api/users/me/activity?limit=2&offset=0")
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toBeDefined();
    });

    it("should include community info in response", async () => {
      const res = await request(app)
        .get("/api/users/me/activity")
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);

      // Find activity with community
      const activityWithCommunity = res.body.data.find(
        (a: { community?: { id: string } }) => a.community !== null
      );
      expect(activityWithCommunity).toBeDefined();
      expect(activityWithCommunity.community.id).toBe(community.id);
      expect(activityWithCommunity.community.name).toBeDefined();
    });

    it("should show VARIANT_PROPOSED when someone proposes on my recipe", async () => {
      // User2 creates a proposal on user1's recipe
      await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", user2Cookie)
        .send({
          proposedTitle: "Proposal on User1 Recipe",
          proposedSteps: [{ instruction: "This is a proposal" }],
        });

      // User1 should see VARIANT_PROPOSED in their activity
      const res = await request(app)
        .get("/api/users/me/activity")
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);

      const variantProposed = res.body.data.find(
        (a: { type: string; user: { id: string } }) =>
          a.type === "VARIANT_PROPOSED" && a.user.id === user2.id
      );
      expect(variantProposed).toBeDefined();
      expect(variantProposed.recipe.id).toBe(communityRecipeId);
    });

    it("should show PROPOSAL_ACCEPTED when I accept a proposal", async () => {
      // User2 creates a proposal
      const proposalRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", user2Cookie)
        .send({
          proposedTitle: "Proposal to Accept",
          proposedSteps: [{ instruction: "This will be accepted" }],
        });

      // User1 accepts the proposal
      await request(app)
        .post(`/api/proposals/${proposalRes.body.id}/accept`)
        .set("Cookie", user1Cookie);

      // User1 should see PROPOSAL_ACCEPTED in their activity
      const res = await request(app)
        .get("/api/users/me/activity")
        .set("Cookie", user1Cookie);

      expect(res.status).toBe(200);

      const proposalAccepted = res.body.data.find(
        (a: { type: string }) => a.type === "PROPOSAL_ACCEPTED"
      );
      expect(proposalAccepted).toBeDefined();
    });
  });
});

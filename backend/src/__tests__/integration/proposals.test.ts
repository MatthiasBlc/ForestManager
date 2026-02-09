import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Proposals API", () => {
  let recipeCreator: { id: string; username: string; email: string };
  let recipeCreatorCookie: string;
  let proposer: { id: string; username: string; email: string };
  let proposerCookie: string;
  let _nonMember: { id: string; username: string; email: string };
  let nonMemberCookie: string;
  let community: { id: string; name: string };
  let communityRecipeId: string;
  let personalRecipeId: string;

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create recipe creator (moderator) via signup
    const creatorSignup = await request(app).post("/api/auth/signup").send({
      username: `propcreator_${suffix}`,
      email: `propcreator_${suffix}@example.com`,
      password: "Test123!Password",
    });
    recipeCreatorCookie = extractSessionCookie(creatorSignup)!;
    recipeCreator = (await testPrisma.user.findFirst({
      where: { email: `propcreator_${suffix}@example.com` },
    }))!;

    // Create community
    const createRes = await request(app)
      .post("/api/communities")
      .set("Cookie", recipeCreatorCookie)
      .send({ name: `Proposal Community ${suffix}` });
    community = createRes.body;

    // Create proposer (member) via signup
    const proposerSignup = await request(app).post("/api/auth/signup").send({
      username: `proposer_${suffix}`,
      email: `proposer_${suffix}@example.com`,
      password: "Test123!Password",
    });
    proposerCookie = extractSessionCookie(proposerSignup)!;
    proposer = (await testPrisma.user.findFirst({
      where: { email: `proposer_${suffix}@example.com` },
    }))!;

    // Add proposer to community
    await testPrisma.userCommunity.create({
      data: {
        userId: proposer.id,
        communityId: community.id,
        role: "MEMBER",
      },
    });

    // Create non-member via signup
    const nonMemberSignup = await request(app).post("/api/auth/signup").send({
      username: `propnonm_${suffix}`,
      email: `propnonm_${suffix}@example.com`,
      password: "Test123!Password",
    });
    nonMemberCookie = extractSessionCookie(nonMemberSignup)!;
    _nonMember = (await testPrisma.user.findFirst({
      where: { email: `propnonm_${suffix}@example.com` },
    }))!;

    // Create a community recipe
    const recipeRes = await request(app)
      .post(`/api/communities/${community.id}/recipes`)
      .set("Cookie", recipeCreatorCookie)
      .send({
        title: "Original Recipe",
        content: "Original content for the recipe",
      });
    communityRecipeId = recipeRes.body.community.id;
    personalRecipeId = recipeRes.body.personal.id;
  });

  // =====================================
  // POST /api/recipes/:recipeId/proposals
  // =====================================
  describe("POST /api/recipes/:recipeId/proposals", () => {
    it("should create a valid proposal", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Improved Recipe",
          proposedContent: "Better content for the recipe",
        });

      expect(res.status).toBe(201);
      expect(res.body.proposedTitle).toBe("Improved Recipe");
      expect(res.body.proposedContent).toBe("Better content for the recipe");
      expect(res.body.status).toBe("PENDING");
      expect(res.body.proposerId).toBe(proposer.id);
      expect(res.body.recipeId).toBe(communityRecipeId);
    });

    it("should return 403 when user is not a member", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", nonMemberCookie)
        .send({
          proposedTitle: "Hacked Recipe",
          proposedContent: "Hacked content",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_001");
    });

    it("should return 400 when proposing on own recipe (PROPOSAL_001)", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", recipeCreatorCookie)
        .send({
          proposedTitle: "Self improvement",
          proposedContent: "Self content",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("PROPOSAL_001");
    });

    it("should return 400 when proposing on personal recipe", async () => {
      const res = await request(app)
        .post(`/api/recipes/${personalRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Proposal on personal",
          proposedContent: "Content for personal",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("PROPOSAL_001");
    });

    it("should return 404 when recipe not found", async () => {
      const res = await request(app)
        .post(`/api/recipes/00000000-0000-0000-0000-000000000000/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Ghost Recipe",
          proposedContent: "Ghost content",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("RECIPE_001");
    });

    it("should return 400 when title is missing", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedContent: "Content without title",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_003");
    });

    it("should return 400 when content is missing", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Title without content",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_004");
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .send({
          proposedTitle: "Unauthorized",
          proposedContent: "Content",
        });

      expect(res.status).toBe(401);
    });

    it("should create an activity log entry", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Logged Proposal",
          proposedContent: "Logged content",
        });

      expect(res.status).toBe(201);

      const log = await testPrisma.activityLog.findFirst({
        where: {
          type: "VARIANT_PROPOSED",
          communityId: community.id,
          recipeId: communityRecipeId,
          userId: proposer.id,
        },
      });

      expect(log).not.toBeNull();
      expect(log?.metadata).toHaveProperty("proposalId", res.body.id);
    });
  });

  // =====================================
  // GET /api/recipes/:recipeId/proposals
  // =====================================
  describe("GET /api/recipes/:recipeId/proposals", () => {
    beforeEach(async () => {
      // Create some proposals
      await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Proposal 1",
          proposedContent: "Content 1",
        });

      await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Proposal 2",
          proposedContent: "Content 2",
        });
    });

    it("should list proposals for a recipe", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
    });

    it("should filter by status", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/proposals?status=pending`)
        .set("Cookie", proposerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((p: { status: string }) => p.status === "PENDING")).toBe(true);
    });

    it("should return 403 when user is not a member", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/proposals`);

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/proposals/:proposalId
  // =====================================
  describe("GET /api/proposals/:proposalId", () => {
    let proposalId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Detail Proposal",
          proposedContent: "Detail content",
        });
      proposalId = createRes.body.id;
    });

    it("should return proposal details", async () => {
      const res = await request(app)
        .get(`/api/proposals/${proposalId}`)
        .set("Cookie", proposerCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(proposalId);
      expect(res.body.proposedTitle).toBe("Detail Proposal");
      expect(res.body.proposer).toBeDefined();
      expect(res.body.recipe).toBeDefined();
    });

    it("should return 403 when user is not a member of the community", async () => {
      const res = await request(app)
        .get(`/api/proposals/${proposalId}`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 when proposal not found", async () => {
      const res = await request(app)
        .get(`/api/proposals/00000000-0000-0000-0000-000000000000`)
        .set("Cookie", proposerCookie);

      expect(res.status).toBe(404);
    });
  });

  // =====================================
  // POST /api/proposals/:proposalId/accept
  // =====================================
  describe("POST /api/proposals/:proposalId/accept", () => {
    let proposalId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Accepted Proposal",
          proposedContent: "Accepted content",
        });
      proposalId = createRes.body.id;
    });

    it("should accept a proposal and update the recipe", async () => {
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACCEPTED");
      expect(res.body.decidedAt).toBeDefined();

      // Verify the community recipe was updated
      const recipeRes = await request(app)
        .get(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", recipeCreatorCookie);

      expect(recipeRes.body.title).toBe("Accepted Proposal");
      expect(recipeRes.body.content).toBe("Accepted content");
    });

    it("should cascade to personal recipe", async () => {
      await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      // Verify the personal recipe was updated
      const personalRes = await request(app)
        .get(`/api/recipes/${personalRecipeId}`)
        .set("Cookie", recipeCreatorCookie);

      expect(personalRes.body.title).toBe("Accepted Proposal");
      expect(personalRes.body.content).toBe("Accepted content");
    });

    it("should cascade to other community copies", async () => {
      const suffix = uniqueSuffix();

      // Create another community
      const community2Res = await request(app)
        .post("/api/communities")
        .set("Cookie", recipeCreatorCookie)
        .send({ name: `Second Community ${suffix}` });
      const community2 = community2Res.body;

      // Create another community recipe linked to the same personal recipe
      const recipe2 = await testPrisma.recipe.create({
        data: {
          title: "Original Recipe",
          content: "Original content for the recipe",
          creatorId: recipeCreator.id,
          communityId: community2.id,
          originRecipeId: personalRecipeId,
        },
      });

      // Accept the proposal
      await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      // Verify the second community recipe was also updated
      const recipe2Updated = await testPrisma.recipe.findUnique({
        where: { id: recipe2.id },
      });

      expect(recipe2Updated?.title).toBe("Accepted Proposal");
      expect(recipe2Updated?.content).toBe("Accepted content");
    });

    it("should return 403 when user is not the recipe creator", async () => {
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", proposerCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("RECIPE_002");
    });

    it("should return 409 when recipe was modified since proposal (PROPOSAL_003)", async () => {
      // Modify the recipe after the proposal was created
      await request(app)
        .patch(`/api/recipes/${communityRecipeId}`)
        .set("Cookie", recipeCreatorCookie)
        .send({ title: "Modified after proposal" });

      const res = await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("PROPOSAL_003");
    });

    it("should return 400 when proposal is already decided (PROPOSAL_002)", async () => {
      // Accept the proposal first
      await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      // Try to accept again
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("PROPOSAL_002");
    });

    it("should create an activity log entry", async () => {
      await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      const log = await testPrisma.activityLog.findFirst({
        where: {
          type: "PROPOSAL_ACCEPTED",
          communityId: community.id,
          recipeId: communityRecipeId,
          userId: recipeCreator.id,
        },
      });

      expect(log).not.toBeNull();
      expect(log?.metadata).toHaveProperty("proposalId", proposalId);
    });

    it("should return 404 when proposal not found", async () => {
      const res = await request(app)
        .post(`/api/proposals/00000000-0000-0000-0000-000000000000/accept`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(404);
    });
  });

  // =====================================
  // POST /api/proposals/:proposalId/reject
  // =====================================
  describe("POST /api/proposals/:proposalId/reject", () => {
    let proposalId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Rejected Proposal",
          proposedContent: "Rejected content",
        });
      proposalId = createRes.body.id;
    });

    it("should reject a proposal and create a variant", async () => {
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/reject`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.proposal.status).toBe("REJECTED");
      expect(res.body.proposal.decidedAt).toBeDefined();
      expect(res.body.variant).toBeDefined();
      expect(res.body.variant.isVariant).toBe(true);
      expect(res.body.variant.title).toBe("Rejected Proposal");
      expect(res.body.variant.content).toBe("Rejected content");
    });

    it("should set the variant creatorId to the proposer", async () => {
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/reject`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.variant.creatorId).toBe(proposer.id);
    });

    it("should set originRecipeId to the target recipe", async () => {
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/reject`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.variant.originRecipeId).toBe(communityRecipeId);
    });

    it("should return 403 when user is not the recipe creator", async () => {
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/reject`)
        .set("Cookie", proposerCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("RECIPE_002");
    });

    it("should return 400 when proposal is already decided", async () => {
      // Reject the proposal first
      await request(app)
        .post(`/api/proposals/${proposalId}/reject`)
        .set("Cookie", recipeCreatorCookie);

      // Try to reject again
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/reject`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("PROPOSAL_002");
    });

    it("should create an activity log entry for variant creation", async () => {
      const res = await request(app)
        .post(`/api/proposals/${proposalId}/reject`)
        .set("Cookie", recipeCreatorCookie);

      const log = await testPrisma.activityLog.findFirst({
        where: {
          type: "VARIANT_CREATED",
          communityId: community.id,
          recipeId: res.body.variant.id,
          userId: proposer.id,
        },
      });

      expect(log).not.toBeNull();
      expect(log?.metadata).toHaveProperty("proposalId", proposalId);
      expect(log?.metadata).toHaveProperty("originRecipeId", communityRecipeId);
    });

    it("should return 404 when proposal not found", async () => {
      const res = await request(app)
        .post(`/api/proposals/00000000-0000-0000-0000-000000000000/reject`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(404);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Variants API", () => {
  let recipeCreator: { id: string; username: string; email: string };
  let recipeCreatorCookie: string;
  let member: { id: string; username: string; email: string };
  let memberCookie: string;
  let _nonMember: { id: string; username: string; email: string };
  let nonMemberCookie: string;
  let community: { id: string; name: string };
  let communityRecipeId: string;

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create recipe creator (moderator) via signup
    const creatorSignup = await request(app).post("/api/auth/signup").send({
      username: `varcreator_${suffix}`,
      email: `varcreator_${suffix}@example.com`,
      password: "Test123!Password",
    });
    recipeCreatorCookie = extractSessionCookie(creatorSignup)!;
    recipeCreator = (await testPrisma.user.findFirst({
      where: { email: `varcreator_${suffix}@example.com` },
    }))!;

    // Create community
    const createRes = await request(app)
      .post("/api/communities")
      .set("Cookie", recipeCreatorCookie)
      .send({ name: `Variant Community ${suffix}` });
    community = createRes.body;

    // Create member via signup
    const memberSignup = await request(app).post("/api/auth/signup").send({
      username: `varmem_${suffix}`,
      email: `varmem_${suffix}@example.com`,
      password: "Test123!Password",
    });
    memberCookie = extractSessionCookie(memberSignup)!;
    member = (await testPrisma.user.findFirst({
      where: { email: `varmem_${suffix}@example.com` },
    }))!;

    // Add member to community
    await testPrisma.userCommunity.create({
      data: {
        userId: member.id,
        communityId: community.id,
        role: "MEMBER",
      },
    });

    // Create non-member via signup
    const nonMemberSignup = await request(app).post("/api/auth/signup").send({
      username: `varnonm_${suffix}`,
      email: `varnonm_${suffix}@example.com`,
      password: "Test123!Password",
    });
    nonMemberCookie = extractSessionCookie(nonMemberSignup)!;
    _nonMember = (await testPrisma.user.findFirst({
      where: { email: `varnonm_${suffix}@example.com` },
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
  });

  // =====================================
  // GET /api/recipes/:recipeId/variants
  // =====================================
  describe("GET /api/recipes/:recipeId/variants", () => {
    it("should return empty array when no variants exist", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it("should return variants created from rejected proposals", async () => {
      // Create a proposal
      const proposalRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", memberCookie)
        .send({
          proposedTitle: "Variant Title",
          proposedContent: "Variant content",
        });

      // Reject the proposal (creates a variant)
      await request(app)
        .post(`/api/proposals/${proposalRes.body.id}/reject`)
        .set("Cookie", recipeCreatorCookie);

      // Get variants
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Variant Title");
      expect(res.body.data[0].isVariant).toBe(true);
      expect(res.body.data[0].originRecipeId).toBe(communityRecipeId);
      expect(res.body.data[0].creatorId).toBe(member.id);
    });

    it("should include creator info in variants", async () => {
      // Create and reject a proposal
      const proposalRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", memberCookie)
        .send({
          proposedTitle: "Variant with Creator",
          proposedContent: "Content",
        });

      await request(app)
        .post(`/api/proposals/${proposalRes.body.id}/reject`)
        .set("Cookie", recipeCreatorCookie);

      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data[0].creator).toBeDefined();
      expect(res.body.data[0].creator.id).toBe(member.id);
      expect(res.body.data[0].creator.username).toBeDefined();
    });

    it("should allow any community member to view variants", async () => {
      // Create and reject a proposal
      const proposalRes = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", memberCookie)
        .send({
          proposedTitle: "Member Visible Variant",
          proposedContent: "Content",
        });

      await request(app)
        .post(`/api/proposals/${proposalRes.body.id}/reject`)
        .set("Cookie", recipeCreatorCookie);

      // Member (not the recipe creator) should be able to view variants
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("RECIPE_002");
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .get(`/api/recipes/00000000-0000-0000-0000-000000000000/variants`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("RECIPE_001");
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`);

      expect(res.status).toBe(401);
    });

    it("should sort variants by most recent activity (MAX of createdAt, updatedAt)", async () => {
      // Create first variant
      const proposal1 = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", memberCookie)
        .send({
          proposedTitle: "First Variant",
          proposedContent: "Content 1",
        });

      await request(app)
        .post(`/api/proposals/${proposal1.body.id}/reject`)
        .set("Cookie", recipeCreatorCookie);

      // Create second variant (should be more recent)
      const proposal2 = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", memberCookie)
        .send({
          proposedTitle: "Second Variant",
          proposedContent: "Content 2",
        });

      await request(app)
        .post(`/api/proposals/${proposal2.body.id}/reject`)
        .set("Cookie", recipeCreatorCookie);

      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      // Second variant should come first (most recent)
      expect(res.body.data[0].title).toBe("Second Variant");
      expect(res.body.data[1].title).toBe("First Variant");
    });

    it("should respect pagination parameters", async () => {
      // Create 3 variants
      for (let i = 1; i <= 3; i++) {
        const proposal = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", memberCookie)
          .send({
            proposedTitle: `Variant ${i}`,
            proposedContent: `Content ${i}`,
          });

        await request(app)
          .post(`/api/proposals/${proposal.body.id}/reject`)
          .set("Cookie", recipeCreatorCookie);
      }

      // Get with limit=2
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants?limit=2`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.hasMore).toBe(true);

      // Get second page
      const res2 = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants?limit=2&offset=2`)
        .set("Cookie", recipeCreatorCookie);

      expect(res2.status).toBe(200);
      expect(res2.body.data).toHaveLength(1);
      expect(res2.body.pagination.hasMore).toBe(false);
    });

    it("should only return variants from the same community", async () => {
      const suffix = uniqueSuffix();

      // Create another community
      const community2Res = await request(app)
        .post("/api/communities")
        .set("Cookie", recipeCreatorCookie)
        .send({ name: `Second Community ${suffix}` });
      const community2 = community2Res.body;

      // Create a variant in the original community
      const proposal = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", memberCookie)
        .send({
          proposedTitle: "Community 1 Variant",
          proposedContent: "Content",
        });

      await request(app)
        .post(`/api/proposals/${proposal.body.id}/reject`)
        .set("Cookie", recipeCreatorCookie);

      // Create a variant directly in community2 (bypassing normal flow for test)
      await testPrisma.recipe.create({
        data: {
          title: "Community 2 Variant",
          content: "Different community content",
          creatorId: recipeCreator.id,
          communityId: community2.id,
          originRecipeId: communityRecipeId,
          isVariant: true,
        },
      });

      // Get variants - should only see the one from community 1
      const res = await request(app)
        .get(`/api/recipes/${communityRecipeId}/variants`)
        .set("Cookie", recipeCreatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Community 1 Variant");
    });
  });
});

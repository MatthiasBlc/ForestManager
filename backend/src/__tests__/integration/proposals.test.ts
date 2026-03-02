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
        servings: 4,
        steps: [{ instruction: "Original step for the recipe" }],
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
          proposedSteps: [{ instruction: "Better step for the recipe" }],
        });

      expect(res.status).toBe(201);
      expect(res.body.proposedTitle).toBe("Improved Recipe");
      expect(res.body.proposedSteps).toHaveLength(1);
      expect(res.body.proposedSteps[0].instruction).toBe("Better step for the recipe");
      expect(res.body.status).toBe("PENDING");
      expect(res.body.proposerId).toBe(proposer.id);
      expect(res.body.recipeId).toBe(communityRecipeId);
    });

    it("should create proposal with servings and times", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "With servings",
          proposedServings: 8,
          proposedPrepTime: 15,
          proposedCookTime: 30,
          proposedRestTime: 10,
          proposedSteps: [{ instruction: "Step" }],
        });

      expect(res.status).toBe(201);
      expect(res.body.proposedServings).toBe(8);
      expect(res.body.proposedPrepTime).toBe(15);
      expect(res.body.proposedCookTime).toBe(30);
      expect(res.body.proposedRestTime).toBe(10);
    });

    it("should return 403 when user is not a member", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", nonMemberCookie)
        .send({
          proposedTitle: "Hacked Recipe",
          proposedSteps: [{ instruction: "Hacked step" }],
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
          proposedSteps: [{ instruction: "Self step" }],
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
          proposedSteps: [{ instruction: "Step for personal" }],
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
          proposedSteps: [{ instruction: "Ghost step" }],
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("RECIPE_001");
    });

    it("should return 400 when title is missing", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedSteps: [{ instruction: "Step without title" }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_003");
    });

    it("should return 400 when steps is missing", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Title without steps",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_007");
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .send({
          proposedTitle: "Unauthorized",
          proposedSteps: [{ instruction: "Step" }],
        });

      expect(res.status).toBe(401);
    });

    it("should create an activity log entry", async () => {
      const res = await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Logged Proposal",
          proposedSteps: [{ instruction: "Logged step" }],
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
          proposedSteps: [{ instruction: "Step 1" }],
        });

      await request(app)
        .post(`/api/recipes/${communityRecipeId}/proposals`)
        .set("Cookie", proposerCookie)
        .send({
          proposedTitle: "Proposal 2",
          proposedSteps: [{ instruction: "Step 2" }],
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
          proposedSteps: [{ instruction: "Detail step" }],
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
      expect(res.body.proposedSteps).toHaveLength(1);
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
          proposedServings: 6,
          proposedPrepTime: 10,
          proposedSteps: [{ instruction: "Accepted step" }],
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
      expect(recipeRes.body.servings).toBe(6);
      expect(recipeRes.body.prepTime).toBe(10);
      expect(recipeRes.body.steps).toHaveLength(1);
      expect(recipeRes.body.steps[0].instruction).toBe("Accepted step");
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
      expect(personalRes.body.servings).toBe(6);
      expect(personalRes.body.steps).toHaveLength(1);
      expect(personalRes.body.steps[0].instruction).toBe("Accepted step");
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
          servings: 4,
          creatorId: recipeCreator.id,
          communityId: community2.id,
          originRecipeId: personalRecipeId,
          steps: {
            create: [{ order: 0, instruction: "Original step for the recipe" }],
          },
        },
      });

      // Accept the proposal
      await request(app)
        .post(`/api/proposals/${proposalId}/accept`)
        .set("Cookie", recipeCreatorCookie);

      // Verify the second community recipe was also updated
      const recipe2Updated = await testPrisma.recipe.findUnique({
        where: { id: recipe2.id },
        include: { steps: { orderBy: { order: "asc" } } },
      });

      expect(recipe2Updated?.title).toBe("Accepted Proposal");
      expect(recipe2Updated?.servings).toBe(6);
      expect(recipe2Updated?.steps).toHaveLength(1);
      expect(recipe2Updated?.steps[0].instruction).toBe("Accepted step");
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
          proposedServings: 8,
          proposedSteps: [{ instruction: "Rejected step" }],
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
      expect(res.body.variant.servings).toBe(8);

      // Verify the variant has the proposed steps
      const variantSteps = await testPrisma.recipeStep.findMany({
        where: { recipeId: res.body.variant.id },
        orderBy: { order: "asc" },
      });
      expect(variantSteps).toHaveLength(1);
      expect(variantSteps[0].instruction).toBe("Rejected step");
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

  // =====================================
  // Phase 11.4 - Proposals + Ingredients
  // =====================================
  describe("Proposals with proposedIngredients (Phase 11.4)", () => {
    // ---- Creation avec ingredients ----
    describe("POST /api/recipes/:recipeId/proposals with proposedIngredients", () => {
      it("should store proposedIngredients in the proposal", async () => {
        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Recipe with ingredients",
            proposedSteps: [{ instruction: "Step with ingredients" }],
            proposedIngredients: [
              { name: "Farine", quantity: 200 },
              { name: "Sucre", quantity: 100 },
            ],
          });

        expect(res.status).toBe(201);
        expect(res.body.proposedIngredients).toBeDefined();
        expect(res.body.proposedIngredients).toHaveLength(2);
        expect(res.body.proposedIngredients[0].ingredient.name).toBe("farine");
        expect(res.body.proposedIngredients[0].quantity).toBe(200);
        expect(res.body.proposedIngredients[1].ingredient.name).toBe("sucre");
      });

      it("should create PENDING ingredient when new name is submitted", async () => {
        const suffix = uniqueSuffix();
        const newIngredientName = `ingredient_nouveau_${suffix}`;

        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Recipe with new ingredient",
            proposedSteps: [{ instruction: "Step" }],
            proposedIngredients: [{ name: newIngredientName, quantity: 1 }],
          });

        expect(res.status).toBe(201);

        const ingredient = await testPrisma.ingredient.findFirst({
          where: { name: newIngredientName.toLowerCase() },
        });
        expect(ingredient).not.toBeNull();
        expect(ingredient?.status).toBe("PENDING");
        expect(ingredient?.createdById).toBe(proposer.id);
      });

      it("should reuse existing ingredient without creating duplicate", async () => {
        const existingIngredient = await testPrisma.ingredient.create({
          data: { name: "ingredient_existant_reuse", status: "APPROVED" },
        });

        const countBefore = await testPrisma.ingredient.count({
          where: { name: "ingredient_existant_reuse" },
        });

        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Recipe reusing ingredient",
            proposedSteps: [{ instruction: "Step" }],
            proposedIngredients: [
              { name: existingIngredient.name, quantity: 3 },
            ],
          });

        expect(res.status).toBe(201);

        const countAfter = await testPrisma.ingredient.count({
          where: { name: "ingredient_existant_reuse" },
        });
        expect(countAfter).toBe(countBefore);
      });

      it("should return 400 when proposedIngredients exceeds 50", async () => {
        const tooManyIngredients = Array.from({ length: 51 }, (_, i) => ({
          name: `ingredient_limit_${i}`,
        }));

        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Too many ingredients",
            proposedSteps: [{ instruction: "Step" }],
            proposedIngredients: tooManyIngredients,
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("INGREDIENT_003");
      });

      it("should create proposal without ingredients when not provided", async () => {
        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "No ingredients",
            proposedSteps: [{ instruction: "Step" }],
          });

        expect(res.status).toBe(201);
        expect(res.body.proposedIngredients).toHaveLength(0);
      });

      it("should store unitId in ProposalIngredient when provided", async () => {
        const suffix = uniqueSuffix();
        const unit = await testPrisma.unit.create({
          data: {
            name: `gramme_test_${suffix}`,
            abbreviation: `g_${suffix}`,
            category: "WEIGHT",
            sortOrder: 1,
          },
        });

        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Recipe with unit",
            proposedSteps: [{ instruction: "Step" }],
            proposedIngredients: [
              { name: "Chocolat", quantity: 150, unitId: unit.id },
            ],
          });

        expect(res.status).toBe(201);
        expect(res.body.proposedIngredients[0].unitId).toBe(unit.id);
      });
    });

    // ---- Acceptation avec remplacement ingredients ----
    describe("POST /api/proposals/:proposalId/accept with proposedIngredients", () => {
      let proposalWithIngredientsId: string;

      beforeEach(async () => {
        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Recipe with new ingredients",
            proposedSteps: [{ instruction: "New step with ingredients" }],
            proposedIngredients: [
              { name: "Oeuf", quantity: 3 },
              { name: "Beurre", quantity: 50 },
            ],
          });
        proposalWithIngredientsId = res.body.id;
      });

      it("should replace RecipeIngredients when accepting a proposal with ingredients", async () => {
        const res = await request(app)
          .post(`/api/proposals/${proposalWithIngredientsId}/accept`)
          .set("Cookie", recipeCreatorCookie);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ACCEPTED");

        const recipeIngredients = await testPrisma.recipeIngredient.findMany({
          where: { recipeId: communityRecipeId },
          include: { ingredient: true },
          orderBy: { order: "asc" },
        });

        expect(recipeIngredients).toHaveLength(2);
        expect(recipeIngredients[0].ingredient.name).toBe("oeuf");
        expect(recipeIngredients[0].quantity).toBe(3);
        expect(recipeIngredients[1].ingredient.name).toBe("beurre");
        expect(recipeIngredients[1].quantity).toBe(50);
      });

      it("should propagate ingredient replacement to the personal recipe", async () => {
        await request(app)
          .post(`/api/proposals/${proposalWithIngredientsId}/accept`)
          .set("Cookie", recipeCreatorCookie);

        const personalIngredients = await testPrisma.recipeIngredient.findMany({
          where: { recipeId: personalRecipeId },
          include: { ingredient: true },
          orderBy: { order: "asc" },
        });

        expect(personalIngredients).toHaveLength(2);
        expect(personalIngredients[0].ingredient.name).toBe("oeuf");
        expect(personalIngredients[1].ingredient.name).toBe("beurre");
      });

      it("should not touch RecipeIngredients when proposal has no proposedIngredients", async () => {
        // Ajouter un ingredient a la recette communautaire d'abord
        const ingredient = await testPrisma.ingredient.create({
          data: { name: "ingredient_preserved", status: "APPROVED" },
        });
        await testPrisma.recipeIngredient.create({
          data: {
            recipeId: communityRecipeId,
            ingredientId: ingredient.id,
            quantity: 5,
            order: 0,
          },
        });

        // Creer un proposal sans ingredients
        const proposalRes = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Only title change",
            proposedSteps: [{ instruction: "Only step change" }],
          });

        // Contourner la contrainte updatedAt > createdAt
        await testPrisma.recipeUpdateProposal.update({
          where: { id: proposalRes.body.id },
          data: { createdAt: new Date(Date.now() + 1000) },
        });

        const acceptRes = await request(app)
          .post(`/api/proposals/${proposalRes.body.id}/accept`)
          .set("Cookie", recipeCreatorCookie);

        expect(acceptRes.status).toBe(200);

        // Les ingredients doivent etre preserves
        const ingredients = await testPrisma.recipeIngredient.findMany({
          where: { recipeId: communityRecipeId },
        });
        expect(ingredients).toHaveLength(1);
        expect(ingredients[0].ingredientId).toBe(ingredient.id);
      });
    });

    // ---- Rejet avec copie ingredients dans la variante ----
    describe("POST /api/proposals/:proposalId/reject with proposedIngredients", () => {
      it("should copy proposedIngredients to the variant's RecipeIngredients", async () => {
        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Rejected with ingredients",
            proposedSteps: [{ instruction: "Step" }],
            proposedIngredients: [
              { name: "Carotte", quantity: 2 },
              { name: "Poireau", quantity: 1 },
            ],
          });
        const proposalId = res.body.id;

        const rejectRes = await request(app)
          .post(`/api/proposals/${proposalId}/reject`)
          .set("Cookie", recipeCreatorCookie);

        expect(rejectRes.status).toBe(200);
        const variantId = rejectRes.body.variant.id;

        const variantIngredients = await testPrisma.recipeIngredient.findMany({
          where: { recipeId: variantId },
          include: { ingredient: true },
          orderBy: { order: "asc" },
        });

        expect(variantIngredients).toHaveLength(2);
        expect(variantIngredients[0].ingredient.name).toBe("carotte");
        expect(variantIngredients[0].quantity).toBe(2);
        expect(variantIngredients[1].ingredient.name).toBe("poireau");
        expect(variantIngredients[1].quantity).toBe(1);
      });

      it("should create variant without RecipeIngredients when proposal has no ingredients", async () => {
        const proposalRes = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "No ingredients proposal",
            proposedSteps: [{ instruction: "Step" }],
          });

        const rejectRes = await request(app)
          .post(`/api/proposals/${proposalRes.body.id}/reject`)
          .set("Cookie", recipeCreatorCookie);

        expect(rejectRes.status).toBe(200);
        const variantId = rejectRes.body.variant.id;

        const variantIngredients = await testPrisma.recipeIngredient.findMany({
          where: { recipeId: variantId },
        });
        expect(variantIngredients).toHaveLength(0);
      });
    });

    // ---- proposedIngredients dans les reponses GET ----
    describe("GET proposals responses include proposedIngredients", () => {
      let proposalId: string;

      beforeEach(async () => {
        const res = await request(app)
          .post(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie)
          .send({
            proposedTitle: "Proposal with ingredients",
            proposedSteps: [{ instruction: "Step" }],
            proposedIngredients: [{ name: "Tomate", quantity: 4 }],
          });
        proposalId = res.body.id;
      });

      it("GET /api/proposals/:id should include proposedIngredients", async () => {
        const res = await request(app)
          .get(`/api/proposals/${proposalId}`)
          .set("Cookie", proposerCookie);

        expect(res.status).toBe(200);
        expect(res.body.proposedIngredients).toBeDefined();
        expect(res.body.proposedIngredients).toHaveLength(1);
        expect(res.body.proposedIngredients[0].ingredient.name).toBe("tomate");
      });

      it("GET /api/recipes/:recipeId/proposals should include proposedIngredients", async () => {
        const res = await request(app)
          .get(`/api/recipes/${communityRecipeId}/proposals`)
          .set("Cookie", proposerCookie);

        expect(res.status).toBe(200);
        const proposal = res.body.data.find((p: { id: string }) => p.id === proposalId);
        expect(proposal).toBeDefined();
        expect(proposal.proposedIngredients).toHaveLength(1);
        expect(proposal.proposedIngredients[0].ingredient.name).toBe("tomate");
      });
    });
  });
});

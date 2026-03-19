import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { testPrisma } from "../setup/globalSetup";
import { extractSessionCookie } from "../setup/testHelpers";

describe("Meal Ideas API", () => {
  let moderator: { id: string };
  let moderatorCookie: string;
  let member: { id: string };
  let memberCookie: string;
  let otherMember: { id: string };
  let otherMemberCookie: string;
  let nonMember: { id: string };
  let nonMemberCookie: string;
  let communityId: string;
  let recipeId: string;

  beforeEach(async () => {
    const suffix = Date.now();

    // Moderateur
    const modSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `mi_mod_${suffix}`,
        email: `mi_mod_${suffix}@example.com`,
        password: "Test123!Password",
      });
    moderatorCookie = extractSessionCookie(modSignup)!;
    moderator = (await testPrisma.user.findFirst({
      where: { email: `mi_mod_${suffix}@example.com` },
    }))!;

    // Communaute
    const comRes = await request(app)
      .post("/api/communities")
      .set("Cookie", moderatorCookie)
      .send({ name: `MealIdeas Community ${suffix}` });
    communityId = comRes.body.id;

    // Feature MEAL_PLAN
    let mealPlanFeature = await testPrisma.feature.findFirst({ where: { code: "MEAL_PLAN" } });
    if (!mealPlanFeature) {
      mealPlanFeature = await testPrisma.feature.create({
        data: { code: "MEAL_PLAN", name: "Planning de repas", isDefault: false },
      });
    }
    await testPrisma.communityFeature.create({
      data: { communityId, featureId: mealPlanFeature.id },
    });

    // Membre
    const memSuffix = suffix + 1;
    const memSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `mi_mem_${memSuffix}`,
        email: `mi_mem_${memSuffix}@example.com`,
        password: "Test123!Password",
      });
    memberCookie = extractSessionCookie(memSignup)!;
    member = (await testPrisma.user.findFirst({
      where: { email: `mi_mem_${memSuffix}@example.com` },
    }))!;
    await testPrisma.userCommunity.create({
      data: { userId: member.id, communityId, role: "MEMBER" },
    });

    // Autre membre
    const otherMemSuffix = suffix + 2;
    const otherMemSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `mi_om_${otherMemSuffix}`,
        email: `mi_om_${otherMemSuffix}@example.com`,
        password: "Test123!Password",
      });
    otherMemberCookie = extractSessionCookie(otherMemSignup)!;
    otherMember = (await testPrisma.user.findFirst({
      where: { email: `mi_om_${otherMemSuffix}@example.com` },
    }))!;
    await testPrisma.userCommunity.create({
      data: { userId: otherMember.id, communityId, role: "MEMBER" },
    });

    // Non-membre
    const nmSuffix = suffix + 3;
    const nmSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `mi_nm_${nmSuffix}`,
        email: `mi_nm_${nmSuffix}@example.com`,
        password: "Test123!Password",
      });
    nonMemberCookie = extractSessionCookie(nmSignup)!;
    nonMember = (await testPrisma.user.findFirst({
      where: { email: `mi_nm_${nmSuffix}@example.com` },
    }))!;

    // Recette communautaire
    const recipe = await testPrisma.recipe.create({
      data: {
        title: `Recipe for Ideas ${suffix}`,
        creatorId: moderator.id,
        communityId,
        steps: { create: [{ order: 0, instruction: "Step 1" }] },
      },
    });
    recipeId = recipe.id;
  });

  // ===================================
  // GET /meal-ideas
  // ===================================
  describe("GET /meal-ideas", () => {
    it("should return empty list when no ideas", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it("should return paginated list of ideas", async () => {
      // Create some ideas
      await testPrisma.mealIdea.createMany({
        data: [
          { communityId, name: "Pizza maison", createdById: member.id },
          { communityId, name: "Salade cesar", createdById: moderator.id },
          { communityId, name: "Pates carbo", createdById: member.id },
        ],
      });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination.total).toBe(3);
    });

    it("should search by name", async () => {
      await testPrisma.mealIdea.createMany({
        data: [
          { communityId, name: "Pizza maison", createdById: member.id },
          { communityId, name: "Pizza margherita", createdById: member.id },
          { communityId, name: "Salade cesar", createdById: moderator.id },
        ],
      });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-ideas?search=pizza`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("should not return deleted ideas", async () => {
      await testPrisma.mealIdea.create({
        data: {
          communityId,
          name: "Deleted idea",
          createdById: member.id,
          deletedAt: new Date(),
        },
      });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });
  });

  // ===================================
  // POST /meal-ideas
  // ===================================
  describe("POST /meal-ideas", () => {
    it("should create an idea with name only", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie)
        .send({ name: "Nouvelle idee" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Nouvelle idee");
      expect(res.body.comment).toBeNull();
      expect(res.body.recipe).toBeNull();
      expect(res.body.createdBy.id).toBe(member.id);
    });

    it("should create an idea with comment", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie)
        .send({ name: "Idee avec commentaire", comment: "A essayer ce weekend" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Idee avec commentaire");
      expect(res.body.comment).toBe("A essayer ce weekend");
    });

    it("should create an idea linked to a recipe", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie)
        .send({ name: "Idee recette", recipeId });

      expect(res.status).toBe(201);
      expect(res.body.recipe).not.toBeNull();
      expect(res.body.recipe.id).toBe(recipeId);
    });

    it("should return 404 for recipe not in community", async () => {
      const personalRecipe = await testPrisma.recipe.create({
        data: {
          title: "Personal Recipe",
          creatorId: member.id,
          steps: { create: [{ order: 0, instruction: "Step" }] },
        },
      });

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie)
        .send({ name: "Bad idea", recipeId: personalRecipe.id });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_004");
    });

    it("should return 400 for empty name", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", memberCookie)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-ideas`)
        .set("Cookie", nonMemberCookie)
        .send({ name: "Test" });

      expect(res.status).toBe(403);
    });
  });

  // ===================================
  // PATCH /meal-ideas/:ideaId
  // ===================================
  describe("PATCH /meal-ideas/:ideaId", () => {
    let ideaId: string;

    beforeEach(async () => {
      const idea = await testPrisma.mealIdea.create({
        data: { communityId, name: "Original name", createdById: member.id },
      });
      ideaId = idea.id;
    });

    it("should update name (creator)", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", memberCookie)
        .send({ name: "Updated name" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated name");
    });

    it("should update comment (creator)", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", memberCookie)
        .send({ comment: "New comment" });

      expect(res.status).toBe(200);
      expect(res.body.comment).toBe("New comment");
    });

    it("should set recipeId (creator)", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", memberCookie)
        .send({ recipeId });

      expect(res.status).toBe(200);
      expect(res.body.recipe.id).toBe(recipeId);
    });

    it("should clear recipeId with null", async () => {
      // First set recipeId
      await testPrisma.mealIdea.update({
        where: { id: ideaId },
        data: { recipeId },
      });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", memberCookie)
        .send({ recipeId: null });

      expect(res.status).toBe(200);
      expect(res.body.recipe).toBeNull();
    });

    it("should allow moderator to update any idea", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Mod updated" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Mod updated");
    });

    it("should return 403 for other member", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", otherMemberCookie)
        .send({ name: "Hacked!" });

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent idea", async () => {
      const res = await request(app)
        .patch(
          `/api/communities/${communityId}/meal-ideas/00000000-0000-4000-8000-000000000000`
        )
        .set("Cookie", memberCookie)
        .send({ name: "Test" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_006");
    });

    it("should return 404 for deleted idea", async () => {
      await testPrisma.mealIdea.update({
        where: { id: ideaId },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", memberCookie)
        .send({ name: "Test" });

      expect(res.status).toBe(404);
    });
  });

  // ===================================
  // DELETE /meal-ideas/:ideaId
  // ===================================
  describe("DELETE /meal-ideas/:ideaId", () => {
    let ideaId: string;

    beforeEach(async () => {
      const idea = await testPrisma.mealIdea.create({
        data: { communityId, name: "Idea to delete", createdById: member.id },
      });
      ideaId = idea.id;
    });

    it("should soft delete (creator)", async () => {
      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(204);

      const idea = await testPrisma.mealIdea.findUnique({ where: { id: ideaId } });
      expect(idea!.deletedAt).not.toBeNull();
    });

    it("should allow moderator to delete any idea", async () => {
      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(204);
    });

    it("should return 403 for other member", async () => {
      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", otherMemberCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent idea", async () => {
      const res = await request(app)
        .delete(
          `/api/communities/${communityId}/meal-ideas/00000000-0000-4000-8000-000000000000`
        )
        .set("Cookie", memberCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_006");
    });

    it("should return 404 for already deleted idea", async () => {
      await testPrisma.mealIdea.update({
        where: { id: ideaId },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-ideas/${ideaId}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(404);
    });
  });

  // ===================================
  // Feature guard
  // ===================================
  describe("Feature guard", () => {
    it("should return 403 when MEAL_PLAN feature is disabled", async () => {
      // Create community without feature
      const comRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `No Feature Community ${Date.now()}` });

      const res = await request(app)
        .get(`/api/communities/${comRes.body.id}/meal-ideas`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("MEAL_005");
    });
  });
});

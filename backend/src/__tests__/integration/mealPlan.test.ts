/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { testPrisma } from "../setup/globalSetup";
import { createMealTestContext, extractSessionCookie, MealTestContext } from "../setup/testHelpers";

describe("Meal Plan API", () => {
  let ctx: MealTestContext;
  let moderatorCookie: string;
  let memberCookie: string;
  let nonMemberCookie: string;
  let communityId: string;
  let recipe1Id: string;
  let _recipe2Id: string;

  beforeEach(async () => {
    const suffix = Date.now();
    ctx = await createMealTestContext("mp");
    moderatorCookie = ctx.moderatorCookie;
    memberCookie = ctx.memberCookie;
    communityId = ctx.communityId;

    // Non-membre (specifique a ce test)
    const nmSuffix = suffix + 2;
    const nmSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `mp_nm_${nmSuffix}`,
        email: `mp_nm_${nmSuffix}@example.com`,
        password: "Test123!Password",
      });
    nonMemberCookie = extractSessionCookie(nmSignup)!;

    // Recettes communautaires
    const r1 = await testPrisma.recipe.create({
      data: {
        title: `Recipe 1 ${suffix}`,
        creatorId: ctx.moderator.id,
        communityId,
        steps: { create: [{ order: 0, instruction: "Step 1" }] },
      },
    });
    recipe1Id = r1.id;

    const r2 = await testPrisma.recipe.create({
      data: {
        title: `Recipe 2 ${suffix}`,
        creatorId: ctx.moderator.id,
        communityId,
        steps: { create: [{ order: 0, instruction: "Step 1" }] },
      },
    });
    _recipe2Id = r2.id;
  });

  // ===================================
  // GET /meal-plan
  // ===================================
  describe("GET /meal-plan", () => {
    it("should return null when no active plan", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.plan).toBeNull();
    });

    it("should return the active plan with slots", async () => {
      // Create plan first
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08", defaultServings: 3 });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.plan).not.toBeNull();
      expect(res.body.plan.slots).toHaveLength(6); // 3 days x 2 meals
      expect(res.body.plan.defaultServings).toBe(3);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });
  });

  // ===================================
  // POST /meal-plan
  // ===================================
  describe("POST /meal-plan", () => {
    it("should create a plan with slots", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-12", defaultServings: 4 });

      expect(res.status).toBe(201);
      expect(res.body.plan.slots).toHaveLength(14); // 7 days x 2
      expect(res.body.plan.status).toBe("ACTIVE");
      expect(res.body.plan.defaultServings).toBe(4);
    });

    it("should create slots with disabled from disabledSlots", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({
          startDate: "2026-04-06",
          endDate: "2026-04-08",
          disabledSlots: [
            { date: "2026-04-06", mealTime: "LUNCH" },
            { date: "2026-04-07", mealTime: "DINNER" },
          ],
        });

      expect(res.status).toBe(201);
      const disabledSlots = res.body.plan.slots.filter((s: any) => s.disabled);
      expect(disabledSlots).toHaveLength(2);
    });

    it("should auto-archive existing active plan", async () => {
      // Create first plan
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-03-01", endDate: "2026-03-07" });

      // Create second plan (different dates)
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-12" });

      expect(res.status).toBe(201);

      // Check the first plan is now archived
      const plans = await testPrisma.mealPlan.findMany({
        where: { communityId },
        orderBy: { createdAt: "asc" },
      });
      expect(plans).toHaveLength(2);
      expect(plans[0].status).toBe("ARCHIVED");
      expect(plans[1].status).toBe("ACTIVE");
    });

    it("should copy disabled pattern from previous plan", async () => {
      // Create and archive first plan with disabled Wednesday slots
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({
          startDate: "2026-03-02", // Monday
          endDate: "2026-03-08", // Sunday
          disabledSlots: [
            { date: "2026-03-04", mealTime: "LUNCH" }, // Wednesday
            { date: "2026-03-04", mealTime: "DINNER" }, // Wednesday
          ],
        });

      // Create second plan with copyDisabledFromPrevious
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({
          startDate: "2026-04-06", // Monday
          endDate: "2026-04-12", // Sunday
          copyDisabledFromPrevious: true,
        });

      expect(res.status).toBe(201);
      const disabledSlots = res.body.plan.slots.filter((s: any) => s.disabled);
      // Wednesday 2026-04-08 LUNCH + DINNER should be disabled
      expect(disabledSlots).toHaveLength(2);
      expect(disabledSlots.every((s: any) => s.date.includes("2026-04-08"))).toBe(true);
    });

    it("should return 400 when startDate > endDate", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-12", endDate: "2026-04-06" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_009");
    });

    it("should return 400 when duration exceeds 31 days", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-01", endDate: "2026-05-15" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_008");
    });

    it("should return 403 for member (not moderator)", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", memberCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-12" });

      expect(res.status).toBe(403);
    });
  });

  // ===================================
  // DELETE /meal-plan
  // ===================================
  describe("DELETE /meal-plan", () => {
    it("should delete active plan and cascade slots", async () => {
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(204);

      // Verify plan is gone
      const plans = await testPrisma.mealPlan.findMany({ where: { communityId } });
      expect(plans).toHaveLength(0);
    });

    it("should return 404 when no active plan", async () => {
      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_001");
    });

    it("should return 403 for member", async () => {
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });
  });

  // ===================================
  // PATCH /meal-plan
  // ===================================
  describe("PATCH /meal-plan", () => {
    it("should update defaultServings", async () => {
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ defaultServings: 6 });

      expect(res.status).toBe(200);
      expect(res.body.plan.defaultServings).toBe(6);
    });

    it("should update editableByMembers", async () => {
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ editableByMembers: true });

      expect(res.status).toBe(200);
      expect(res.body.plan.editableByMembers).toBe(true);
    });

    it("should return 404 when no active plan", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ defaultServings: 6 });

      expect(res.status).toBe(404);
    });
  });

  // ===================================
  // PATCH /meal-plan/slots/:slotId
  // ===================================
  describe("PATCH /meal-plan/slots/:slotId", () => {
    let slotId: string;

    beforeEach(async () => {
      const planRes = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });
      slotId = planRes.body.plan.slots[0].id;
    });

    it("should set slot to RECIPE type", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "RECIPE", recipeId: recipe1Id });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("RECIPE");
      expect(res.body.recipe.id).toBe(recipe1Id);
    });

    it("should set slot to FREE_TEXT type", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "FREE_TEXT", freeText: "Resto japonais", comment: "Reserver" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("FREE_TEXT");
      expect(res.body.freeText).toBe("Resto japonais");
      expect(res.body.comment).toBe("Reserver");
    });

    it("should reset slot to EMPTY", async () => {
      // First set to FREE_TEXT
      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "FREE_TEXT", freeText: "Test" });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "EMPTY" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("EMPTY");
      expect(res.body.freeText).toBeNull();
      expect(res.body.comment).toBeNull();
      expect(res.body.recipe).toBeNull();
    });

    it("should auto-enable disabled slot when setting content", async () => {
      // Disable the slot first
      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ disabled: true });

      // Set recipe on disabled slot
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "RECIPE", recipeId: recipe1Id });

      expect(res.status).toBe(200);
      expect(res.body.disabled).toBe(false);
      expect(res.body.type).toBe("RECIPE");
    });

    it("should update servings independently", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ servings: 8 });

      expect(res.status).toBe(200);
      expect(res.body.servings).toBe(8);
    });

    it("should toggle locked", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ locked: true });

      expect(res.status).toBe(200);
      expect(res.body.locked).toBe(true);
    });

    it("should return 404 for recipe not in community", async () => {
      // Create a personal recipe (not in community)
      const personalRecipe = await testPrisma.recipe.create({
        data: {
          title: "Personal Recipe",
          creatorId: ctx.moderator.id,
          steps: { create: [{ order: 0, instruction: "Step" }] },
        },
      });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "RECIPE", recipeId: personalRecipe.id });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_004");
    });

    it("should return 403 for member when editableByMembers is false", async () => {
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", memberCookie)
        .send({ servings: 6 });

      expect(res.status).toBe(403);
    });

    it("should allow member when editableByMembers is true", async () => {
      // Enable editableByMembers
      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ editableByMembers: true });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotId}`)
        .set("Cookie", memberCookie)
        .send({ servings: 6 });

      expect(res.status).toBe(200);
      expect(res.body.servings).toBe(6);
    });
  });

  // ===================================
  // POST /meal-plan/slots/swap
  // ===================================
  describe("POST /meal-plan/slots/swap", () => {
    let slotAId: string;
    let slotBId: string;

    beforeEach(async () => {
      const planRes = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      slotAId = planRes.body.plan.slots[0].id;
      slotBId = planRes.body.plan.slots[1].id;

      // Fill slotA with recipe
      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotAId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "RECIPE", recipeId: recipe1Id });

      // Fill slotB with free text
      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotBId}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "FREE_TEXT", freeText: "Test swap" });
    });

    it("should swap content between two slots", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/swap`)
        .set("Cookie", moderatorCookie)
        .send({ slotIdA: slotAId, slotIdB: slotBId });

      expect(res.status).toBe(200);
      expect(res.body.slotA.type).toBe("FREE_TEXT");
      expect(res.body.slotA.freeText).toBe("Test swap");
      expect(res.body.slotB.type).toBe("RECIPE");
      expect(res.body.slotB.recipe.id).toBe(recipe1Id);
    });

    it("should return 400 when swapping slot with itself", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/swap`)
        .set("Cookie", moderatorCookie)
        .send({ slotIdA: slotAId, slotIdB: slotAId });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_007");
    });

    it("should return 400 when swapping with disabled slot", async () => {
      // Disable slotB
      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${slotBId}`)
        .set("Cookie", moderatorCookie)
        .send({ disabled: true });

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/swap`)
        .set("Cookie", moderatorCookie)
        .send({ slotIdA: slotAId, slotIdB: slotBId });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_013");
    });

    it("should return 403 for member when editableByMembers is false", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/swap`)
        .set("Cookie", memberCookie)
        .send({ slotIdA: slotAId, slotIdB: slotBId });

      expect(res.status).toBe(403);
    });
  });

  // ===================================
  // Archive non-editable
  // ===================================
  describe("Archived plan non-editable", () => {
    it("should return 400 when updating slot on archived plan", async () => {
      // Create plan 1
      const plan1Res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-03-01", endDate: "2026-03-03" });
      const archivedSlotId = plan1Res.body.plan.slots[0].id;

      // Create plan 2 (archives plan 1)
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      // Try to update slot from archived plan
      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${archivedSlotId}`)
        .set("Cookie", moderatorCookie)
        .send({ servings: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_011");
    });
  });

  // ===================================
  // GET /meal-plan/archives
  // ===================================
  describe("GET /meal-plan/archives", () => {
    it("should return empty list when no archives", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan/archives`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it("should return paginated archives with slot counts", async () => {
      // Create plan 1 (will become archive)
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-03-01", endDate: "2026-03-03" });

      // Create plan 2 (archives plan 1)
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan/archives`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].totalSlots).toBe(6); // 3 days x 2
      expect(res.body.pagination.total).toBe(1);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan/archives`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });
  });

  // ===================================
  // GET /meal-plan/archives/:planId
  // ===================================
  describe("GET /meal-plan/archives/:planId", () => {
    it("should return archive detail with slots", async () => {
      // Create plan 1
      const plan1Res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-03-01", endDate: "2026-03-03" });
      const plan1Id = plan1Res.body.plan.id;

      // Archive it by creating plan 2
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan/archives/${plan1Id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.plan.id).toBe(plan1Id);
      expect(res.body.plan.status).toBe("ARCHIVED");
      expect(res.body.plan.slots).toHaveLength(6);
    });

    it("should return 404 for active plan id", async () => {
      const planRes = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan/archives/${planRes.body.plan.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_012");
    });

    it("should return 404 for non-existent plan", async () => {
      const res = await request(app)
        .get(
          `/api/communities/${communityId}/meal-plan/archives/00000000-0000-4000-8000-000000000000`
        )
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
    });
  });

  // ===================================
  // DELETE /meal-plan/archives/:planId
  // ===================================
  describe("DELETE /meal-plan/archives/:planId", () => {
    it("should delete an archive (MODERATOR)", async () => {
      // Create plan 1 then archive it
      const plan1Res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-03-01", endDate: "2026-03-03" });
      const plan1Id = plan1Res.body.plan.id;

      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-plan/archives/${plan1Id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(204);

      // Verify archive is gone
      const plan = await testPrisma.mealPlan.findUnique({ where: { id: plan1Id } });
      expect(plan).toBeNull();
    });

    it("should return 403 for member", async () => {
      const plan1Res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-03-01", endDate: "2026-03-03" });
      const plan1Id = plan1Res.body.plan.id;

      await request(app)
        .post(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie)
        .send({ startDate: "2026-04-06", endDate: "2026-04-08" });

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-plan/archives/${plan1Id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent archive", async () => {
      const res = await request(app)
        .delete(
          `/api/communities/${communityId}/meal-plan/archives/00000000-0000-4000-8000-000000000000`
        )
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_012");
    });
  });
});

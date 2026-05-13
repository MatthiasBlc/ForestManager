/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { testPrisma } from "../setup/globalSetup";
import { createMealTestContext, MealTestContext } from "../setup/testHelpers";

describe("Meal Generation API", () => {
  let ctx: MealTestContext;
  let moderatorCookie: string;
  let memberCookie: string;
  let communityId: string;
  let _recipe1Id: string;
  let _recipe2Id: string;
  let recipe3Id: string;
  let tag1Id: string;
  let tag2Id: string;
  let paramsId: string;
  let _planId: string;

  beforeEach(async () => {
    const suffix = Date.now();
    ctx = await createMealTestContext("mg");
    moderatorCookie = ctx.moderatorCookie;
    memberCookie = ctx.memberCookie;
    communityId = ctx.communityId;

    // Donnees specifiques a ce test
    const t1 = await testPrisma.tag.create({
      data: { name: `italien_${suffix}`, status: "APPROVED" },
    });
    tag1Id = t1.id;
    const t2 = await testPrisma.tag.create({
      data: { name: `dessert_${suffix}`, status: "APPROVED" },
    });
    tag2Id = t2.id;

    const r1 = await testPrisma.recipe.create({
      data: {
        title: `Pasta ${suffix}`,
        creatorId: ctx.moderator.id,
        communityId,
        steps: { create: [{ order: 0, instruction: "Cook pasta" }] },
        tags: { create: [{ tagId: tag1Id }] },
      },
    });
    _recipe1Id = r1.id;

    const r2 = await testPrisma.recipe.create({
      data: {
        title: `Pizza ${suffix}`,
        creatorId: ctx.moderator.id,
        communityId,
        steps: { create: [{ order: 0, instruction: "Make pizza" }] },
        tags: { create: [{ tagId: tag1Id }] },
      },
    });
    _recipe2Id = r2.id;

    const r3 = await testPrisma.recipe.create({
      data: {
        title: `Cake ${suffix}`,
        creatorId: ctx.moderator.id,
        communityId,
        steps: { create: [{ order: 0, instruction: "Bake cake" }] },
        tags: { create: [{ tagId: tag2Id }] },
      },
    });
    recipe3Id = r3.id;

    const params = await testPrisma.mealGenerationParams.create({
      data: {
        communityId,
        name: "Standard",
        cooldownDays: 0,
        useIdeas: false,
        isDefault: true,
      },
    });
    paramsId = params.id;

    const planRes = await request(app)
      .post(`/api/communities/${communityId}/meal-plan`)
      .set("Cookie", moderatorCookie)
      .send({ startDate: "2026-04-06", endDate: "2026-04-08", defaultServings: 4 });
    _planId = planRes.body.plan.id;
  });

  // ===================================
  // POST /meal-plan/generate
  // ===================================
  describe("POST /meal-plan/generate", () => {
    it("should generate a full plan", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      expect(res.status).toBe(200);
      expect(res.body.plan).toBeDefined();
      expect(res.body.report).toBeDefined();
      expect(res.body.report.slotsGenerated).toBe(6);
      expect(res.body.report.slotsSkipped.excluded).toBe(0);

      // Tous les slots doivent etre remplis
      const filledSlots = res.body.plan.slots.filter((s: any) => s.type === "RECIPE");
      expect(filledSlots.length).toBe(6);
    });

    it("should respect fillEmptyOnly", async () => {
      // D'abord generer
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      // Vider un slot manuellement
      const planRes = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);
      const firstSlot = planRes.body.plan.slots[0];

      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${firstSlot.id}`)
        .set("Cookie", moderatorCookie)
        .send({ type: "EMPTY" });

      // Re-generer avec fillEmptyOnly
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: true });

      expect(res.status).toBe(200);
      expect(res.body.report.slotsGenerated).toBe(1);
      expect(res.body.report.slotsSkipped.alreadyFilled).toBe(5);
    });

    it("should respect locked slots", async () => {
      // Verrouiller le premier slot
      const planRes = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);
      const firstSlot = planRes.body.plan.slots[0];

      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${firstSlot.id}`)
        .set("Cookie", moderatorCookie)
        .send({ locked: true });

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      expect(res.status).toBe(200);
      expect(res.body.report.slotsGenerated).toBe(5);
      expect(res.body.report.slotsSkipped.locked).toBe(1);
    });

    it("should respect exclusions", async () => {
      // Exclure le lundi midi (2026-04-06 = Monday)
      await testPrisma.mealSlotExclusion.create({
        data: { paramsId, day: "MON", mealTime: "LUNCH" },
      });

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      expect(res.status).toBe(200);
      expect(res.body.report.slotsGenerated).toBe(5);
      expect(res.body.report.slotsSkipped.excluded).toBe(1);
    });

    it("should return 404 if no active plan", async () => {
      // Supprimer le plan
      await request(app)
        .delete(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_GEN_002");
    });

    it("should return 404 if params not found", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId: "00000000-0000-4000-8000-000000000000", fillEmptyOnly: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_GEN_001");
    });

    it("should return 403 for non-moderator", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", memberCookie)
        .send({ paramsId, fillEmptyOnly: false });

      expect(res.status).toBe(403);
    });

    it("should include report with warnings for pool exhausted", async () => {
      // Supprimer toutes les recettes (soft delete)
      await testPrisma.recipe.updateMany({
        where: { communityId },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      expect(res.status).toBe(200);
      expect(res.body.report.slotsEmpty).toBe(6);
      expect(res.body.report.warnings.length).toBeGreaterThan(0);
      expect(res.body.report.warnings[0].type).toBe("POOL_EXHAUSTED");
    });

    it("should use generation rules (pin)", async () => {
      // Epingler lundi midi sur tag dessert → seule recipe3 (Cake) doit etre choisie
      await testPrisma.mealSlotPin.create({
        data: { paramsId, day: "MON", mealTime: "LUNCH", tagId: tag2Id },
      });

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      expect(res.status).toBe(200);
      // Le premier slot (lundi midi) doit avoir le Cake (tag2 = dessert)
      const mondayLunch = res.body.plan.slots.find(
        (s: any) =>
          s.mealTime === "LUNCH" && new Date(s.date).toISOString().startsWith("2026-04-06")
      );
      expect(mondayLunch.recipeId).toBe(recipe3Id);
    });
  });

  // ===================================
  // POST /meal-plan/slots/:slotId/replace
  // ===================================
  describe("POST /meal-plan/slots/:slotId/replace", () => {
    it("should replace a slot with a different recipe", async () => {
      // D'abord generer
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      const planRes = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);
      const firstSlot = planRes.body.plan.slots[0];
      const originalRecipeId = firstSlot.recipeId;

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/${firstSlot.id}/replace`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId });

      expect(res.status).toBe(200);
      expect(res.body.slot).toBeDefined();
      expect(res.body.report).toBeDefined();
      // La recette doit avoir change (elle etait exclue du pool)
      expect(res.body.slot.recipeId).not.toBe(originalRecipeId);
    });

    it("should refuse to replace a locked slot", async () => {
      // Generer puis verrouiller
      await request(app)
        .post(`/api/communities/${communityId}/meal-plan/generate`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId, fillEmptyOnly: false });

      const planRes = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);
      const firstSlot = planRes.body.plan.slots[0];

      await request(app)
        .patch(`/api/communities/${communityId}/meal-plan/slots/${firstSlot.id}`)
        .set("Cookie", moderatorCookie)
        .send({ locked: true });

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/${firstSlot.id}/replace`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_008");
    });

    it("should refuse to replace an excluded slot", async () => {
      // Exclure lundi midi
      await testPrisma.mealSlotExclusion.create({
        data: { paramsId, day: "MON", mealTime: "LUNCH" },
      });

      const planRes = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);
      // Premier slot = lundi midi
      const mondayLunch = planRes.body.plan.slots.find(
        (s: any) =>
          s.mealTime === "LUNCH" && new Date(s.date).toISOString().startsWith("2026-04-06")
      );

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/${mondayLunch.id}/replace`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_007");
    });

    it("should return 403 for non-moderator", async () => {
      const planRes = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);
      const firstSlot = planRes.body.plan.slots[0];

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/${firstSlot.id}/replace`)
        .set("Cookie", memberCookie)
        .send({ paramsId });

      expect(res.status).toBe(403);
    });

    it("should return 404 for invalid params", async () => {
      const planRes = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);
      const firstSlot = planRes.body.plan.slots[0];

      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-plan/slots/${firstSlot.id}/replace`)
        .set("Cookie", moderatorCookie)
        .send({ paramsId: "00000000-0000-4000-8000-000000000000" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_GEN_001");
    });
  });

  // ===================================
  // GET /meal-plan — hasDefaultGenerationParams
  // ===================================
  describe("hasDefaultGenerationParams flag", () => {
    it("should return true when default params exist", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.hasDefaultGenerationParams).toBe(true);
    });

    it("should return false when no default params", async () => {
      // Supprimer le jeu par defaut
      await testPrisma.mealGenerationParams.update({
        where: { id: paramsId },
        data: { isDefault: false },
      });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.hasDefaultGenerationParams).toBe(false);
    });

    it("should return false when default params are soft-deleted", async () => {
      await testPrisma.mealGenerationParams.update({
        where: { id: paramsId },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-plan`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.hasDefaultGenerationParams).toBe(false);
    });
  });
});

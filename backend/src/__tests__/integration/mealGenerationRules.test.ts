import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { testPrisma } from "../setup/globalSetup";
import { createMealTestContext, MealTestContext } from "../setup/testHelpers";

describe("Meal Generation Exclusions, Rules & Pins API", () => {
  let ctx: MealTestContext;
  let moderatorCookie: string;
  let memberCookie: string;
  let communityId: string;
  let paramsId: string;
  let tagId1: string;
  let tagId2: string;
  let recipeId: string;

  beforeEach(async () => {
    const suffix = Date.now();
    ctx = await createMealTestContext("mgr");
    moderatorCookie = ctx.moderatorCookie;
    memberCookie = ctx.memberCookie;
    communityId = ctx.communityId;

    // Donnees specifiques a ce test
    const tag1 = await testPrisma.tag.create({
      data: { name: `tag_a_${suffix}`, scope: "GLOBAL" },
    });
    const tag2 = await testPrisma.tag.create({
      data: { name: `tag_b_${suffix}`, scope: "GLOBAL" },
    });
    tagId1 = tag1.id;
    tagId2 = tag2.id;

    const recipe = await testPrisma.recipe.create({
      data: {
        title: `Test Recipe ${suffix}`,
        communityId,
        creatorId: ctx.moderator.id,
        servings: 4,
      },
    });
    recipeId = recipe.id;

    const paramsRes = await request(app)
      .post(`/api/communities/${communityId}/meal-generation-params`)
      .set("Cookie", moderatorCookie)
      .send({ name: "Standard" });
    paramsId = paramsRes.body.id;
  });

  const base = () => `/api/communities/${communityId}/meal-generation-params/${paramsId}`;

  // =============================================
  // PUT Exclusions
  // =============================================
  describe("PUT .../exclusions", () => {
    it("should set exclusions", async () => {
      const res = await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({
          exclusions: [
            { day: "WED", mealTime: "LUNCH" },
            { day: "WED", mealTime: "DINNER" },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].day).toBe("WED");
    });

    it("should replace all exclusions on second call", async () => {
      await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [{ day: "WED", mealTime: "LUNCH" }] });

      const res = await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [{ day: "FRI", mealTime: "DINNER" }] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].day).toBe("FRI");
    });

    it("should clear all exclusions with empty array", async () => {
      await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [{ day: "MON", mealTime: "LUNCH" }] });

      const res = await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 403 for member", async () => {
      const res = await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", memberCookie)
        .send({ exclusions: [] });

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent params", async () => {
      const res = await request(app)
        .put(
          `/api/communities/${communityId}/meal-generation-params/00000000-0000-4000-8000-000000000000/exclusions`
        )
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [] });

      expect(res.status).toBe(404);
    });
  });

  // =============================================
  // Rules CRUD
  // =============================================
  describe("POST .../rules (create)", () => {
    it("should create a tag rule", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.5 });

      expect(res.status).toBe(201);
      expect(res.body.tagId).toBe(tagId1);
      expect(res.body.weight).toBe(1.5);
      expect(res.body.tag).toBeTruthy();
      expect(res.body.recipe).toBeNull();
    });

    it("should create a recipe rule", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ recipeId, weight: 1.8 });

      expect(res.status).toBe(201);
      expect(res.body.recipeId).toBe(recipeId);
      expect(res.body.recipe).toBeTruthy();
    });

    it("should create a tag rule with frequency constraints", async () => {
      const res = await request(app).post(`${base()}/rules`).set("Cookie", moderatorCookie).send({
        tagId: tagId1,
        weight: 1.0,
        frequencyMin: 2,
        frequencyMax: 4,
        frequencyPer: "PER_WEEK",
        tagCooldownDays: 2,
      });

      expect(res.status).toBe(201);
      expect(res.body.frequencyMin).toBe(2);
      expect(res.body.frequencyMax).toBe(4);
      expect(res.body.frequencyPer).toBe("PER_WEEK");
      expect(res.body.tagCooldownDays).toBe(2);
    });

    it("should create a tag rule with mealTimeConstraint", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0, mealTimeConstraint: "DINNER" });

      expect(res.status).toBe(201);
      expect(res.body.mealTimeConstraint).toBe("DINNER");
    });

    it("should return 400 when neither tagId nor recipeId", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ weight: 1.0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_003");
    });

    it("should return 400 when both tagId and recipeId", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, recipeId, weight: 1.0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_003");
    });

    it("should return 400 when weight > 2.0", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 2.5 });

      expect(res.status).toBe(400);
    });

    it("should return 400 when weight < 0", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: -0.5 });

      expect(res.status).toBe(400);
    });

    it("should return 400 when frequency constraints on recipe rule (MEAL_GEN_009)", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ recipeId, weight: 1.0, frequencyMin: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_009");
    });

    it("should return 400 when tagCooldownDays on recipe rule (MEAL_GEN_011)", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ recipeId, weight: 1.0, tagCooldownDays: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_011");
    });

    it("should return 400 when frequencyMin > frequencyMax (MEAL_GEN_010)", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0, frequencyMin: 5, frequencyMax: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_010");
    });

    it("should return 403 for member", async () => {
      const res = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", memberCookie)
        .send({ tagId: tagId1, weight: 1.0 });

      expect(res.status).toBe(403);
    });
  });

  describe("GET .../rules (list)", () => {
    it("should list rules for member", async () => {
      await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.5 });

      await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ recipeId, weight: 0.5 });

      const res = await request(app).get(`${base()}/rules`).set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe("PATCH .../rules/:ruleId (update)", () => {
    it("should update rule weight", async () => {
      const createRes = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0 });

      const res = await request(app)
        .patch(`${base()}/rules/${createRes.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({ weight: 0.5 });

      expect(res.status).toBe(200);
      expect(res.body.weight).toBe(0.5);
    });

    it("should update frequency constraints on tag rule", async () => {
      const createRes = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0 });

      const res = await request(app)
        .patch(`${base()}/rules/${createRes.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({ frequencyMin: 1, frequencyMax: 3, frequencyPer: "PER_PLANNING" });

      expect(res.status).toBe(200);
      expect(res.body.frequencyMin).toBe(1);
      expect(res.body.frequencyMax).toBe(3);
      expect(res.body.frequencyPer).toBe("PER_PLANNING");
    });

    it("should return 400 when adding frequency to recipe rule", async () => {
      const createRes = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ recipeId, weight: 1.0 });

      const res = await request(app)
        .patch(`${base()}/rules/${createRes.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({ frequencyMin: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_009");
    });

    it("should return 400 when frequencyMin > frequencyMax after merge", async () => {
      const createRes = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0, frequencyMax: 2 });

      const res = await request(app)
        .patch(`${base()}/rules/${createRes.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({ frequencyMin: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_010");
    });

    it("should return 404 for non-existent rule", async () => {
      const res = await request(app)
        .patch(`${base()}/rules/00000000-0000-4000-8000-000000000000`)
        .set("Cookie", moderatorCookie)
        .send({ weight: 0.5 });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("MEAL_GEN_006");
    });

    it("should return 403 for member", async () => {
      const createRes = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0 });

      const res = await request(app)
        .patch(`${base()}/rules/${createRes.body.id}`)
        .set("Cookie", memberCookie)
        .send({ weight: 0.5 });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE .../rules/:ruleId (hard delete)", () => {
    it("should delete rule", async () => {
      const createRes = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0 });

      const res = await request(app)
        .delete(`${base()}/rules/${createRes.body.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(204);

      // Verify it's gone
      const listRes = await request(app).get(`${base()}/rules`).set("Cookie", moderatorCookie);
      expect(listRes.body.data).toHaveLength(0);
    });

    it("should return 404 for non-existent rule", async () => {
      const res = await request(app)
        .delete(`${base()}/rules/00000000-0000-4000-8000-000000000000`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
    });

    it("should return 403 for member", async () => {
      const createRes = await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.0 });

      const res = await request(app)
        .delete(`${base()}/rules/${createRes.body.id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });
  });

  // =============================================
  // PUT Pins
  // =============================================
  describe("PUT .../pins", () => {
    it("should set pins", async () => {
      const res = await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({
          pins: [{ day: "FRI", mealTime: "DINNER", tagId: tagId1 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].day).toBe("FRI");
      expect(res.body.data[0].tag.id).toBe(tagId1);
    });

    it("should replace all pins on second call", async () => {
      await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({ pins: [{ day: "FRI", mealTime: "DINNER", tagId: tagId1 }] });

      const res = await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({ pins: [{ day: "SAT", mealTime: "LUNCH", tagId: tagId2 }] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].day).toBe("SAT");
    });

    it("should clear pins with empty array", async () => {
      await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({ pins: [{ day: "FRI", mealTime: "DINNER", tagId: tagId1 }] });

      const res = await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({ pins: [] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 400 when pin conflicts with exclusion (MEAL_GEN_012)", async () => {
      // Set exclusion on WED LUNCH
      await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [{ day: "WED", mealTime: "LUNCH" }] });

      // Try to pin WED LUNCH
      const res = await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({ pins: [{ day: "WED", mealTime: "LUNCH", tagId: tagId1 }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("MEAL_GEN_012");
    });

    it("should allow pin on non-excluded slot even if others are excluded", async () => {
      await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [{ day: "WED", mealTime: "LUNCH" }] });

      const res = await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({ pins: [{ day: "FRI", mealTime: "DINNER", tagId: tagId1 }] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("should return 403 for member", async () => {
      const res = await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", memberCookie)
        .send({ pins: [] });

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent tag in pin", async () => {
      const res = await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({
          pins: [{ day: "FRI", mealTime: "DINNER", tagId: "00000000-0000-4000-8000-000000000000" }],
        });

      expect(res.status).toBe(404);
    });
  });

  // =============================================
  // Integration: detail includes all sub-resources
  // =============================================
  describe("GET .../detail includes exclusions, rules, pins", () => {
    it("should return all sub-resources in detail", async () => {
      // Set exclusions
      await request(app)
        .put(`${base()}/exclusions`)
        .set("Cookie", moderatorCookie)
        .send({ exclusions: [{ day: "WED", mealTime: "LUNCH" }] });

      // Add rule
      await request(app)
        .post(`${base()}/rules`)
        .set("Cookie", moderatorCookie)
        .send({ tagId: tagId1, weight: 1.5 });

      // Set pins
      await request(app)
        .put(`${base()}/pins`)
        .set("Cookie", moderatorCookie)
        .send({ pins: [{ day: "FRI", mealTime: "DINNER", tagId: tagId2 }] });

      const res = await request(app).get(base()).set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.exclusions).toHaveLength(1);
      expect(res.body.rules).toHaveLength(1);
      expect(res.body.slotPins).toHaveLength(1);
    });
  });
});

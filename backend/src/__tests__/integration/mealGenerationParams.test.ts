import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { createMealTestContext, extractSessionCookie, MealTestContext } from "../setup/testHelpers";

describe("Meal Generation Params API", () => {
  let ctx: MealTestContext;
  let nonMemberCookie: string;
  let moderatorCookie: string;
  let memberCookie: string;
  let communityId: string;

  beforeEach(async () => {
    ctx = await createMealTestContext("mgp");
    moderatorCookie = ctx.moderatorCookie;
    memberCookie = ctx.memberCookie;
    communityId = ctx.communityId;

    // Non-membre (specifique a ce test)
    const nmSuffix = Date.now() + 2;
    const nmSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `mgp_nm_${nmSuffix}`,
        email: `mgp_nm_${nmSuffix}@example.com`,
        password: "Test123!Password",
      });
    nonMemberCookie = extractSessionCookie(nmSignup)!;
  });

  // =============================================
  // POST - Create params
  // =============================================
  describe("POST /api/communities/:communityId/meal-generation-params", () => {
    it("should create params as moderator", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({
          name: "Standard",
          description: "Jeu par defaut",
          cooldownDays: 3,
          useIdeas: true,
          isDefault: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Standard");
      expect(res.body.description).toBe("Jeu par defaut");
      expect(res.body.cooldownDays).toBe(3);
      expect(res.body.useIdeas).toBe(true);
      expect(res.body.isDefault).toBe(true);
      expect(res.body.exclusions).toEqual([]);
      expect(res.body.rules).toEqual([]);
      expect(res.body.slotPins).toEqual([]);
    });

    it("should create params with defaults when optional fields omitted", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Minimal" });

      expect(res.status).toBe(201);
      expect(res.body.cooldownDays).toBe(3);
      expect(res.body.useIdeas).toBe(true);
      expect(res.body.isDefault).toBe(false);
    });

    it("should return 403 for member (not moderator)", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", memberCookie)
        .send({ name: "Test" });

      expect(res.status).toBe(403);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", nonMemberCookie)
        .send({ name: "Test" });

      expect(res.status).toBe(403);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .send({ name: "Test" });

      expect(res.status).toBe(401);
    });

    it("should return 400 when name is missing", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 400 when name exceeds 100 chars", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "a".repeat(101) });

      expect(res.status).toBe(400);
    });

    it("should return 400 when description exceeds 500 chars", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Test", description: "a".repeat(501) });

      expect(res.status).toBe(400);
    });

    it("should return 400 when cooldownDays is negative", async () => {
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Test", cooldownDays: -1 });

      expect(res.status).toBe(400);
    });

    it("should unset previous default when creating a new default", async () => {
      // Create first default
      await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "First", isDefault: true });

      // Create second default
      const res = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Second", isDefault: true });

      expect(res.status).toBe(201);
      expect(res.body.isDefault).toBe(true);

      // Check the list - only one should be default
      const listRes = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie);

      const defaults = listRes.body.data.filter((p: any) => p.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe("Second");
    });
  });

  // =============================================
  // GET - List params
  // =============================================
  describe("GET /api/communities/:communityId/meal-generation-params", () => {
    it("should list params for member", async () => {
      // Create some params
      await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Standard" });

      await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Ete" });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("should not list soft-deleted params", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "ToDelete" });

      await request(app)
        .delete(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie);

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
    });
  });

  // =============================================
  // GET - Detail params
  // =============================================
  describe("GET /api/communities/:communityId/meal-generation-params/:paramsId", () => {
    it("should return params detail with exclusions, rules, pins", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Standard" });

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.name).toBe("Standard");
      expect(res.body).toHaveProperty("exclusions");
      expect(res.body).toHaveProperty("rules");
      expect(res.body).toHaveProperty("slotPins");
    });

    it("should return 404 for non-existent params", async () => {
      const res = await request(app)
        .get(
          `/api/communities/${communityId}/meal-generation-params/00000000-0000-4000-8000-000000000000`
        )
        .set("Cookie", memberCookie);

      expect(res.status).toBe(404);
    });

    it("should return 404 for soft-deleted params", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Deleted" });

      await request(app)
        .delete(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie);

      const res = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(404);
    });
  });

  // =============================================
  // PATCH - Update params
  // =============================================
  describe("PATCH /api/communities/:communityId/meal-generation-params/:paramsId", () => {
    it("should update params as moderator", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Original" });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Updated", cooldownDays: 5, useIdeas: false });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated");
      expect(res.body.cooldownDays).toBe(5);
      expect(res.body.useIdeas).toBe(false);
    });

    it("should unset previous default when setting isDefault to true", async () => {
      const first = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "First", isDefault: true });

      const second = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Second" });

      await request(app)
        .patch(`/api/communities/${communityId}/meal-generation-params/${second.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({ isDefault: true });

      // Verify first is no longer default
      const firstDetail = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params/${first.body.id}`)
        .set("Cookie", moderatorCookie);

      expect(firstDetail.body.isDefault).toBe(false);
    });

    it("should return 403 for member (not moderator)", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Test" });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", memberCookie)
        .send({ name: "Nope" });

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent params", async () => {
      const res = await request(app)
        .patch(
          `/api/communities/${communityId}/meal-generation-params/00000000-0000-4000-8000-000000000000`
        )
        .set("Cookie", moderatorCookie)
        .send({ name: "Nope" });

      expect(res.status).toBe(404);
    });

    it("should return 400 when no fields provided", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Test" });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should allow setting description to null", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Test", description: "Some description" });

      const res = await request(app)
        .patch(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.description).toBeNull();
    });
  });

  // =============================================
  // DELETE - Soft delete params
  // =============================================
  describe("DELETE /api/communities/:communityId/meal-generation-params/:paramsId", () => {
    it("should soft delete params as moderator", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "ToDelete" });

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(204);

      // Verify it's not in the list
      const listRes = await request(app)
        .get(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie);
      expect(listRes.body.data).toHaveLength(0);
    });

    it("should return 403 for member (not moderator)", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Test" });

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent params", async () => {
      const res = await request(app)
        .delete(
          `/api/communities/${communityId}/meal-generation-params/00000000-0000-4000-8000-000000000000`
        )
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
    });

    it("should return 404 for already deleted params", async () => {
      const createRes = await request(app)
        .post(`/api/communities/${communityId}/meal-generation-params`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Test" });

      await request(app)
        .delete(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie);

      const res = await request(app)
        .delete(`/api/communities/${communityId}/meal-generation-params/${createRes.body.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
    });
  });
});

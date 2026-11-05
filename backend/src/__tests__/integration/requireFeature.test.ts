import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { testPrisma } from "../setup/globalSetup";
import { createTestFeature, extractSessionCookie } from "../setup/testHelpers";

describe("requireFeature middleware", () => {
  let _moderator: { id: string };
  let moderatorCookie: string;
  let member: { id: string };
  let _memberCookie: string;
  let communityId: string;
  let _feature: { id: string; code: string };

  beforeEach(async () => {
    // Creer moderateur via signup pour avoir une session
    const modSuffix = Date.now();
    const modSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `feat_mod_${modSuffix}`,
        email: `feat_mod_${modSuffix}@example.com`,
        password: "Test123!Password",
      });
    moderatorCookie = extractSessionCookie(modSignup)!;
    _moderator = (await testPrisma.user.findFirst({
      where: { email: `feat_mod_${modSuffix}@example.com` },
    }))!;

    // Creer communaute
    const comRes = await request(app)
      .post("/api/communities")
      .set("Cookie", moderatorCookie)
      .send({ name: `Feature Test Community ${modSuffix}` });
    communityId = comRes.body.id;

    // Creer membre
    const memSuffix = Date.now() + 1;
    const memSignup = await request(app)
      .post("/api/auth/signup")
      .send({
        username: `feat_mem_${memSuffix}`,
        email: `feat_mem_${memSuffix}@example.com`,
        password: "Test123!Password",
      });
    _memberCookie = extractSessionCookie(memSignup)!;
    member = (await testPrisma.user.findFirst({
      where: { email: `feat_mem_${memSuffix}@example.com` },
    }))!;

    // Ajouter membre a la communaute
    await testPrisma.userCommunity.create({
      data: { userId: member.id, communityId, role: "MEMBER" },
    });

    // Creer feature MEAL_PLAN
    _feature = await createTestFeature({ code: `MEAL_PLAN_${modSuffix}` });
  });

  it("should return 403 when feature is not granted to the community", async () => {
    // La feature existe mais n'est pas attribuee a la communaute
    // On teste via un endpoint meal-plan (qui utilise requireFeature)
    const res = await request(app)
      .get(`/api/communities/${communityId}/meal-plan`)
      .set("Cookie", moderatorCookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("MEAL_005");
  });

  it("should allow access when feature is granted", async () => {
    // Attribuer la feature MEAL_PLAN a la communaute
    // On doit utiliser la vraie feature MEAL_PLAN, pas notre feature de test
    const mealPlanFeature = await testPrisma.feature.findFirst({
      where: { code: "MEAL_PLAN" },
    });

    // Si la feature n'existe pas en DB test, la creer
    const featureId = mealPlanFeature
      ? mealPlanFeature.id
      : (await createTestFeature({ code: "MEAL_PLAN", name: "Planning de repas" })).id;

    await testPrisma.communityFeature.create({
      data: { communityId, featureId },
    });

    const res = await request(app)
      .get(`/api/communities/${communityId}/meal-plan`)
      .set("Cookie", moderatorCookie);

    // Devrait passer le middleware requireFeature (200 ou 404, pas 403)
    expect(res.status).not.toBe(403);
  });

  it("should return 403 when feature is revoked", async () => {
    const mealPlanFeature = await testPrisma.feature.findFirst({
      where: { code: "MEAL_PLAN" },
    });
    const featureId = mealPlanFeature
      ? mealPlanFeature.id
      : (await createTestFeature({ code: "MEAL_PLAN", name: "Planning de repas" })).id;

    // Attribuer puis revoquer
    await testPrisma.communityFeature.create({
      data: { communityId, featureId, revokedAt: new Date() },
    });

    const res = await request(app)
      .get(`/api/communities/${communityId}/meal-plan`)
      .set("Cookie", moderatorCookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("MEAL_005");
  });
});

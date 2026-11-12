// Admin, C4.2 : file des demandes d'acces aux modules (A03, A03b) et catalogue (A04) [D33, D85].
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { createAdmin, loginAdmin, type TestAdmin } from "./helpers/admin.ts";
import { db } from "./helpers/db.ts";
import { createSpace, createUser, grantModule } from "./helpers/factories.ts";

const app = createTestApp();
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

let admin: TestAdmin;
/** Une seule connexion : un code TOTP ne sert qu'une fois (D174). */
let client: Client;
let initialStatuses: { code: string; status: "AVAILABLE" | "BETA" | "COMING_SOON" | "RETIRED" }[];
beforeAll(async () => {
  admin = await createAdmin();
  client = await loginAdmin(admin, app);
  initialStatuses = await db.module.findMany({ select: { code: true, status: true } });
});

// Le catalogue n'est pas vide entre deux fichiers de test : on rend les statuts d'origine.
afterAll(async () => {
  for (const { code, status } of initialStatuses) {
    await db.module.update({ where: { code }, data: { status } });
  }
});

async function lastAudit() {
  return db.adminAuditLog.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: "desc" },
  });
}

/** Espace groupe dont l'OWNER demande le Planning (passe en BETA pour etre demandable). */
async function pendingRequest(message = "Pour nos menus de la semaine") {
  await db.module.update({ where: { code: "meal-plan" }, data: { status: "BETA" } });
  const owner = await createUser();
  const space = await createSpace(owner.id, { name: "Colloc" });
  const asOwner = await loginAs(owner, app);
  const res = await asOwner.post(`/spaces/${space.id}/modules/meal-plan/requests`, { message });
  expect(res.status).toBe(201);
  return { owner, space, asOwner, requestId: res.body.id as string };
}

describe("acces aux routes", () => {
  it("toutes les routes de C4.2 demandent une session admin complete", async () => {
    const anonymous = await createClient(app);
    const calls = [
      anonymous.get("/admin/module-requests"),
      anonymous.post(`/admin/module-requests/${UNKNOWN}/approve`),
      anonymous.post(`/admin/module-requests/${UNKNOWN}/reject`, { note: "non" }),
      anonymous.get("/admin/modules"),
      anonymous.patch("/admin/modules/meal-plan", { status: "BETA" }),
      anonymous.get("/admin/modules/meal-plan/spaces"),
      anonymous.post("/admin/modules/meal-plan/grants", { spaceId: UNKNOWN }),
      anonymous.delete(`/admin/modules/meal-plan/grants/${UNKNOWN}`),
      anonymous.get("/admin/spaces/lookup?query=co"),
    ];
    for (const res of await Promise.all(calls)) expect(res.body.error.code).toBe("ADMIN_002");
  });
});

describe("file des demandes", () => {
  it("liste les demandes en attente avec l'espace, le demandeur et le message", async () => {
    const { owner, space, requestId } = await pendingRequest();
    const res = await client.get("/admin/module-requests");
    expect(res.status).toBe(200);
    expect(res.body.pending).toContainEqual(
      expect.objectContaining({
        id: requestId,
        moduleCode: "meal-plan",
        status: "PENDING",
        message: "Pour nos menus de la semaine",
        space: { id: space.id, name: "Colloc", tintIndex: space.tintIndex },
        requestedBy: { username: owner.username },
      })
    );
  });

  it("accorder : l'espace a acces, l'OWNER active quand il veut ; audit", async () => {
    const { space, asOwner, requestId } = await pendingRequest();
    const res = await client.post(`/admin/module-requests/${requestId}/approve`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "APPROVED", decidedAt: expect.any(String) });

    const grant = await db.spaceModule.findUniqueOrThrow({
      where: { spaceId_moduleCode: { spaceId: space.id, moduleCode: "meal-plan" } },
    });
    expect(grant).toMatchObject({ revokedAt: null, enabled: false, grantedByAdminId: admin.id });
    const catalog = await asOwner.get(`/spaces/${space.id}/modules`);
    expect(catalog.body.data).toContainEqual(
      expect.objectContaining({ code: "meal-plan", granted: true, enabled: false })
    );
    expect(await lastAudit()).toMatchObject({
      action: "module-request.approved",
      targetType: "ModuleAccessRequest",
      targetId: requestId,
      data: { spaceId: space.id, moduleCode: "meal-plan" },
    });

    // Une demande deja traitee ne se traite pas deux fois.
    const again = await client.post(`/admin/module-requests/${requestId}/approve`);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe("ADMIN_006");
  });

  it("refuser : motif obligatoire, visible par l'OWNER ; audit ; historique", async () => {
    const { space, asOwner, requestId } = await pendingRequest();
    const empty = await client.post(`/admin/module-requests/${requestId}/reject`, { note: " " });
    expect(empty.body.error.code).toBe("VALIDATION_001");

    const res = await client.post(`/admin/module-requests/${requestId}/reject`, {
      note: "Le Planning est encore en test, reessaie en decembre.",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
    const catalog = await asOwner.get(`/spaces/${space.id}/modules`);
    expect(catalog.body.data).toContainEqual(
      expect.objectContaining({
        code: "meal-plan",
        granted: false,
        lastRequest: expect.objectContaining({
          status: "REJECTED",
          decisionNote: "Le Planning est encore en test, reessaie en decembre.",
        }),
      })
    );
    expect((await lastAudit())?.action).toBe("module-request.rejected");

    const list = await client.get("/admin/module-requests");
    expect(list.body.pending.some((r: { id: string }) => r.id === requestId)).toBe(false);
    expect(list.body.recent[0]).toMatchObject({ id: requestId, status: "REJECTED" });
  });

  it("une demande inconnue ou annulee par l'OWNER repond ADMIN_006", async () => {
    const { space, asOwner, requestId } = await pendingRequest();
    await asOwner.post(`/spaces/${space.id}/modules/meal-plan/requests/cancel`);
    expect((await client.post(`/admin/module-requests/${requestId}/approve`)).body.error.code).toBe(
      "ADMIN_006"
    );
    expect((await client.post(`/admin/module-requests/${UNKNOWN}/approve`)).status).toBe(404);
  });
});

describe("catalogue", () => {
  it("liste les modules avec leur statut et leur usage", async () => {
    const { space } = await pendingRequest();
    await grantModule(space.id, "meal-plan", true);
    const res = await client.get("/admin/modules");
    expect(res.status).toBe(200);
    const recipes = res.body.data.find((m: { code: string }) => m.code === "recipes");
    const mealPlan = res.body.data.find((m: { code: string }) => m.code === "meal-plan");
    expect(recipes).toMatchObject({ isDefault: true, status: "AVAILABLE" });
    expect(recipes.grantedCount).toBeGreaterThan(0);
    expect(mealPlan).toMatchObject({ status: "BETA", isDefault: false });
    expect(mealPlan.grantedCount).toBeGreaterThanOrEqual(1);
    expect(mealPlan.enabledCount).toBeGreaterThanOrEqual(1);
    expect(mealPlan.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it("change le statut d'un module ; jamais celui du module par defaut ; audit", async () => {
    const res = await client.patch("/admin/modules/shopping", { status: "BETA" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("BETA");
    expect(await lastAudit()).toMatchObject({
      action: "module.status-changed",
      targetId: "shopping",
      data: { from: "COMING_SOON", to: "BETA" },
    });
    const recipes = await client.patch("/admin/modules/recipes", { status: "BETA" });
    expect(recipes.status).toBe(409);
    expect(recipes.body.error.code).toBe("ADMIN_007");
    expect((await client.patch("/admin/modules/nope", { status: "BETA" })).status).toBe(404);
  });

  it("liste les espaces ayant acces a un module", async () => {
    const owner = await createUser();
    const space = await createSpace(owner.id, { name: "Foyer" });
    await grantModule(space.id, "meal-plan", false);
    const res = await client.get("/admin/modules/meal-plan/spaces");
    expect(res.status).toBe(200);
    expect(res.body.data).toContainEqual(
      expect.objectContaining({
        space: { id: space.id, name: "Foyer", tintIndex: space.tintIndex },
        enabled: false,
        grantedAt: expect.any(String),
      })
    );
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("accorde d'office a un espace (la demande en attente est acceptee) puis retire l'acces", async () => {
    const { space, requestId } = await pendingRequest();
    const granted = await client.post("/admin/modules/meal-plan/grants", { spaceId: space.id });
    expect(granted.status).toBe(201);
    const request = await db.moduleAccessRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(request.status).toBe("APPROVED");
    expect((await lastAudit())?.action).toBe("module.granted");
    const twice = await client.post("/admin/modules/meal-plan/grants", { spaceId: space.id });
    expect(twice.body.error.code).toBe("MODULE_008");

    // Retirer : le module est masque, ses donnees restent ; le rendre redonne tout.
    await db.spaceModule.update({
      where: { spaceId_moduleCode: { spaceId: space.id, moduleCode: "meal-plan" } },
      data: { enabled: true },
    });
    const revoked = await client.delete(`/admin/modules/meal-plan/grants/${space.id}`);
    expect(revoked.status).toBe(204);
    const row = await db.spaceModule.findUniqueOrThrow({
      where: { spaceId_moduleCode: { spaceId: space.id, moduleCode: "meal-plan" } },
    });
    expect(row.revokedAt).not.toBeNull();
    expect(row.enabled).toBe(true);
    expect((await lastAudit())?.action).toBe("module.revoked");
    const listed = await client.get("/admin/modules/meal-plan/spaces");
    expect(listed.body.data.some((g: { space: { id: string } }) => g.space.id === space.id)).toBe(
      false
    );

    await client.post("/admin/modules/meal-plan/grants", { spaceId: space.id });
    const back = await db.spaceModule.findUniqueOrThrow({
      where: { spaceId_moduleCode: { spaceId: space.id, moduleCode: "meal-plan" } },
    });
    expect(back).toMatchObject({ revokedAt: null, enabled: true });
  });

  it("refuse de retirer le module par defaut, ou un acces absent", async () => {
    const owner = await createUser();
    const space = await createSpace(owner.id);
    const recipes = await client.delete(`/admin/modules/recipes/grants/${space.id}`);
    expect(recipes.body.error.code).toBe("ADMIN_007");
    const absent = await client.delete(`/admin/modules/shopping/grants/${space.id}`);
    expect(absent.body.error.code).toBe("MODULE_005");
    const unknownSpace = await client.post("/admin/modules/shopping/grants", { spaceId: UNKNOWN });
    expect(unknownSpace.body.error.code).toBe("SPACE_001");
  });

  it("cherche un espace groupe par son nom pour l'accorder", async () => {
    const owner = await createUser();
    const space = await createSpace(owner.id, { name: "Vacances au ski" });
    const res = await client.get("/admin/spaces/lookup?query=ski");
    expect(res.status).toBe(200);
    expect(res.body.data).toContainEqual({
      id: space.id,
      name: "Vacances au ski",
      tintIndex: space.tintIndex,
      ownerUsername: owner.username,
    });
  });
});

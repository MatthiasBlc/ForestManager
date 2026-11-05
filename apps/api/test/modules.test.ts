import { Router } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiModule } from "../src/core/modules/registry.ts";
import { requirePermission } from "../src/core/modules/guards.ts";
import { syncCatalog } from "../src/core/modules/registry.ts";
import { MODULES } from "../src/modules/index.ts";
import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser, grantModule } from "./helpers/factories.ts";
import { ACTORS, clientAs, describePermissions, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

describePermissions("permissions des modules", [
  {
    name: "GET /spaces/:id/modules",
    key: "space.modules.view",
    call: (c, f) => c.get(`/spaces/${f.spaceId}/modules`),
  },
  {
    name: "POST /spaces/:id/modules/:code/requests",
    key: "space.modules.manage",
    call: async (c, f) => {
      await db.module.update({ where: { code: "shopping" }, data: { status: "BETA" } });
      try {
        return await c.post(`/spaces/${f.spaceId}/modules/shopping/requests`, {});
      } finally {
        await db.module.update({ where: { code: "shopping" }, data: { status: "COMING_SOON" } });
      }
    },
  },
  {
    name: "POST /spaces/:id/modules/:code/requests/cancel",
    key: "space.modules.manage",
    call: async (c, f) => {
      await db.moduleAccessRequest.create({
        data: { spaceId: f.spaceId, moduleCode: "shopping", requestedById: f.owner.id },
      });
      return c.post(`/spaces/${f.spaceId}/modules/shopping/requests/cancel`);
    },
  },
  {
    name: "PATCH /spaces/:id/modules/:code",
    key: "space.modules.manage",
    call: async (c, f) => {
      await grantModule(f.spaceId, "meal-plan", false);
      await db.module.update({ where: { code: "meal-plan" }, data: { status: "AVAILABLE" } });
      try {
        return await c.patch(`/spaces/${f.spaceId}/modules/meal-plan`, { enabled: true });
      } finally {
        await db.module.update({ where: { code: "meal-plan" }, data: { status: "COMING_SOON" } });
      }
    },
  },
  {
    name: "PUT /spaces/:id/modules/order",
    key: "space.modules.manage",
    call: (c, f) => c.put(`/spaces/${f.spaceId}/modules/order`, { codes: ["recipes"] }),
  },
]);

/** Passe un module du catalogue a un statut le temps d'un test. */
async function withStatus<T>(
  code: string,
  status: "AVAILABLE" | "BETA" | "COMING_SOON" | "RETIRED",
  fn: () => Promise<T>
): Promise<T> {
  const before = await db.module.findUniqueOrThrow({ where: { code } });
  await db.module.update({ where: { code }, data: { status } });
  try {
    return await fn();
  } finally {
    await db.module.update({ where: { code }, data: { status: before.status } });
  }
}

describe("catalogue (D33, D54, D123)", () => {
  it("liste les modules non retires ; Recettes accorde et actif, les autres bientot", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const res = await member.get(`/spaces/${f.spaceId}/modules`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        code: "recipes",
        status: "AVAILABLE",
        isDefault: true,
        granted: true,
        enabled: true,
        lastRequest: null,
      }),
      expect.objectContaining({ code: "meal-plan", status: "COMING_SOON", granted: false }),
      expect.objectContaining({ code: "shopping", status: "COMING_SOON", granted: false }),
    ]);
  });

  it("un module bientot n'est pas demandable ; un module retire est introuvable", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const path = `/spaces/${f.spaceId}/modules`;
    expect((await owner.post(`${path}/shopping/requests`, {})).body.error.code).toBe("MODULE_003");
    expect((await owner.post(`${path}/inconnu/requests`, {})).body.error.code).toBe("MODULE_002");
    await withStatus("shopping", "RETIRED", async () => {
      expect((await owner.post(`${path}/shopping/requests`, {})).body.error.code).toBe(
        "MODULE_002"
      );
      const codes = (await owner.get(path)).body.data.map((m: { code: string }) => m.code);
      expect(codes).not.toContain("shopping");
    });
    expect((await owner.post(`${path}/recipes/requests`, {})).body.error.code).toBe("MODULE_008");
  });
});

describe("demandes d'acces (D33, D124)", () => {
  it("demande, une seule en attente, annulation, redemande apres refus avec motif visible", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const path = `/spaces/${f.spaceId}/modules/shopping`;
    await withStatus("shopping", "BETA", async () => {
      const created = await owner.post(`${path}/requests`, { message: "Pour nos courses" });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        moduleCode: "shopping",
        status: "PENDING",
        message: "Pour nos courses",
        decisionNote: null,
      });
      expect((await owner.post(`${path}/requests`, {})).body.error.code).toBe("MODULE_004");

      expect((await owner.post(`${path}/requests/cancel`)).status).toBe(204);
      expect((await owner.post(`${path}/requests/cancel`)).body.error.code).toBe("MODULE_007");

      const again = await owner.post(`${path}/requests`, {});
      // Refus par le super admin (C4) : simule en base.
      await db.moduleAccessRequest.update({
        where: { id: again.body.id },
        data: { status: "REJECTED", decisionNote: "Pas encore", decidedAt: new Date() },
      });
      const catalog = await owner.get(`/spaces/${f.spaceId}/modules`);
      const shopping = catalog.body.data.find((m: { code: string }) => m.code === "shopping");
      expect(shopping.lastRequest).toMatchObject({
        status: "REJECTED",
        decisionNote: "Pas encore",
      });
      expect((await owner.post(`${path}/requests`, {})).status).toBe(201);
    });
  });

  it("l'espace perso demande aussi ses modules", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    await withStatus("meal-plan", "AVAILABLE", async () => {
      const res = await client.post(
        `/spaces/${user.personalSpaceId}/modules/meal-plan/requests`,
        {}
      );
      expect(res.status).toBe(201);
    });
  });
});

describe("activation, desactivation, ordre (D91, D131, D85)", () => {
  it("active un module accorde, le desactive ; Recettes ne se desactive pas", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const path = `/spaces/${f.spaceId}/modules`;
    expect((await owner.patch(`${path}/meal-plan`, { enabled: true })).body.error.code).toBe(
      "MODULE_005"
    );
    await grantModule(f.spaceId, "meal-plan", false);
    expect((await owner.patch(`${path}/meal-plan`, { enabled: true })).body.error.code).toBe(
      "MODULE_003"
    );
    await withStatus("meal-plan", "AVAILABLE", async () => {
      const on = await owner.patch(`${path}/meal-plan`, { enabled: true });
      expect(on.status).toBe(200);
      expect(on.body.data.find((m: { code: string }) => m.code === "meal-plan").enabled).toBe(true);
      const detail = await owner.get(`/spaces/${f.spaceId}`);
      expect(detail.body.modules.map((m: { code: string }) => m.code)).toContain("meal-plan");

      const off = await owner.patch(`${path}/meal-plan`, { enabled: false });
      expect(off.body.data.find((m: { code: string }) => m.code === "meal-plan").enabled).toBe(
        false
      );
    });
    expect((await owner.patch(`${path}/recipes`, { enabled: false })).body.error.code).toBe(
      "MODULE_006"
    );
  });

  it("ordonne les modules accordes ; la liste doit etre complete", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    await grantModule(f.spaceId, "meal-plan", true);
    const path = `/spaces/${f.spaceId}/modules/order`;
    expect((await owner.put(path, { codes: ["recipes"] })).body.error.code).toBe("VALIDATION_001");
    expect(
      (await owner.put(path, { codes: ["recipes", "meal-plan", "shopping"] })).body.error.code
    ).toBe("VALIDATION_001");
    const res = await owner.put(path, { codes: ["meal-plan", "recipes"] });
    expect(res.status).toBe(200);
    const granted = (
      res.body.data as { code: string; granted: boolean; sortOrder: number }[]
    ).filter((m) => m.granted);
    expect(granted.map((m) => [m.code, m.sortOrder])).toEqual([
      ["meal-plan", 0],
      ["recipes", 1],
    ]);
    await withStatus("meal-plan", "AVAILABLE", async () => {
      const detail = await owner.get(`/spaces/${f.spaceId}`);
      expect(detail.body.modules.map((m: { code: string }) => m.code)).toEqual([
        "meal-plan",
        "recipes",
      ]);
    });
  });
});

describe("branchement des modules : requireModule et requirePermission", () => {
  const probe: ApiModule = {
    code: "probe",
    catalog: { status: "AVAILABLE", sortOrder: 99 },
    permissions: { "probe.manage": { minRole: "MODERATOR" } },
    router: () => {
      const router = Router();
      router.get("/", (_req, res) => {
        res.json({ ok: true });
      });
      router.post("/manage", requirePermission("probe.manage"), (_req, res) => {
        res.json({ ok: true });
      });
      return router;
    },
  };
  const probeApp = createTestApp({ modules: [...MODULES, probe] });

  beforeAll(async () => {
    await db.module.create({ data: { code: "probe", status: "AVAILABLE", sortOrder: 99 } });
  });
  afterAll(async () => {
    await db.spaceModule.deleteMany({ where: { moduleCode: "probe" } });
    await db.module.delete({ where: { code: "probe" } });
  });

  it("le routeur d'un module repond seulement si le module est accorde et actif", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, probeApp);
    const path = `/spaces/${f.spaceId}/probe`;
    expect((await member.get(path)).body.error.code).toBe("MODULE_001");
    await grantModule(f.spaceId, "probe", false);
    expect((await member.get(path)).body.error.code).toBe("MODULE_001");
    await grantModule(f.spaceId, "probe", true);
    expect((await member.get(path)).body).toEqual({ ok: true });
    await db.spaceModule.updateMany({
      where: { spaceId: f.spaceId, moduleCode: "probe" },
      data: { revokedAt: new Date() },
    });
    expect((await member.get(path)).body.error.code).toBe("MODULE_001");
    expect((await member.get("/spaces/not-a-uuid/probe")).body.error.code).toBe("VALIDATION_001");
  });

  for (const actor of ACTORS) {
    const allowed = actor === "MODERATOR" || actor === "OWNER";
    it(`permission de module (role minimal MODERATOR) - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await groupFixture();
      await grantModule(f.spaceId, "probe", true);
      const client = await clientAs(actor, f, probeApp);
      const res = await client.post(`/spaces/${f.spaceId}/probe/manage`);
      const expected = {
        anonymous: "AUTH_001",
        outsider: "SPACE_001",
        MEMBER: "SPACE_002",
      } as const;
      if (allowed) expect(res.body).toEqual({ ok: true });
      else expect(res.body.error.code).toBe(expected[actor]);
    });
  }

  it("Recettes se branche par le registre", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    expect((await member.get(`/spaces/${f.spaceId}/recipes`)).status).toBe(200);
    await db.spaceModule.updateMany({
      where: { spaceId: f.spaceId, moduleCode: "recipes" },
      data: { enabled: false },
    });
    expect((await member.get(`/spaces/${f.spaceId}/recipes`)).body.error.code).toBe("MODULE_001");
  });
});

describe("synchro du catalogue", () => {
  it("ajoute un code nouveau en bientot, retire un code absent, reprend un code revenu", async () => {
    const extra: ApiModule = {
      code: "nouveau",
      catalog: { status: "AVAILABLE", sortOrder: 50 },
      permissions: {},
    };
    const withoutShopping = MODULES.filter((m) => m.code !== "shopping");
    try {
      await syncCatalog(db, [...withoutShopping, extra]);
      const rows = await db.module.findMany({ where: { code: { in: ["nouveau", "shopping"] } } });
      expect(Object.fromEntries(rows.map((r) => [r.code, r.status]))).toEqual({
        nouveau: "AVAILABLE",
        shopping: "RETIRED",
      });
      await syncCatalog(db, MODULES);
      const back = await db.module.findMany({ where: { code: { in: ["nouveau", "shopping"] } } });
      expect(Object.fromEntries(back.map((r) => [r.code, r.status]))).toEqual({
        nouveau: "RETIRED",
        shopping: "COMING_SOON",
      });
    } finally {
      await db.module.deleteMany({ where: { code: "nouveau" } });
      await syncCatalog(db, MODULES);
    }
  });

  it("refuse au demarrage des manifestes invalides", () => {
    const dup = MODULES[0];
    expect(() => createTestApp({ modules: [...MODULES, dup!] })).toThrow(/duplicate module code/);
  });
});

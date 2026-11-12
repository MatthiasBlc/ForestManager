// Admin, C4.6 : journal d'audit (A11), reglages (A13) et tableau de bord (A02) [D128, D129, D135].
import { beforeAll, describe, expect, it } from "vitest";

import { createClient, createTestApp, type Client } from "./helpers/app.ts";
import { createAdmin, loginAdmin, type TestAdmin } from "./helpers/admin.ts";
import { db, testEnv } from "./helpers/db.ts";
import { createSpace, createUser } from "./helpers/factories.ts";

const app = createTestApp();

let admin: TestAdmin;
/** Une seule connexion : un code TOTP ne sert qu'une fois (D174). */
let client: Client;

beforeAll(async () => {
  admin = await createAdmin();
  client = await loginAdmin(admin, app);
});

describe("acces aux routes", () => {
  it("demandent une session admin complete", async () => {
    const anonymous = await createClient(app);
    const calls = [
      anonymous.get("/admin/audit"),
      anonymous.get("/admin/settings"),
      anonymous.post("/admin/settings/test/storage"),
      anonymous.get("/admin/dashboard"),
    ];
    for (const res of await Promise.all(calls)) expect(res.body.error.code).toBe("ADMIN_002");
  });
});

describe("journal d'audit (A11)", () => {
  it("du plus recent au plus ancien, filtre par categorie, pagine", async () => {
    // Quelques actions : un tag, un rayon renomme, la connexion du beforeAll.
    await client.post("/admin/tags", { fr: "Journal un" });
    await client.post("/admin/tags", { fr: "Journal deux" });

    const all = await client.get("/admin/audit?limit=2");
    expect(all.status).toBe(200);
    expect(all.body.total).toBeGreaterThanOrEqual(3);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data[0]).toMatchObject({
      admin: admin.username,
      action: "tag.created",
      category: "REFERENTIALS",
      targetType: "tag",
      data: { name: "Journal deux" },
    });
    expect(all.body.data[1]).toMatchObject({ data: { name: "Journal un" } });
    const older = await client.get("/admin/audit?limit=2&offset=2");
    expect(older.body.data[0].id).not.toBe(all.body.data[1].id);

    const connections = await client.get("/admin/audit?category=CONNECTIONS");
    const actions = (connections.body.data as { action: string }[]).map((e) => e.action);
    expect(actions).toContain("auth.login");
    expect(actions.every((a) => a.startsWith("auth."))).toBe(true);
  });

  it("le journal refuse modification et suppression en base", async () => {
    const entry = await db.adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id } });
    await expect(
      db.adminAuditLog.update({ where: { id: entry.id }, data: { action: "auth.logout" } })
    ).rejects.toThrow();
    await expect(db.adminAuditLog.delete({ where: { id: entry.id } })).rejects.toThrow();
  });
});

describe("reglages (A13, D135)", () => {
  it("etat et valeurs non secretes ; aucun secret renvoye", async () => {
    const res = await client.get("/admin/settings");
    expect(res.status).toBe(200);
    expect(res.body.storage).toMatchObject({
      configured: true,
      bucket: testEnv.MINIO_BUCKET,
    });
    expect(res.body.errorTracking).toEqual({ configured: false, host: null, environment: null });
    const text = JSON.stringify(res.body);
    for (const secret of [
      testEnv.MINIO_SECRET_KEY,
      testEnv.MINIO_ACCESS_KEY,
      testEnv.SESSION_SECRET,
    ]) {
      if (secret) expect(text).not.toContain(secret);
    }
  });

  it("tester le stockage ; tester l'e-mail sans SMTP dit pourquoi", async () => {
    const storage = await client.post("/admin/settings/test/storage");
    expect(storage.status).toBe(200);
    expect(storage.body).toMatchObject({ ok: true });
    const email = await client.post("/admin/settings/test/email");
    expect(email.status).toBe(200);
    if (!testEnv.SMTP_URL) expect(email.body).toMatchObject({ ok: false });
  });
});

describe("tableau de bord (A02, D129)", () => {
  it("a traiter, chiffres de la plateforme, services, dernieres actions", async () => {
    const owner = await createUser();
    const space = await createSpace(owner.id, { name: "Bientot purge" });
    await db.space.update({
      where: { id: space.id },
      data: { deletedAt: new Date(), purgeAfter: new Date(Date.now() + 5 * 24 * 3600 * 1000) },
    });
    await client.post("/admin/ingredients", { fr: { name: "poireau" } });
    await db.ingredient.create({
      data: {
        translations: { create: { locale: "fr", name: "poireaux", normalized: "poireaux" } },
      },
    });

    // Seuls les modules proposes (disponibles ou beta) ont leur chiffre.
    const before = await db.module.findUniqueOrThrow({ where: { code: "meal-plan" } });
    await db.module.update({ where: { code: "meal-plan" }, data: { status: "BETA" } });
    const res = await client.get("/admin/dashboard");
    await db.module.update({ where: { code: "meal-plan" }, data: { status: before.status } });
    expect(res.status).toBe(200);
    expect(res.body.newIngredients.count).toBeGreaterThanOrEqual(1);
    expect(res.body.newIngredients.duplicates).toContain("poireaux");
    expect(res.body.deletingSpaces).toContainEqual(
      expect.objectContaining({ id: space.id, name: "Bientot purge" })
    );
    expect(res.body.platform.users).toBeGreaterThanOrEqual(1);
    expect(res.body.platform.personalSpaces).toBeGreaterThanOrEqual(1);
    const codes = res.body.platform.modules.map((m: { code: string }) => m.code);
    expect(codes).toContain("meal-plan");
    expect(codes).not.toContain("shopping");
    expect(res.body.services.storage).toBe(true);
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(res.body.recent[0]).toMatchObject({ action: "ingredient.created" });
    expect(res.body.recent.length).toBeLessThanOrEqual(5);
  });
});

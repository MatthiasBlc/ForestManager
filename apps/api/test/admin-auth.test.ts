// Connexion admin [CDC S3.3, D138] : session isolee de 30 min non glissante,
// 2FA TOTP obligatoire, audit de chaque connexion [D128].
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createAdminUser } from "../src/core/admin/accounts.ts";
import { createContext } from "../src/core/http/app.ts";
import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { adminLogin, createAdmin, loginAdmin, totpFor } from "./helpers/admin.ts";
import { db, testEnv } from "./helpers/db.ts";
import { createUser } from "./helpers/factories.ts";

const app = createTestApp();

async function auditActions(adminId: string): Promise<string[]> {
  const rows = await db.adminAuditLog.findMany({
    where: { adminId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => row.action);
}

describe("creation d'un compte admin (script)", () => {
  it("hache le mot de passe, genere le secret TOTP et laisse la 2FA a configurer", async () => {
    const ctx = createContext({ env: testEnv, db, logger: pino({ level: "silent" }), modules: [] });
    const admin = await createAdminUser(ctx, {
      username: "root_admin",
      email: "Root@Test.local",
      password: "un-mot-de-passe-admin-solide",
    });
    const row = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.email).toBe("root@test.local");
    expect(row.password).not.toContain("solide");
    expect(row.totpSecret).toMatch(/^[A-Z2-7]{32}$/);
    expect(row.totpEnabled).toBe(false);
    await expect(
      createAdminUser(ctx, {
        username: "root_admin",
        email: "other@test.local",
        password: "un-mot-de-passe-admin-solide",
      })
    ).rejects.toMatchObject({ code: "ADMIN_005" });
  });
});

describe("connexion admin", () => {
  it("premiere connexion : configuration de la 2FA puis session ouverte", async () => {
    const admin = await createAdmin({ totpEnabled: false });
    const client = await createClient(app);
    const login = await adminLogin(client, admin);
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ step: "SETUP", secret: admin.totpSecret });
    expect(login.body.otpauthUri).toContain("otpauth://totp/");
    expect(login.body.qrCode).toMatch(/^data:image\/png;base64,/);

    // Avant le code, rien n'est accessible.
    expect((await client.get("/admin/me")).body.error.code).toBe("ADMIN_002");

    const res = await client.post("/admin/auth/totp", { code: totpFor(admin) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: admin.id, username: admin.username });
    expect(Date.parse(res.body.sessionExpiresAt) - Date.now()).toBeGreaterThan(29 * 60 * 1000);
    const row = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.totpEnabled).toBe(true);
    expect(row.lastLoginAt).not.toBeNull();
    expect((await auditActions(admin.id)).sort()).toEqual(["auth.login", "auth.totp-enabled"]);
    expect((await client.get("/admin/me")).status).toBe(200);
  });

  it("connexion suivante : code demande, sans QR code", async () => {
    const admin = await createAdmin();
    const client = await createClient(app);
    const login = await adminLogin(client, admin);
    expect(login.body).toEqual({ step: "CODE" });
    expect((await client.post("/admin/auth/totp", { code: totpFor(admin) })).status).toBe(200);
  });

  it("accepte l'email ou le username, sans casse", async () => {
    const admin = await createAdmin();
    const client = await createClient(app);
    const res = await client.post("/admin/auth/login", {
      identifier: admin.email.toUpperCase(),
      password: admin.password,
    });
    expect(res.status).toBe(200);
  });

  it("refuse un mauvais mot de passe ou un compte inconnu avec la meme erreur", async () => {
    const admin = await createAdmin();
    const client = await createClient(app);
    const wrong = await client.post("/admin/auth/login", {
      identifier: admin.username,
      password: "mauvais-mot-de-passe",
    });
    const unknown = await client.post("/admin/auth/login", {
      identifier: "personne",
      password: "mauvais-mot-de-passe",
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("ADMIN_001");
    expect(unknown.body.error.code).toBe("ADMIN_001");
  });

  it("un compte utilisateur n'ouvre pas l'admin, et inversement", async () => {
    const user = await createUser();
    const asUser = await loginAs(user, app);
    expect((await asUser.get("/admin/me")).body.error.code).toBe("ADMIN_002");
    const viaAdmin = await asUser.post("/admin/auth/login", {
      identifier: user.username,
      password: user.password,
    });
    expect(viaAdmin.body.error.code).toBe("ADMIN_001");

    const admin = await createAdmin();
    const asAdmin = await loginAdmin(admin, app);
    expect((await asAdmin.get("/me")).body.error.code).toBe("AUTH_001");
  });

  it("refuse un code faux, puis ferme la tentative apres 3 erreurs", async () => {
    const admin = await createAdmin();
    const client = await createClient(app);
    await adminLogin(client, admin);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await client.post("/admin/auth/totp", { code: "000000" });
      expect(res.body.error.code).toBe("ADMIN_003");
    }
    const locked = await client.post("/admin/auth/totp", { code: totpFor(admin) });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("ADMIN_004");
    // La tentative est fermee : il faut recommencer depuis le mot de passe.
    const after = await client.post("/admin/auth/totp", { code: totpFor(admin) });
    expect(after.body.error.code).toBe("ADMIN_002");
    expect(await auditActions(admin.id)).toEqual([
      "auth.totp-failed",
      "auth.totp-failed",
      "auth.totp-failed",
      "auth.totp-locked",
    ]);
  });

  it("refuse un code deja utilise (rejeu)", async () => {
    const admin = await createAdmin();
    const first = await createClient(app);
    await adminLogin(first, admin);
    const code = totpFor(admin);
    expect((await first.post("/admin/auth/totp", { code })).status).toBe(200);

    const second = await createClient(app);
    await adminLogin(second, admin);
    const replay = await second.post("/admin/auth/totp", { code });
    expect(replay.body.error.code).toBe("ADMIN_003");
  });

  it("refuse le code sans etape mot de passe", async () => {
    const admin = await createAdmin();
    const client = await createClient(app);
    const res = await client.post("/admin/auth/totp", { code: totpFor(admin) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("ADMIN_002");
  });
});

describe("session admin", () => {
  it("dure 30 minutes sans glisser", async () => {
    const admin = await createAdmin();
    const client = await loginAdmin(admin, app);
    const [before] = await db.adminSession.findMany();
    await client.get("/admin/me");
    await client.get("/admin/me");
    const [after] = await db.adminSession.findMany();
    expect(after?.expiresAt.getTime()).toBe(before?.expiresAt.getTime());
    const remaining = (before?.expiresAt.getTime() ?? 0) - Date.now();
    expect(remaining).toBeGreaterThan(29 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it("expire : la session n'ouvre plus rien", async () => {
    const admin = await createAdmin();
    const client = await loginAdmin(admin, app);
    await db.adminSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await client.get("/admin/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("ADMIN_002");
  });

  it("se ferme a la deconnexion, avec une entree d'audit", async () => {
    const admin = await createAdmin();
    const client = await loginAdmin(admin, app);
    const before = await db.adminSession.count();
    expect((await client.post("/admin/auth/logout")).status).toBe(204);
    expect((await client.get("/admin/me")).body.error.code).toBe("ADMIN_002");
    expect(await db.adminSession.count()).toBe(before - 1);
    expect((await auditActions(admin.id)).at(-1)).toBe("auth.logout");
  });

  it("utilise un cookie distinct, limite aux routes admin", async () => {
    const admin = await createAdmin();
    const client = await createClient(app);
    await adminLogin(client, admin);
    const res = await client.post("/admin/auth/totp", { code: totpFor(admin) });
    const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    const cookie = cookies.find((value) => value.startsWith("fm.admin.sid="));
    expect(cookie).toContain("Path=/api/v1/admin");
    expect(cookie).toContain("HttpOnly");
    expect(cookies.some((value) => value.startsWith("fm.sid="))).toBe(false);
  });

  it("une route admin inconnue repond 404 sans tomber dans l'API utilisateur", async () => {
    const admin = await createAdmin();
    const client = await loginAdmin(admin, app);
    const res = await client.get("/admin/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("COMMON_003");
  });
});

describe("journal d'audit", () => {
  it("ne se modifie ni ne se supprime en base [D128]", async () => {
    const admin = await createAdmin();
    await loginAdmin(admin, app);
    const [entry] = await db.adminAuditLog.findMany({ where: { adminId: admin.id } });
    if (!entry) throw new Error("audit entry missing");
    await expect(
      db.adminAuditLog.update({ where: { id: entry.id }, data: { action: "x" } })
    ).rejects.toThrow();
    await expect(db.adminAuditLog.delete({ where: { id: entry.id } })).rejects.toThrow();
    expect(await db.adminAuditLog.count({ where: { id: entry.id } })).toBe(1);
  });
});

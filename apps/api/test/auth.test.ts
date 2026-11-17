import { TEST_PASSWORD, buildUser } from "@fm/test-utils";
import { describe, expect, it } from "vitest";

import { createClient, createTestApp, fakeMailer, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser } from "./helpers/factories.ts";

const app = createTestApp();

describe("inscription", () => {
  it("cree le compte, l'espace perso avec Recettes actif, et connecte", async () => {
    const client = await createClient(app);
    const data = buildUser({ email: "New.User@Test.local" });
    const res = await client.post("/auth/register", data);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      username: data.username,
      email: "new.user@test.local",
      emailVerified: false,
      preferences: {
        ambiance: "BRAISE",
        colorMode: "SYSTEM",
        density: "COMFORTABLE",
        textScale: 100,
        locale: "fr",
      },
    });
    const space = await db.space.findUniqueOrThrow({
      where: { id: res.body.personalSpaceId },
      include: { memberships: true, modules: true },
    });
    expect(space).toMatchObject({ kind: "PERSONAL", personalUserId: res.body.id });
    expect(space.memberships).toMatchObject([{ role: "OWNER", userId: res.body.id }]);
    expect(space.modules).toMatchObject([{ moduleCode: "recipes", enabled: true }]);
    const user = await db.user.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect((await client.get("/me")).status).toBe(200);
  });

  it("refuse un username ou un email deja pris (sans tenir compte de la casse)", async () => {
    const existing = await createUser();
    const client = await createClient(app);
    const sameName = await client.post(
      "/auth/register",
      buildUser({ username: existing.username.toUpperCase() })
    );
    expect(sameName.body.error.code).toBe("AUTH_003");
    const sameEmail = await client.post("/auth/register", buildUser({ email: existing.email }));
    expect(sameEmail.body.error.code).toBe("AUTH_004");
  });

  it("refuse un mot de passe courant ou derive du username", async () => {
    const client = await createClient(app);
    const common = await client.post("/auth/register", buildUser({ password: "motdepasse123" }));
    expect(common.body.error.code).toBe("AUTH_009");
    const personal = await client.post(
      "/auth/register",
      buildUser({ username: "gourmand", password: "gourmand-2026" })
    );
    expect(personal.body.error.code).toBe("AUTH_009");
    const sequence = await client.post("/auth/register", buildUser({ password: "abcdefghijkl" }));
    expect(sequence.body.error.code).toBe("AUTH_009");
  });

  it("refuse une inscription quand on est deja connecte", async () => {
    const client = await loginAs(await createUser(), app);
    const res = await client.post("/auth/register", buildUser());
    expect(res.body.error.code).toBe("AUTH_010");
  });
});

describe("connexion et sessions", () => {
  it("accepte username (sans casse) ou email, et renouvelle l'identifiant de session", async () => {
    const user = await createUser();
    const client = await createClient(app);
    const before = await client.get("/me");
    expect(before.body.error.code).toBe("AUTH_001");
    const byName = await client.post("/auth/login", {
      identifier: user.username.toUpperCase(),
      password: TEST_PASSWORD,
    });
    expect(byName.status).toBe(200);
    const firstCookie = String(byName.headers["set-cookie"]);
    const byEmail = await client.post("/auth/login", {
      identifier: user.email,
      password: TEST_PASSWORD,
    });
    expect(byEmail.status).toBe(200);
    expect(String(byEmail.headers["set-cookie"])).not.toBe(firstCookie);
  });

  it("repond AUTH_002 sans dire ce qui est faux", async () => {
    const user = await createUser();
    const client = await createClient(app);
    const wrong = await client.post("/auth/login", {
      identifier: user.username,
      password: "wrong-password",
    });
    const unknown = await client.post("/auth/login", {
      identifier: "nobody_here",
      password: "wrong-password",
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("refuse un compte supprime", async () => {
    const user = await createUser();
    await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    const client = await createClient(app);
    const res = await client.post("/auth/login", {
      identifier: user.username,
      password: TEST_PASSWORD,
    });
    expect(res.body.error.code).toBe("AUTH_002");
  });

  it("cookie de session : httpOnly, 1 jour, ou 30 jours avec rester connecte", async () => {
    const user = await createUser();
    const short = await createClient(app);
    const res = await short.post("/auth/login", {
      identifier: user.username,
      password: TEST_PASSWORD,
    });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("fm.sid=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const shortRow = await db.userSession.findFirstOrThrow({ where: { userId: user.id } });
    const day = 24 * 60 * 60 * 1000;
    expect(shortRow.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(day);
    const long = await createClient(app);
    await long.post("/auth/login", {
      identifier: user.username,
      password: TEST_PASSWORD,
      rememberMe: true,
    });
    const rows = await db.userSession.findMany({
      where: { userId: user.id },
      orderBy: { expiresAt: "desc" },
    });
    expect(rows[0]!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * day);
  });

  it("deconnexion : la session est detruite", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    expect((await client.post("/auth/logout")).status).toBe(204);
    expect((await client.get("/me")).status).toBe(401);
    expect(await db.userSession.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("profil", () => {
  it("GET /me renvoie le compte connecte", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const res = await client.get("/me");
    expect(res.body).toMatchObject({
      id: user.id,
      personalSpaceId: user.personalSpaceId,
      avatarUrl: null,
    });
  });

  it("change le username ; l'email exige le mot de passe actuel", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const renamed = await client.patch("/me", { username: "renamed_user" });
    expect(renamed.body.username).toBe("renamed_user");
    const wrong = await client.patch("/me", {
      email: "new@test.local",
      currentPassword: "wrong-password",
    });
    expect(wrong.body.error.code).toBe("AUTH_005");
    const ok = await client.patch("/me", {
      email: "New@Test.local",
      currentPassword: TEST_PASSWORD,
    });
    expect(ok.body).toMatchObject({ email: "new@test.local", emailVerified: false });
  });

  it("refuse un username deja pris par un autre compte", async () => {
    const other = await createUser();
    const client = await loginAs(await createUser(), app);
    const res = await client.patch("/me", { username: other.username });
    expect(res.body.error.code).toBe("AUTH_003");
  });

  it("changer de mot de passe ferme les autres sessions", async () => {
    const user = await createUser();
    const current = await loginAs(user, app);
    const other = await loginAs(user, app);
    const wrong = await current.put("/me/password", {
      currentPassword: "nope-nope-nope",
      newPassword: "un-nouveau-secret-42",
    });
    expect(wrong.body.error.code).toBe("AUTH_005");
    const res = await current.put("/me/password", {
      currentPassword: TEST_PASSWORD,
      newPassword: "un-nouveau-secret-42",
    });
    expect(res.status).toBe(204);
    expect((await current.get("/me")).status).toBe(200);
    expect((await other.get("/me")).status).toBe(401);
    const relog = await createClient(app);
    const login = await relog.post("/auth/login", {
      identifier: user.username,
      password: "un-nouveau-secret-42",
    });
    expect(login.status).toBe(200);
  });

  it("met a jour les preferences d'affichage", async () => {
    const client = await loginAs(await createUser(), app);
    const res = await client.patch("/me/preferences", {
      ambiance: "POTAGER",
      colorMode: "DARK",
      textScale: 130,
    });
    expect(res.body.preferences).toMatchObject({
      ambiance: "POTAGER",
      colorMode: "DARK",
      textScale: 130,
      density: "COMFORTABLE",
    });
    const bad = await client.patch("/me/preferences", { locale: "en" });
    expect(bad.body.error.code).toBe("VALIDATION_001");
  });

  it("toutes les routes du profil exigent une session", async () => {
    const client = await createClient(app);
    for (const res of [
      await client.get("/me"),
      await client.patch("/me", { username: "someone" }),
      await client.put("/me/password", { currentPassword: "x", newPassword: "y-y-y-y-y-y-y" }),
      await client.patch("/me/preferences", { density: "COMPACT" }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTH_001");
    }
  });
});

describe("emails optionnels", () => {
  it("sans SMTP : routes desactivees (AUTH_007), aucune erreur a l'inscription", async () => {
    const client = await createClient(app);
    const forgot = await client.post("/auth/forgot-password", { email: "a@test.local" });
    expect(forgot.status).toBe(404);
    expect(forgot.body.error.code).toBe("AUTH_007");
    const reset = await client.post("/auth/reset-password", {
      token: "a".repeat(43),
      password: "un-nouveau-secret-42",
    });
    expect(reset.body.error.code).toBe("AUTH_007");
  });

  it("avec SMTP : verification de l'email a l'inscription, jeton a usage unique", async () => {
    const mailer = fakeMailer();
    const mailApp = createTestApp({ mailer });
    const config = await (await createClient(mailApp)).get("/config");
    expect(config.body.features.email).toBe(true);
    const client = await createClient(mailApp);
    const data = buildUser();
    const res = await client.post("/auth/register", data);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe(data.email);
    expect(mailer.sent[0]!.text).toContain("http://localhost:3000/verify-email?token=");
    const token = mailer.lastToken();
    expect((await client.post("/auth/verify-email", { token })).status).toBe(204);
    expect((await client.get("/me")).body.emailVerified).toBe(true);
    const again = await client.post("/auth/verify-email", { token });
    expect(again.body.error.code).toBe("AUTH_008");
    const resend = await client.post("/auth/verify-email/resend");
    expect(resend.body.error.code).toBe("AUTH_013");
    const stored = await db.authToken.findFirstOrThrow({ where: { userId: res.body.id } });
    expect(stored.tokenHash).not.toBe(token);
  });

  it("mot de passe oublie : meme reponse pour un email inconnu, reinitialisation ferme les sessions", async () => {
    const mailer = fakeMailer();
    const mailApp = createTestApp({ mailer });
    const user = await createUser();
    const session = await loginAs(user, mailApp);
    const anonymous = await createClient(mailApp);
    const unknown = await anonymous.post("/auth/forgot-password", { email: "nobody@test.local" });
    expect(unknown.status).toBe(204);
    expect(mailer.sent).toHaveLength(0);
    const known = await anonymous.post("/auth/forgot-password", { email: user.email });
    expect(known.status).toBe(204);
    expect(mailer.sent[0]!.text).toContain("/reset-password?token=");
    const token = mailer.lastToken();
    // Un mot de passe refuse ne brule pas le jeton.
    const weak = await anonymous.post("/auth/reset-password", { token, password: "1234567890" });
    expect(weak.body.error.code).toBe("AUTH_009");
    const ok = await anonymous.post("/auth/reset-password", {
      token,
      password: "un-nouveau-secret-42",
    });
    expect(ok.status).toBe(204);
    expect((await session.get("/me")).status).toBe(401);
    const reused = await anonymous.post("/auth/reset-password", {
      token,
      password: "encore-un-autre-42",
    });
    expect(reused.body.error.code).toBe("AUTH_008");
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.emailVerifiedAt).not.toBeNull();
  });

  it("refuse un jeton expire", async () => {
    const mailer = fakeMailer();
    const mailApp = createTestApp({ mailer });
    const user = await createUser();
    const client = await createClient(mailApp);
    await client.post("/auth/forgot-password", { email: user.email });
    await db.authToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await client.post("/auth/reset-password", {
      token: mailer.lastToken(),
      password: "un-nouveau-secret-42",
    });
    expect(res.body.error.code).toBe("AUTH_008");
  });
});

describe("limitation de debit", () => {
  it("bloque la connexion apres 10 essais (AUTH_006)", async () => {
    const limited = createTestApp({ rateLimit: true });
    const client = await createClient(limited);
    let last = 0;
    for (let i = 0; i < 11; i += 1) {
      last = (await client.post("/auth/login", { identifier: "nobody", password: "x" })).status;
    }
    expect(last).toBe(429);
  });
});

// Connexion avec Discord [D202, D210] : faux client Discord injecte.
import { describe, expect, it } from "vitest";

import { createPasswordHasher } from "../src/core/auth/password.ts";
import { DiscordError, type DiscordClient, type DiscordProfile } from "../src/core/auth/discord.ts";
import { createClient, createTestApp, fakeMailer, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser } from "./helpers/factories.ts";
import { webpBytes } from "./helpers/images.ts";

let sequence = 0;

function profile(overrides: Partial<DiscordProfile> = {}): DiscordProfile {
  sequence += 1;
  return {
    id: `90000000000000${String(sequence).padStart(4, "0")}`,
    username: `lea.discord${sequence}`,
    email: `lea${sequence}@discord.test`,
    verified: true,
    avatar: null,
    ...overrides,
  };
}

/** Faux Discord : un code d'autorisation = la cle d'un profil. */
function fakeDiscord(avatar: Buffer | null = null) {
  const profiles = new Map<string, DiscordProfile>();
  const client: DiscordClient = {
    authorizeUrl: (state) => `https://discord.test/oauth2/authorize?state=${state}`,
    exchangeCode: (code) => {
      const found = profiles.get(code);
      return found ? Promise.resolve(found) : Promise.reject(new DiscordError("invalid code"));
    },
    fetchAvatar: () => Promise.resolve(avatar),
  };
  return {
    client,
    /** Enregistre le profil et renvoie le code qui le donne. */
    code(p: DiscordProfile): string {
      const code = `code-${p.id}`;
      profiles.set(code, p);
      return code;
    },
  };
}

const discord = fakeDiscord();
const mailer = fakeMailer();
const app = createTestApp({ discord: discord.client, mailer });

/** Lance le flux et renvoie le `state` pose en session. */
async function start(client: Client, query = "intent=login"): Promise<string> {
  const res = await client.get(`/auth/discord/start?${query}`);
  expect(res.status).toBe(302);
  const state = new URL(res.headers.location as string).searchParams.get("state");
  if (!state) throw new Error("state missing");
  return state;
}

async function callback(client: Client, p: DiscordProfile, query = "intent=login") {
  const state = await start(client, query);
  return client.get(`/auth/discord/callback?code=${discord.code(p)}&state=${state}`);
}

/** Inscription complete par Discord ; renvoie le client connecte et l'id du compte. */
async function signUp(p: DiscordProfile, body?: { username: string; email: string }) {
  const client = await createClient(app);
  await callback(client, p);
  const pending = await client.get("/auth/discord/pending");
  const res = await client.post(
    "/auth/discord/register",
    body ?? { username: pending.body.username, email: pending.body.email }
  );
  expect(res.status).toBe(201);
  return { client, id: res.body.id as string };
}

describe("configuration", () => {
  it("annonce Discord seulement s'il est configure", async () => {
    const on = await createClient(app);
    expect((await on.get("/config")).body.features.discord).toBe(true);
    const off = await createClient(createTestApp({ discord: null }));
    expect((await off.get("/config")).body.features.discord).toBe(false);
  });

  it("sans Discord configure, le flux renvoie vers la connexion avec AUTH_015", async () => {
    const client = await createClient(createTestApp({ discord: null }));
    const res = await client.get("/auth/discord/start?intent=login");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login?error=AUTH_015");
  });
});

describe("state", () => {
  it("refuse un state inconnu, puis un state deja utilise", async () => {
    const client = await createClient(app);
    const p = profile();
    const forged = await client.get(`/auth/discord/callback?code=${discord.code(p)}&state=forged`);
    expect(forged.headers.location).toBe("/login?error=AUTH_015");

    const state = await start(client);
    const code = discord.code(p);
    const first = await client.get(`/auth/discord/callback?code=${code}&state=${state}`);
    expect(first.headers.location).toMatch(/^\/register\/discord/);
    const replay = await client.get(`/auth/discord/callback?code=${code}&state=${state}`);
    expect(replay.headers.location).toBe("/login?error=AUTH_015");
  });

  it("annulation sur Discord ou code refuse : retour a la connexion avec AUTH_015", async () => {
    const client = await createClient(app);
    const state = await start(client);
    const denied = await client.get(`/auth/discord/callback?error=access_denied&state=${state}`);
    expect(denied.headers.location).toBe("/login?error=AUTH_015");
    const again = await start(client);
    const bad = await client.get(`/auth/discord/callback?code=nope&state=${again}`);
    expect(bad.headers.location).toBe("/login?error=AUTH_015");
  });

  it("garde une destination interne seulement", async () => {
    const client = await createClient(app);
    const p = profile();
    const external = await callback(client, p, "intent=login&next=https://evil.test");
    expect(external.headers.location).toBe("/register/discord");
    const other = await createClient(app);
    const internal = await callback(other, profile(), "intent=login&next=%2Fjoin%2Fabc");
    expect(internal.headers.location).toBe("/register/discord?next=%2Fjoin%2Fabc");
  });
});

describe("inscription par Discord", () => {
  it("compte inconnu : ecran de confirmation avec le nom propose et l'email verifie", async () => {
    const client = await createClient(app);
    const p = profile({ username: "lea.martin" });
    await callback(client, p);
    expect((await client.get("/me")).status).toBe(401);
    const pending = await client.get("/auth/discord/pending");
    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({
      username: "lea_martin",
      email: p.email,
      emailVerified: true,
      discordUsername: "lea.martin",
    });
  });

  it("propose un nom libre quand celui de Discord est pris ou trop court", async () => {
    await createUser({ username: "Sam_Cook" });
    const taken = await createClient(app);
    await callback(taken, profile({ username: "sam.cook" }));
    expect((await taken.get("/auth/discord/pending")).body.username).toBe("sam_cook2");
    const short = await createClient(app);
    await callback(short, profile({ username: "jo" }));
    expect((await short.get("/auth/discord/pending")).body.username).toBe("jo_");
  });

  it("sans email verifie, l'email est a saisir", async () => {
    const client = await createClient(app);
    await callback(client, profile({ verified: false }));
    expect((await client.get("/auth/discord/pending")).body).toMatchObject({
      email: null,
      emailVerified: false,
    });
  });

  it("cree le compte sans mot de passe, email verifie, espace perso, et connecte", async () => {
    const p = profile();
    const sent = mailer.sent.length;
    const { client, id } = await signUp(p);
    const me = await client.get("/me");
    expect(me.body).toMatchObject({
      id,
      email: p.email,
      emailVerified: true,
      hasPassword: false,
      discord: { username: p.username },
    });
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({ discordId: p.id, passwordHash: null });
    const space = await db.space.findUniqueOrThrow({ where: { personalUserId: id } });
    expect(space.kind).toBe("PERSONAL");
    expect(mailer.sent.length).toBe(sent);
    // Rappel : definir un mot de passe de secours (D210).
    const reminders = await db.notification.count({
      where: { userId: id, type: "core.password.missing" },
    });
    expect(reminders).toBe(1);
    // L'attente est consommee.
    expect((await client.get("/auth/discord/pending")).body.error.code).toBe("AUTH_015");
  });

  it("un email modifie n'est pas verifie et recoit l'email de verification", async () => {
    const p = profile();
    const { client } = await signUp(p, { username: `other${sequence}`, email: "autre@test.local" });
    expect((await client.get("/me")).body).toMatchObject({
      email: "autre@test.local",
      emailVerified: false,
    });
    expect(mailer.sent.at(-1)?.to).toBe("autre@test.local");
  });

  it("jamais de liaison par email : AUTH_004 si l'email est deja pris", async () => {
    const existing = await createUser();
    const client = await createClient(app);
    await callback(client, profile({ email: existing.email }));
    const res = await client.post("/auth/discord/register", {
      username: `newcomer${sequence}`,
      email: existing.email,
    });
    expect(res.body.error.code).toBe("AUTH_004");
    const user = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(user.discordId).toBeNull();
  });

  it("refuse sans attente valable", async () => {
    const client = await createClient(app);
    const res = await client.post("/auth/discord/register", {
      username: "nobody_here",
      email: "nobody@test.local",
    });
    expect(res.body.error.code).toBe("AUTH_015");
  });

  it("reprend l'avatar Discord une fois", async () => {
    const withAvatar = fakeDiscord(webpBytes(128, 128));
    const avatarApp = createTestApp({ discord: withAvatar.client });
    const client = await createClient(avatarApp);
    const p = profile({ avatar: "abc123" });
    const state = await start(client);
    await client.get(`/auth/discord/callback?code=${withAvatar.code(p)}&state=${state}`);
    const pending = await client.get("/auth/discord/pending");
    const res = await client.post("/auth/discord/register", {
      username: pending.body.username,
      email: pending.body.email,
    });
    expect(res.status).toBe(201);
    expect(res.body.avatarUrl).toEqual(expect.any(String));
    const user = await db.user.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(user.avatarKey).toMatch(new RegExp(`^users/${user.id}/.+\\.webp$`));
  });

  it("ignore un avatar Discord illisible", async () => {
    const broken = fakeDiscord(Buffer.from("not an image"));
    const brokenApp = createTestApp({ discord: broken.client });
    const client = await createClient(brokenApp);
    const p = profile({ avatar: "abc123" });
    const state = await start(client);
    await client.get(`/auth/discord/callback?code=${broken.code(p)}&state=${state}`);
    const pending = await client.get("/auth/discord/pending");
    const res = await client.post("/auth/discord/register", {
      username: pending.body.username,
      email: pending.body.email,
    });
    expect(res.status).toBe(201);
    expect(res.body.avatarUrl).toBeNull();
  });
});

describe("connexion par Discord", () => {
  it("compte relie : session ouverte, retour a la destination, nom Discord rafraichi", async () => {
    const p = profile();
    const { id } = await signUp(p);
    const client = await createClient(app);
    const renamed = { ...p, username: "nouveau.nom" };
    const res = await callback(client, renamed, "intent=login&next=%2Fspaces");
    expect(res.headers.location).toBe("/spaces");
    const me = await client.get("/me");
    expect(me.body).toMatchObject({ id, discord: { username: "nouveau.nom" } });
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user.lastLoginAt).not.toBeNull();
  });

  it("connexion par mot de passe impossible sans mot de passe", async () => {
    const p = profile();
    const { id } = await signUp(p);
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    const client = await createClient(app);
    const res = await client.post("/auth/login", { identifier: user.username, password: "x" });
    expect(res.body.error.code).toBe("AUTH_002");
  });
});

describe("liaison depuis le profil", () => {
  it("relie un compte existant, puis s'y connecte par Discord", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const p = profile();
    const res = await callback(client, p, "intent=link");
    expect(res.headers.location).toBe("/profile?discord=linked");
    expect((await client.get("/me")).body).toMatchObject({
      hasPassword: true,
      discord: { username: p.username },
    });
    const other = await createClient(app);
    await callback(other, p);
    expect((await other.get("/me")).body.id).toBe(user.id);
  });

  it("exige une session pour relier", async () => {
    const client = await createClient(app);
    const res = await client.get("/auth/discord/start?intent=link");
    expect(res.headers.location).toBe("/login?error=AUTH_001");
  });

  it("refuse un compte Discord deja relie a un autre compte (AUTH_016)", async () => {
    const p = profile();
    await signUp(p);
    const user = await createUser();
    const client = await loginAs(user, app);
    const res = await callback(client, p, "intent=link");
    expect(res.headers.location).toBe("/profile?discordError=AUTH_016");
    expect((await client.get("/me")).body.discord).toBeNull();
  });

  it("delie seulement si le compte a un mot de passe (AUTH_017)", async () => {
    const { client } = await signUp(profile());
    expect((await client.delete("/me/discord")).body.error.code).toBe("AUTH_017");

    const user = await createUser();
    const linked = await loginAs(user, app);
    await callback(linked, profile(), "intent=link");
    expect((await linked.delete("/me/discord")).status).toBe(204);
    expect((await linked.get("/me")).body.discord).toBeNull();
  });
});

describe("compte sans mot de passe", () => {
  it("definit un mot de passe sans l'ancien, puis se connecte avec", async () => {
    const { client, id } = await signUp(profile());
    const res = await client.put("/me/password", { newPassword: "Tartiflette-du-soir-42" });
    expect(res.status).toBe(204);
    expect((await client.get("/me")).body.hasPassword).toBe(true);
    const reminders = await db.notification.count({
      where: { userId: id, type: "core.password.missing" },
    });
    expect(reminders).toBe(0);
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    const other = await createClient(app);
    const login = await other.post("/auth/login", {
      identifier: user.username,
      password: "Tartiflette-du-soir-42",
    });
    expect(login.status).toBe(200);
  });

  it("le mot de passe temporaire de l'admin ouvre le compte (D134)", async () => {
    const { id } = await signUp(profile());
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    const tokenHash = await createPasswordHasher(true).hash("Temporaire-1234");
    await db.authToken.create({
      data: {
        userId: id,
        kind: "TEMP_PASSWORD",
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const client = await createClient(app);
    const res = await client.post("/auth/login", {
      identifier: user.username,
      password: "Temporaire-1234",
    });
    expect(res.status).toBe(200);
    expect(res.body.mustChoosePassword).toBe(true);
  });

  it("un compte avec mot de passe doit toujours donner l'actuel (AUTH_005)", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const res = await client.put("/me/password", { newPassword: "Tartiflette-du-soir-42" });
    expect(res.body.error.code).toBe("AUTH_005");
  });

  it("change d'email seulement apres avoir defini un mot de passe (AUTH_017)", async () => {
    const { client } = await signUp(profile());
    const res = await client.patch("/me", { email: "nouveau@test.local", currentPassword: "x" });
    expect(res.body.error.code).toBe("AUTH_017");
  });

  it("supprime le compte en tapant son nom d'utilisateur (AUTH_018 sinon), Discord libere", async () => {
    const p = profile();
    const { client, id } = await signUp(p);
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    const wrong = await client.delete("/me", { username: "pas_moi" });
    expect(wrong.body.error.code).toBe("AUTH_018");
    const res = await client.delete("/me", { username: user.username.toUpperCase() });
    expect(res.status).toBe(204);
    const deleted = await db.user.findUniqueOrThrow({ where: { id } });
    expect(deleted).toMatchObject({ discordId: null, discordUsername: null });
    expect(deleted.deletedAt).not.toBeNull();
  });

  it("un compte avec mot de passe ne se supprime pas avec son seul nom", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const res = await client.delete("/me", { username: user.username });
    expect(res.body.error.code).toBe("AUTH_005");
  });
});

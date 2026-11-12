// Admin, C4.4 : utilisateurs (A12) et mot de passe temporaire (A12b, D134).
import { beforeAll, describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { createAdmin, loginAdmin, type TestAdmin } from "./helpers/admin.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";

const app = createTestApp();
const UNKNOWN = "00000000-0000-4000-8000-000000000000";
const NEW_PASSWORD = "Une-phrase-de-passe-neuve-42";

let admin: TestAdmin;
/** Une seule connexion : un code TOTP ne sert qu'une fois (D174). */
let client: Client;

beforeAll(async () => {
  admin = await createAdmin();
  client = await loginAdmin(admin, app);
});

async function lastAudit() {
  return db.adminAuditLog.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: "desc" },
  });
}

function login(c: Client, identifier: string, password: string) {
  return c.post("/auth/login", { identifier, password, rememberMe: false });
}

async function temporaryPassword(userId: string) {
  const res = await client.post(`/admin/users/${userId}/temporary-password`);
  expect(res.status).toBe(201);
  return res.body as { password: string; expiresAt: string };
}

describe("acces aux routes", () => {
  it("demandent une session admin complete", async () => {
    const anonymous = await createClient(app);
    const calls = [
      anonymous.get("/admin/users"),
      anonymous.post(`/admin/users/${UNKNOWN}/temporary-password`),
    ];
    for (const res of await Promise.all(calls)) expect(res.body.error.code).toBe("ADMIN_002");
    const user = await createUser();
    const asUser = await loginAs(user, app);
    expect((await asUser.get("/admin/users")).body.error.code).toBe("ADMIN_002");
  });
});

describe("liste des comptes (A12)", () => {
  it("compte, espaces groupe et derniere connexion ; jamais les comptes supprimes", async () => {
    const owner = await createUser({ username: "lea_liste" });
    const member = await createUser({ username: "sam_liste" });
    const space = await createSpace(owner.id, { name: "Colloc" });
    await addMember(space.id, member.id);
    const gone = await createUser({ username: "parti_liste" });
    await db.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    await login(await createClient(app), owner.username, owner.password);

    const res = await client.get("/admin/users?query=_liste");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    // Par derniere connexion : lea s'est connectee, sam jamais.
    expect(res.body.data[0]).toMatchObject({
      id: owner.id,
      username: "lea_liste",
      email: owner.email,
      spaces: [{ name: "Colloc", owner: true }],
      temporaryPasswordPending: false,
    });
    expect(res.body.data[0].lastLoginAt).not.toBeNull();
    expect(res.body.data[1]).toMatchObject({
      username: "sam_liste",
      spaces: [{ name: "Colloc", owner: false }],
      lastLoginAt: null,
    });
    // Ni contenu, ni hash.
    expect(res.body.data[0]).not.toHaveProperty("passwordHash");

    const byEmail = await client.get(`/admin/users?query=${encodeURIComponent(member.email)}`);
    expect(byEmail.body.data.map((u: { id: string }) => u.id)).toEqual([member.id]);
  });

  it("filtres : OWNER d'un espace groupe, inactifs depuis 6 mois", async () => {
    const owner = await createUser({ username: "own_filtre" });
    await createSpace(owner.id, { name: "Amis" });
    const old = await createUser({ username: "old_filtre" });
    const longAgo = new Date(Date.now() - 200 * 24 * 3600 * 1000);
    await db.user.update({ where: { id: old.id }, data: { lastLoginAt: longAgo } });
    const neverButOld = await createUser({ username: "nev_filtre" });
    await db.user.update({ where: { id: neverButOld.id }, data: { createdAt: longAgo } });

    const owners = await client.get("/admin/users?filter=OWNERS&query=_filtre");
    expect(owners.body.data.map((u: { username: string }) => u.username)).toEqual(["own_filtre"]);
    const inactive = await client.get("/admin/users?filter=INACTIVE&query=_filtre");
    expect(inactive.body.data.map((u: { username: string }) => u.username).sort()).toEqual([
      "nev_filtre",
      "old_filtre",
    ]);
  });
});

describe("mot de passe temporaire (A12b, D134)", () => {
  it("genere un mot de passe de 24 h, affiche une fois ; audit ; compte inconnu", async () => {
    const user = await createUser();
    const before = Date.now();
    const temp = await temporaryPassword(user.id);
    expect(temp.password.length).toBeGreaterThanOrEqual(16);
    const ttl = Date.parse(temp.expiresAt) - before;
    expect(ttl).toBeGreaterThan(23.9 * 3600 * 1000);
    expect(ttl).toBeLessThanOrEqual(24 * 3600 * 1000 + 1000);
    const token = await db.authToken.findFirstOrThrow({
      where: { userId: user.id, kind: "TEMP_PASSWORD" },
    });
    expect(token.tokenHash).not.toContain(temp.password);
    expect(await lastAudit()).toMatchObject({
      action: "user.temporary-password",
      targetType: "user",
      targetId: user.id,
    });
    const list = await client.get(`/admin/users?query=${user.username}`);
    expect(list.body.data[0].temporaryPasswordPending).toBe(true);
    expect((await client.post(`/admin/users/${UNKNOWN}/temporary-password`)).body.error.code).toBe(
      "ADMIN_008"
    );
  });

  it("connexion restreinte au choix d'un nouveau mot de passe, puis sessions fermees", async () => {
    const user = await createUser();
    // Une session ouverte avec l'ancien mot de passe avant la reinitialisation.
    const before = await createClient(app);
    expect((await login(before, user.username, user.password)).status).toBe(200);
    const temp = await temporaryPassword(user.id);

    // L'ancien mot de passe reste valable tant que le temporaire n'a pas servi.
    const old = await createClient(app);
    const oldLogin = await login(old, user.username, user.password);
    expect(oldLogin.body.mustChoosePassword).toBe(false);

    const restricted = await createClient(app);
    const res = await login(restricted, user.username, temp.password);
    expect(res.status).toBe(200);
    expect(res.body.mustChoosePassword).toBe(true);
    expect((await restricted.get("/me")).body.mustChoosePassword).toBe(true);
    expect((await restricted.get("/spaces")).body.error.code).toBe("AUTH_011");
    expect((await restricted.patch("/me", { username: "autre_nom" })).body.error.code).toBe(
      "AUTH_011"
    );

    const weak = await restricted.post("/auth/choose-password", { password: "motdepasse" });
    expect(weak.body.error.code).toBe("AUTH_009");
    const chosen = await restricted.post("/auth/choose-password", { password: NEW_PASSWORD });
    expect(chosen.status).toBe(200);
    expect(chosen.body.mustChoosePassword).toBe(false);
    expect((await restricted.get("/spaces")).status).toBe(200);

    // Les autres sessions sont fermees ; seul le nouveau mot de passe ouvre le compte.
    expect((await before.get("/me")).body.error.code).toBe("AUTH_001");
    expect((await old.get("/me")).body.error.code).toBe("AUTH_001");
    expect((await login(await createClient(app), user.username, temp.password)).status).toBe(401);
    expect((await login(await createClient(app), user.username, user.password)).status).toBe(401);
    expect((await login(await createClient(app), user.username, NEW_PASSWORD)).status).toBe(200);
    const token = await db.authToken.findFirstOrThrow({
      where: { userId: user.id, kind: "TEMP_PASSWORD" },
    });
    expect(token.usedAt).not.toBeNull();
  });

  it("expire apres 24 h ; un nouveau remplace le precedent ; hors session restreinte refuse", async () => {
    const user = await createUser();
    const first = await temporaryPassword(user.id);
    const second = await temporaryPassword(user.id);
    expect((await login(await createClient(app), user.username, first.password)).status).toBe(401);

    const restricted = await createClient(app);
    expect((await login(restricted, user.username, second.password)).status).toBe(200);
    await db.authToken.updateMany({
      where: { userId: user.id, kind: "TEMP_PASSWORD" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const late = await restricted.post("/auth/choose-password", { password: NEW_PASSWORD });
    expect(late.body.error.code).toBe("AUTH_014");
    expect((await restricted.get("/me")).body.error.code).toBe("AUTH_001");
    expect((await login(await createClient(app), user.username, second.password)).status).toBe(401);

    const normal = await loginAs(user, app);
    expect(
      (await normal.post("/auth/choose-password", { password: NEW_PASSWORD })).body.error.code
    ).toBe("AUTH_014");
  });
});

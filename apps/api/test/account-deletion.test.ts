import { MAX_OWNED_SPACES } from "@fm/shared";
import { TEST_PASSWORD } from "@fm/test-utils";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createContext } from "../src/core/http/app.ts";
import { purgeDeletedSpaces } from "../src/core/spaces/service.ts";

import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";

const app = createTestApp();

type User = Awaited<ReturnType<typeof createUser>>;

/** Membre entre a une date donnee (l'anciennete designe le futur OWNER, D51). */
async function joinAt(spaceId: string, user: User, role: "MEMBER" | "MODERATOR", days: number) {
  await addMember(spaceId, user.id, role);
  await db.membership.update({
    where: { spaceId_userId: { spaceId, userId: user.id } },
    data: { joinedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  });
}

/**
 * Le compte supprime possede "Famille" (un MEMBER ancien, deux MODERATOR dont le
 * plus ancien herite) et "Solo" (seul membre), et il est MEMBER de "Amis".
 */
async function scenario() {
  const [user, oldMember, oldModerator, youngModerator, friend] = (await Promise.all(
    Array.from({ length: 5 }, () => createUser())
  )) as [User, User, User, User, User];
  const family = await createSpace(user.id, { name: "Famille" });
  await joinAt(family.id, oldMember, "MEMBER", 30);
  await joinAt(family.id, oldModerator, "MODERATOR", 20);
  await joinAt(family.id, youngModerator, "MODERATOR", 10);
  const solo = await createSpace(user.id, { name: "Solo" });
  const friends = await createSpace(friend.id, { name: "Amis" });
  await addMember(friends.id, user.id, "MEMBER");
  return { user, oldModerator, youngModerator, friend, family, solo, friends };
}

describe("apercu des consequences (D116, D51)", () => {
  it("liste chaque espace avec son issue et le futur OWNER", async () => {
    const s = await scenario();
    const client = await loginAs(s.user, app);
    const res = await client.get("/me/deletion-preview");
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      (res.body.spaces as { space: { name: string } }[]).map((item) => [item.space.name, item])
    );
    expect(byName.Famille).toMatchObject({
      role: "OWNER",
      outcome: "TRANSFERRED",
      newOwner: { id: s.oldModerator.id },
    });
    expect(byName.Solo).toMatchObject({ role: "OWNER", outcome: "DELETED", newOwner: null });
    expect(byName.Amis).toMatchObject({ role: "MEMBER", outcome: "LEFT", newOwner: null });
    expect(Object.keys(byName)).toHaveLength(3);
  });

  it("sans moderateur, le MEMBER le plus ancien herite ; un heritier au plafond est saute", async () => {
    const [owner, capped, next] = await Promise.all([createUser(), createUser(), createUser()]);
    const space = await createSpace(owner.id, { name: "Groupe" });
    await joinAt(space.id, capped, "MEMBER", 20);
    await joinAt(space.id, next, "MEMBER", 10);
    for (let i = 0; i < MAX_OWNED_SPACES; i += 1) await createSpace(capped.id);
    const client = await loginAs(owner, app);
    const res = await client.get("/me/deletion-preview");
    expect(res.body.spaces[0]).toMatchObject({ outcome: "TRANSFERRED", newOwner: { id: next.id } });
  });

  it("anonyme : AUTH_001", async () => {
    const client = await createClient(app);
    expect((await client.get("/me/deletion-preview")).body.error.code).toBe("AUTH_001");
    expect((await client.delete("/me", { password: TEST_PASSWORD })).body.error.code).toBe(
      "AUTH_001"
    );
  });
});

describe("suppression du compte (D20, D51)", () => {
  it("refuse un mauvais mot de passe", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    expect((await client.delete("/me", { password: "pas le bon" })).body.error.code).toBe(
      "AUTH_005"
    );
    expect((await client.get("/me")).status).toBe(200);
  });

  it("transfere, supprime, quitte, anonymise et ferme toutes les sessions", async () => {
    const s = await scenario();
    const client = await loginAs(s.user, app);
    const other = await loginAs(s.user, app);
    // Choses en cours qui doivent tomber.
    const invitee = await createUser();
    await client.post(`/spaces/${s.family.id}/invitations`, { username: invitee.username });
    const link = await client.post(`/spaces/${s.family.id}/invite-links`, {
      expiresInDays: 7,
      maxUses: null,
    });
    await client.post(`/spaces/${s.family.id}/transfers`, { toUserId: s.youngModerator.id });

    const res = await client.delete("/me", { password: TEST_PASSWORD });
    expect(res.status).toBe(204);

    // Sessions fermees, connexion impossible, username et email liberes.
    expect((await client.get("/me")).body.error.code).toBe("AUTH_001");
    expect((await other.get("/me")).body.error.code).toBe("AUTH_001");
    const login = await (
      await createClient(app)
    ).post("/auth/login", {
      identifier: s.user.username,
      password: TEST_PASSWORD,
    });
    expect(login.body.error.code).toBe("AUTH_002");
    const row = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.username).not.toBe(s.user.username);
    expect(row.email).not.toBe(s.user.email);
    expect(await db.userSession.count({ where: { userId: s.user.id } })).toBe(0);
    expect(await db.authToken.count({ where: { userId: s.user.id } })).toBe(0);

    // Famille : le MODERATOR le plus ancien devient OWNER.
    const family = await db.membership.findMany({
      where: { spaceId: s.family.id, leftAt: null },
      select: { userId: true, role: true },
    });
    expect(family.find((m) => m.role === "OWNER")?.userId).toBe(s.oldModerator.id);
    expect(family.map((m) => m.userId)).not.toContain(s.user.id);
    // Solo : supprime, restaurable par personne (le compte n'existe plus).
    const solo = await db.space.findUniqueOrThrow({ where: { id: s.solo.id } });
    expect(solo.deletedAt).not.toBeNull();
    // Amis : parti.
    const friends = await db.membership.findUniqueOrThrow({
      where: { spaceId_userId: { spaceId: s.friends.id, userId: s.user.id } },
    });
    expect(friends.leftAt).not.toBeNull();
    // Espace perso : supprime, purge a la prochaine tache horaire.
    const personal = await db.space.findUniqueOrThrow({ where: { id: s.user.personalSpaceId } });
    expect(personal.deletedAt).not.toBeNull();
    expect(personal.purgeAfter?.getTime()).toBeLessThanOrEqual(Date.now());
    await purgeDeletedSpaces(
      createContext({ env: testEnv, db, logger: pino({ level: "silent" }), modules: [] })
    );
    expect(await db.space.count({ where: { id: s.user.personalSpaceId } })).toBe(0);

    // Plus rien d'ouvert a son nom.
    expect(
      await db.spaceInvitation.count({ where: { inviterId: s.user.id, status: "PENDING" } })
    ).toBe(0);
    expect(await db.spaceInviteLink.count({ where: { id: link.body.id, revokedAt: null } })).toBe(
      0
    );
    expect(
      await db.spaceOwnershipTransfer.count({ where: { fromUserId: s.user.id, status: "PENDING" } })
    ).toBe(0);

    // L'ancien username est de nouveau libre.
    const again = await (
      await createClient(app)
    ).post("/auth/register", {
      username: s.user.username,
      email: s.user.email,
      password: "Un-nouveau-mot-de-passe-42",
    });
    expect(again.status).toBe(201);
  });

  it("previent les modules par le crochet onMemberLeft (ACCOUNT_DELETED)", async () => {
    const s = await scenario();
    const seen: string[] = [];
    const hookedApp = createTestApp({
      hooks: {
        onSpaceDeleted: [],
        onMemberLeft: [
          (_tx, event) => {
            seen.push(`${event.spaceId}:${event.reason}`);
            return Promise.resolve();
          },
        ],
        storageKeys: [],
      },
    });
    const client = await loginAs(s.user, hookedApp);
    expect((await client.delete("/me", { password: TEST_PASSWORD })).status).toBe(204);
    expect(seen).toEqual(
      expect.arrayContaining([`${s.family.id}:ACCOUNT_DELETED`, `${s.friends.id}:ACCOUNT_DELETED`])
    );
  });
});

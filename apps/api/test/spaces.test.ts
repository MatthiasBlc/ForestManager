import { MAX_OWNED_SPACES } from "@fm/shared";
import { NOT_FOUND_UUID } from "@fm/test-utils";
import { describe, expect, it } from "vitest";

import { pino } from "pino";

import { createContext } from "../src/core/http/app.ts";
import { purgeDeletedSpaces } from "../src/core/spaces/service.ts";
import { createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { describePermissions, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

describePermissions("permissions des espaces", [
  { name: "GET /spaces/:id", key: "space.view", call: (c, f) => c.get(`/spaces/${f.spaceId}`) },
  {
    name: "PATCH /spaces/:id",
    key: "space.update",
    call: (c, f) => c.patch(`/spaces/${f.spaceId}`, { tintIndex: 2 }),
  },
  {
    name: "DELETE /spaces/:id",
    key: "space.delete",
    call: (c, f) => c.delete(`/spaces/${f.spaceId}`),
  },
  {
    name: "POST /spaces/:id/restore",
    key: "space.restore",
    call: (c, f) => c.post(`/spaces/${f.spaceId}/restore`),
  },
  {
    name: "POST /spaces/:id/leave",
    key: "space.leave",
    call: (c, f) => c.post(`/spaces/${f.spaceId}/leave`, {}),
  },
  {
    name: "GET /spaces/:id/members",
    key: "space.members.view",
    call: (c, f) => c.get(`/spaces/${f.spaceId}/members`),
  },
  {
    name: "PATCH /spaces/:id/members/:userId",
    key: "space.members.role",
    call: (c, f) => c.patch(`/spaces/${f.spaceId}/members/${f.extra.id}`, { role: "MODERATOR" }),
  },
  {
    name: "DELETE /spaces/:id/members/:userId (MEMBER)",
    key: "space.members.exclude.member",
    call: (c, f) => c.delete(`/spaces/${f.spaceId}/members/${f.extra.id}`),
  },
  {
    name: "DELETE /spaces/:id/members/:userId (MODERATOR)",
    key: "space.members.exclude.moderator",
    call: async (c, f) => {
      // Cible : un second moderateur (on ne s'exclut pas soi-meme).
      await db.membership.updateMany({
        where: { spaceId: f.spaceId, userId: f.extra.id },
        data: { role: "MODERATOR" },
      });
      return c.delete(`/spaces/${f.spaceId}/members/${f.extra.id}`);
    },
  },
  {
    name: "POST /spaces/:id/transfers",
    key: "space.ownership.transfer",
    call: (c, f) => c.post(`/spaces/${f.spaceId}/transfers`, { toUserId: f.extra.id }),
  },
  {
    name: "GET /spaces/:id/transfer",
    key: "space.members.view",
    call: (c, f) => c.get(`/spaces/${f.spaceId}/transfer`),
  },
]);

describe("creer, lister, lire, modifier", () => {
  it("cree un espace groupe avec Recettes actif ; le createur est OWNER", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const res = await client.post("/spaces", {
      name: "Famille",
      description: "Chez nous",
      tintIndex: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kind: "GROUP",
      name: "Famille",
      tintIndex: 3,
      myRole: "OWNER",
      memberCount: 1,
      modules: [{ code: "recipes", sortOrder: 0 }],
    });
    const list = await client.get("/spaces");
    expect(list.body.data.map((s: { kind: string }) => s.kind)).toEqual(["PERSONAL", "GROUP"]);
  });

  it("plafonne a 20 espaces possedes (D51)", async () => {
    const user = await createUser();
    for (let i = 0; i < MAX_OWNED_SPACES; i += 1) await createSpace(user.id);
    const client = await loginAs(user, app);
    const res = await client.post("/spaces", { name: "Un de trop" });
    expect(res.body.error.code).toBe("SPACE_009");
  });

  it("espace inexistant ou invalide", async () => {
    const client = await loginAs(await createUser(), app);
    expect((await client.get(`/spaces/${NOT_FOUND_UUID}`)).body.error.code).toBe("SPACE_001");
    expect((await client.get("/spaces/not-a-uuid")).body.error.code).toBe("VALIDATION_001");
  });

  it("modifie nom, description, teinte ; efface la description", async () => {
    const f = await groupFixture();
    const client = await loginAs(f.moderator, app);
    const res = await client.patch(`/spaces/${f.spaceId}`, {
      name: "Nouveau nom",
      description: null,
      tintIndex: 5,
    });
    expect(res.body).toMatchObject({
      name: "Nouveau nom",
      description: null,
      tintIndex: 5,
      myRole: "MODERATOR",
    });
  });

  it("espace perso : seule la teinte change ; ni suppression, ni depart, ni transfert", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const id = user.personalSpaceId;
    expect((await client.patch(`/spaces/${id}`, { tintIndex: 4 })).body.tintIndex).toBe(4);
    expect((await client.patch(`/spaces/${id}`, { name: "Autre" })).body.error.code).toBe(
      "SPACE_003"
    );
    expect((await client.delete(`/spaces/${id}`)).body.error.code).toBe("SPACE_003");
    expect((await client.post(`/spaces/${id}/leave`, {})).body.error.code).toBe("SPACE_003");
    expect(
      (await client.post(`/spaces/${id}/transfers`, { toUserId: user.id })).body.error.code
    ).toBe("SPACE_003");
  });

  it("l'espace perso d'un autre est invisible", async () => {
    const other = await createUser();
    const client = await loginAs(await createUser(), app);
    expect((await client.get(`/spaces/${other.personalSpaceId}`)).body.error.code).toBe(
      "SPACE_001"
    );
  });
});

describe("membres", () => {
  it("liste les membres, OWNER puis MODERATOR puis MEMBER", async () => {
    const f = await groupFixture();
    const client = await loginAs(f.member, app);
    const res = await client.get(`/spaces/${f.spaceId}/members`);
    expect(res.body.data.map((m: { role: string }) => m.role)).toEqual([
      "OWNER",
      "MODERATOR",
      "MEMBER",
      "MEMBER",
    ]);
    expect(Object.keys(res.body.data[0].user).sort()).toEqual(["avatarUrl", "id", "username"]);
  });

  it("promouvoir puis retrograder ; jamais vers ou depuis OWNER", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const url = `/spaces/${f.spaceId}/members/${f.member.id}`;
    expect((await owner.patch(url, { role: "MODERATOR" })).status).toBe(200);
    expect((await owner.patch(url, { role: "MODERATOR" })).body.error.code).toBe("SPACE_008");
    expect((await owner.patch(url, { role: "MEMBER" })).status).toBe(200);
    expect((await owner.patch(url, { role: "OWNER" })).body.error.code).toBe("VALIDATION_001");
    expect(
      (await owner.patch(`/spaces/${f.spaceId}/members/${f.owner.id}`, { role: "MEMBER" })).body
        .error.code
    ).toBe("SPACE_019");
    expect(
      (await owner.patch(`/spaces/${f.spaceId}/members/${f.outsider.id}`, { role: "MEMBER" })).body
        .error.code
    ).toBe("SPACE_007");
  });

  it("un moderateur exclut un MEMBER mais jamais un moderateur ni l'OWNER (D53)", async () => {
    const f = await groupFixture();
    const other = await createUser();
    await addMember(f.spaceId, other.id, "MODERATOR");
    const mod = await loginAs(f.moderator, app);
    expect((await mod.delete(`/spaces/${f.spaceId}/members/${other.id}`)).body.error.code).toBe(
      "SPACE_002"
    );
    expect((await mod.delete(`/spaces/${f.spaceId}/members/${f.owner.id}`)).body.error.code).toBe(
      "SPACE_002"
    );
    expect((await mod.delete(`/spaces/${f.spaceId}/members/${f.member.id}`)).status).toBe(204);
    const row = await db.membership.findFirstOrThrow({
      where: { spaceId: f.spaceId, userId: f.member.id },
    });
    expect(row.leftAt).not.toBeNull();
    expect(row.excludedAt).not.toBeNull();
    const excluded = await loginAs(f.member, app);
    expect((await excluded.get(`/spaces/${f.spaceId}`)).body.error.code).toBe("SPACE_001");
  });

  it("quitter : un membre part ; l'OWNER doit transferer ; seul, il confirme la suppression", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    expect((await member.post(`/spaces/${f.spaceId}/leave`, {})).status).toBe(204);
    const row = await db.membership.findFirstOrThrow({
      where: { spaceId: f.spaceId, userId: f.member.id },
    });
    expect(row).toMatchObject({ excludedAt: null });
    expect(row.leftAt).not.toBeNull();
    const owner = await loginAs(f.owner, app);
    expect((await owner.post(`/spaces/${f.spaceId}/leave`, {})).body.error.code).toBe("SPACE_004");

    const solo = await createUser();
    const space = await createSpace(solo.id);
    const soloClient = await loginAs(solo, app);
    expect((await soloClient.post(`/spaces/${space.id}/leave`, {})).body.error.code).toBe(
      "SPACE_005"
    );
    expect(
      (await soloClient.post(`/spaces/${space.id}/leave`, { confirmDeletion: true })).status
    ).toBe(204);
    const deleted = await db.space.findUniqueOrThrow({ where: { id: space.id } });
    expect(deleted.deletedAt).not.toBeNull();
  });
});

describe("transfert de propriete (D92)", () => {
  it("propose, une seule a la fois, puis le destinataire accepte : l'ancien OWNER devient MODERATOR", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const proposed = await owner.post(`/spaces/${f.spaceId}/transfers`, { toUserId: f.member.id });
    expect(proposed.status).toBe(201);
    expect(proposed.body).toMatchObject({ status: "PENDING", toUser: { id: f.member.id } });
    expect(
      (await owner.post(`/spaces/${f.spaceId}/transfers`, { toUserId: f.extra.id })).body.error.code
    ).toBe("SPACE_010");
    const member = await loginAs(f.member, app);
    expect((await member.get("/me/transfers")).body.data).toHaveLength(1);
    expect((await member.get(`/spaces/${f.spaceId}/transfer`)).body.transfer.id).toBe(
      proposed.body.id
    );
    // Seul le destinataire repond.
    const extra = await loginAs(f.extra, app);
    expect(
      (await extra.post(`/spaces/${f.spaceId}/transfers/${proposed.body.id}/accept`)).body.error
        .code
    ).toBe("SPACE_011");
    expect(
      (await member.post(`/spaces/${f.spaceId}/transfers/${proposed.body.id}/accept`)).status
    ).toBe(204);
    const roles = await db.membership.findMany({
      where: { spaceId: f.spaceId, userId: { in: [f.owner.id, f.member.id] } },
    });
    expect(Object.fromEntries(roles.map((r) => [r.userId, r.role]))).toEqual({
      [f.owner.id]: "MODERATOR",
      [f.member.id]: "OWNER",
    });
    expect(
      (await member.post(`/spaces/${f.spaceId}/transfers/${proposed.body.id}/accept`)).body.error
        .code
    ).toBe("COMMON_006");
  });

  it("refuser, annuler ; un depart du destinataire annule la proposition", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const member = await loginAs(f.member, app);
    const first = await owner.post(`/spaces/${f.spaceId}/transfers`, { toUserId: f.member.id });
    expect(
      (await member.post(`/spaces/${f.spaceId}/transfers/${first.body.id}/decline`)).status
    ).toBe(204);
    const second = await owner.post(`/spaces/${f.spaceId}/transfers`, { toUserId: f.member.id });
    expect(
      (await owner.post(`/spaces/${f.spaceId}/transfers/${second.body.id}/cancel`)).status
    ).toBe(204);
    const third = await owner.post(`/spaces/${f.spaceId}/transfers`, { toUserId: f.member.id });
    await member.post(`/spaces/${f.spaceId}/leave`, {});
    const row = await db.spaceOwnershipTransfer.findUniqueOrThrow({ where: { id: third.body.id } });
    expect(row.status).toBe("CANCELLED");
    expect(
      (await owner.post(`/spaces/${f.spaceId}/transfers`, { toUserId: f.outsider.id })).body.error
        .code
    ).toBe("SPACE_007");
  });
});

describe("suppression, restauration, purge (D22)", () => {
  it("supprime (masque), liste chez l'OWNER, restaure", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    expect((await owner.delete(`/spaces/${f.spaceId}`)).status).toBe(204);
    const member = await loginAs(f.member, app);
    expect((await member.get(`/spaces/${f.spaceId}`)).body.error.code).toBe("SPACE_001");
    expect(
      (await member.get("/spaces")).body.data.some((s: { id: string }) => s.id === f.spaceId)
    ).toBe(false);
    const listed = (await owner.get("/spaces")).body.data.find(
      (s: { id: string }) => s.id === f.spaceId
    );
    expect(listed.deletedAt).not.toBeNull();
    expect(new Date(listed.purgeAfter).getTime() - Date.now()).toBeGreaterThan(
      29 * 24 * 3600 * 1000
    );
    const restored = await owner.post(`/spaces/${f.spaceId}/restore`);
    expect(restored.body).toMatchObject({ id: f.spaceId, deletedAt: null, purgeAfter: null });
    expect((await owner.post(`/spaces/${f.spaceId}/restore`)).body.error.code).toBe("SPACE_016");
  });

  it("refuse la restauration apres le delai, puis la purge efface tout et appelle les crochets", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    await owner.delete(`/spaces/${f.spaceId}`);
    await db.space.update({
      where: { id: f.spaceId },
      data: { purgeAfter: new Date(Date.now() - 1000) },
    });
    expect((await owner.post(`/spaces/${f.spaceId}/restore`)).body.error.code).toBe("SPACE_017");
    const seen: string[] = [];
    const ctx = createContext({
      env: testEnv,
      db,
      logger: pino({ level: "silent" }),
      modules: [],
      hooks: {
        onSpaceDeleted: [
          (_tx, id) => {
            seen.push(id);
            return Promise.resolve();
          },
        ],
        onMemberLeft: [],
      },
    });
    expect(await purgeDeletedSpaces(ctx)).toBe(1);
    expect(seen).toEqual([f.spaceId]);
    expect(await db.space.findUnique({ where: { id: f.spaceId } })).toBeNull();
    expect(await db.membership.count({ where: { spaceId: f.spaceId } })).toBe(0);
  });
});

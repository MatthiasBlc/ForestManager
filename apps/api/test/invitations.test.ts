import { NOT_FOUND_UUID } from "@fm/test-utils";
import { describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createUser } from "./helpers/factories.ts";
import { describePermissions, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();
const link: { expiresInDays: number; maxUses: number | null } = { expiresInDays: 7, maxUses: null };

describePermissions("permissions des invitations", [
  {
    name: "GET /spaces/:id/invite-links",
    key: "space.invites.manage",
    call: (c, f) => c.get(`/spaces/${f.spaceId}/invite-links`),
  },
  {
    name: "POST /spaces/:id/invite-links",
    key: "space.invites.manage",
    call: (c, f) => c.post(`/spaces/${f.spaceId}/invite-links`, link),
  },
  {
    name: "DELETE /spaces/:id/invite-links/:linkId",
    key: "space.invites.manage",
    call: async (c, f) => {
      const owner = await loginAs(f.owner, app);
      const created = await owner.post(`/spaces/${f.spaceId}/invite-links`, link);
      return c.delete(`/spaces/${f.spaceId}/invite-links/${created.body.id}`);
    },
  },
  {
    name: "GET /spaces/:id/invitations",
    key: "space.invites.manage",
    call: (c, f) => c.get(`/spaces/${f.spaceId}/invitations`),
  },
  {
    name: "POST /spaces/:id/invitations",
    key: "space.invites.manage",
    call: (c, f) => c.post(`/spaces/${f.spaceId}/invitations`, { username: f.outsider.username }),
  },
  {
    name: "POST /spaces/:id/invitations/:invitationId/cancel",
    key: "space.invites.manage",
    call: async (c, f) => {
      const invitation = await db.spaceInvitation.create({
        data: { spaceId: f.spaceId, inviterId: f.owner.id, inviteeId: f.outsider.id },
      });
      return c.post(`/spaces/${f.spaceId}/invitations/${invitation.id}/cancel`);
    },
  },
]);

async function createLink(
  spaceId: string,
  user: { username: string; password: string },
  body = link
) {
  const client = await loginAs(user, app);
  const res = await client.post(`/spaces/${spaceId}/invite-links`, body);
  expect(res.status).toBe(201);
  return res.body as { id: string; code: string };
}

describe("liens d'invitation (D07, D94, D62)", () => {
  it("cree un lien (code montre une fois), apercu public, rejoindre, liste des liens actifs", async () => {
    const f = await groupFixture();
    const created = await createLink(f.spaceId, f.moderator);
    expect(created.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const stored = await db.spaceInviteLink.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.codeHash).not.toContain(created.code);

    const anonymous = await createClient(app);
    const preview = await anonymous.get(`/invite-links/${created.code}`);
    expect(preview.status).toBe(200);
    expect(preview.body.space).toEqual({
      name: expect.any(String),
      tintIndex: expect.any(Number),
      avatarUrl: null,
      memberCount: 4,
    });
    expect((await anonymous.post(`/invite-links/${created.code}/join`)).body.error.code).toBe(
      "AUTH_001"
    );

    const outsider = await loginAs(f.outsider, app);
    const joined = await outsider.post(`/invite-links/${created.code}/join`);
    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({ id: f.spaceId, myRole: "MEMBER", memberCount: 5 });
    expect((await outsider.post(`/invite-links/${created.code}/join`)).body.error.code).toBe(
      "SPACE_006"
    );

    const moderator = await loginAs(f.moderator, app);
    const links = await moderator.get(`/spaces/${f.spaceId}/invite-links`);
    expect(links.body.data).toEqual([expect.objectContaining({ id: created.id, useCount: 1 })]);
    expect(links.body.data[0]).not.toHaveProperty("code");
  });

  it("un lien revoque, expire, epuise ou inconnu ne montre rien (SPACE_014)", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const outsider = await loginAs(f.outsider, app);

    const once = await createLink(f.spaceId, f.owner, { expiresInDays: 1, maxUses: 1 });
    expect((await outsider.post(`/invite-links/${once.code}/join`)).status).toBe(200);
    const late = await loginAs(await createUser(), app);
    expect((await late.post(`/invite-links/${once.code}/join`)).body.error.code).toBe("SPACE_014");

    const revoked = await createLink(f.spaceId, f.owner);
    expect((await owner.delete(`/spaces/${f.spaceId}/invite-links/${revoked.id}`)).status).toBe(
      204
    );
    expect(
      (await owner.delete(`/spaces/${f.spaceId}/invite-links/${revoked.id}`)).body.error.code
    ).toBe("COMMON_006");
    expect((await late.get(`/invite-links/${revoked.code}`)).body.error.code).toBe("SPACE_014");

    const expired = await createLink(f.spaceId, f.owner);
    await db.spaceInviteLink.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await late.get(`/invite-links/${expired.code}`)).body.error.code).toBe("SPACE_014");

    expect((await late.get(`/invite-links/${"a".repeat(22)}`)).body.error.code).toBe("SPACE_014");
    expect((await late.get("/invite-links/trop-court")).body.error.code).toBe("VALIDATION_001");
    expect(
      (await owner.delete(`/spaces/${f.spaceId}/invite-links/${NOT_FOUND_UUID}`)).body.error.code
    ).toBe("SPACE_018");
    const links = await owner.get(`/spaces/${f.spaceId}/invite-links`);
    expect(links.body.data).toEqual([]);
  });

  it("deux arrivees simultanees ne depassent pas le nombre de personnes", async () => {
    const f = await groupFixture();
    const created = await createLink(f.spaceId, f.owner, { expiresInDays: 1, maxUses: 1 });
    const [a, b] = await Promise.all([
      loginAs(await createUser(), app),
      loginAs(await createUser(), app),
    ]);
    const results = await Promise.all([
      a.post(`/invite-links/${created.code}/join`),
      b.post(`/invite-links/${created.code}/join`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
    const stored = await db.spaceInviteLink.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.useCount).toBe(1);
  });

  it("un ancien membre revient par un lien ; un membre exclu non (D59, D149)", async () => {
    const f = await groupFixture();
    const created = await createLink(f.spaceId, f.owner);
    const member = await loginAs(f.member, app);
    expect((await member.post(`/spaces/${f.spaceId}/leave`, {})).status).toBe(204);
    expect((await member.post(`/invite-links/${created.code}/join`)).body.myRole).toBe("MEMBER");

    const owner = await loginAs(f.owner, app);
    expect((await owner.delete(`/spaces/${f.spaceId}/members/${f.extra.id}`)).status).toBe(204);
    const extra = await loginAs(f.extra, app);
    expect((await extra.post(`/invite-links/${created.code}/join`)).body.error.code).toBe(
      "SPACE_015"
    );
  });

  it("pas de lien dans un espace perso ; un espace supprime revoque ses liens", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    expect(
      (await client.post(`/spaces/${user.personalSpaceId}/invite-links`, link)).body.error.code
    ).toBe("SPACE_003");

    const f = await groupFixture();
    const created = await createLink(f.spaceId, f.owner);
    const owner = await loginAs(f.owner, app);
    expect((await owner.delete(`/spaces/${f.spaceId}`)).status).toBe(204);
    expect((await client.get(`/invite-links/${created.code}`)).body.error.code).toBe("SPACE_014");
  });

  it("valide la duree et le nombre de personnes", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    for (const body of [
      { expiresInDays: 3, maxUses: null },
      { expiresInDays: 7, maxUses: 0 },
      { expiresInDays: 7 },
    ]) {
      expect((await owner.post(`/spaces/${f.spaceId}/invite-links`, body)).body.error.code).toBe(
        "VALIDATION_001"
      );
    }
  });
});

describe("invitations par username (D07, D50)", () => {
  it("meme reponse que le compte existe ou non ; une seule invitation en attente", async () => {
    const f = await groupFixture();
    const moderator = await loginAs(f.moderator, app);
    const path = `/spaces/${f.spaceId}/invitations`;
    const cases = [
      f.outsider.username.toUpperCase(),
      f.outsider.username,
      "inconnu_total",
      f.member.username,
    ];
    for (const username of cases) {
      const res = await moderator.post(path, { username });
      expect(res.status).toBe(202);
      expect(res.body).toEqual({});
    }
    const pending = await moderator.get(path);
    expect(pending.body.data).toEqual([
      expect.objectContaining({
        status: "PENDING",
        invitee: expect.objectContaining({ id: f.outsider.id }),
        inviter: expect.objectContaining({ id: f.moderator.id }),
      }),
    ]);
  });

  it("l'invite voit, accepte ; refuse ; l'auteur annule", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const path = `/spaces/${f.spaceId}/invitations`;
    await owner.post(path, { username: f.outsider.username });

    const outsider = await loginAs(f.outsider, app);
    const mine = await outsider.get("/me/invitations");
    expect(mine.body.data).toHaveLength(1);
    const invitationId = mine.body.data[0].id as string;

    // Un autre que l'invite ne la voit pas.
    const member = await loginAs(f.member, app);
    expect((await member.post(`/me/invitations/${invitationId}/accept`)).body.error.code).toBe(
      "SPACE_012"
    );

    const accepted = await outsider.post(`/me/invitations/${invitationId}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ id: f.spaceId, myRole: "MEMBER" });
    expect((await outsider.post(`/me/invitations/${invitationId}/decline`)).body.error.code).toBe(
      "COMMON_006"
    );
    expect((await outsider.get("/me/invitations")).body.data).toEqual([]);

    const other = await createUser();
    await owner.post(path, { username: other.username });
    const otherClient = await loginAs(other, app);
    const [received] = (await otherClient.get("/me/invitations")).body.data as { id: string }[];
    expect((await otherClient.post(`/me/invitations/${received?.id}/decline`)).status).toBe(204);

    const third = await createUser();
    await owner.post(path, { username: third.username });
    const [sent] = (await owner.get(path)).body.data as { id: string }[];
    expect((await owner.post(`${path}/${sent?.id}/cancel`)).status).toBe(204);
    expect((await owner.post(`${path}/${sent?.id}/cancel`)).body.error.code).toBe("COMMON_006");
    expect((await owner.post(`${path}/${NOT_FOUND_UUID}/cancel`)).body.error.code).toBe(
      "SPACE_012"
    );
    const thirdClient = await loginAs(third, app);
    expect((await thirdClient.get("/me/invitations")).body.data).toEqual([]);
  });

  it("un membre exclu revient seulement par invitation directe", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    await owner.delete(`/spaces/${f.spaceId}/members/${f.member.id}`);
    await owner.post(`/spaces/${f.spaceId}/invitations`, { username: f.member.username });
    const member = await loginAs(f.member, app);
    const [invitation] = (await member.get("/me/invitations")).body.data as { id: string }[];
    expect((await member.post(`/me/invitations/${invitation?.id}/accept`)).status).toBe(200);
    const row = await db.membership.findUniqueOrThrow({
      where: { spaceId_userId: { spaceId: f.spaceId, userId: f.member.id } },
    });
    expect(row).toMatchObject({ leftAt: null, excludedAt: null, role: "MEMBER" });
  });

  it("rejoindre par un lien accepte l'invitation directe en attente", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    await owner.post(`/spaces/${f.spaceId}/invitations`, { username: f.outsider.username });
    const created = await createLink(f.spaceId, f.owner);
    const outsider = await loginAs(f.outsider, app);
    await outsider.post(`/invite-links/${created.code}/join`);
    expect((await outsider.get("/me/invitations")).body.data).toEqual([]);
    expect((await owner.get(`/spaces/${f.spaceId}/invitations`)).body.data).toEqual([]);
  });

  it("l'invitation d'un espace supprime disparait", async () => {
    const owner = await createUser();
    const invitee = await createUser();
    const ownerClient = await loginAs(owner, app);
    const space = await ownerClient.post("/spaces", { name: "Ephemere" });
    await addMember(space.body.id, (await createUser()).id);
    await ownerClient.post(`/spaces/${space.body.id}/invitations`, { username: invitee.username });
    await ownerClient.delete(`/spaces/${space.body.id}`);
    const client = await loginAs(invitee, app);
    expect((await client.get("/me/invitations")).body.data).toEqual([]);
  });
});

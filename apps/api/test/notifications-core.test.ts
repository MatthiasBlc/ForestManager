// Evenements du socle branches sur les notifications et l'activite (C6.4)
// [P02, P03, P08, P09, P14, D92, D121, D172].
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { createAdmin, loginAdmin } from "./helpers/admin.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";

const app = createTestApp();

async function notificationsOf(userId: string) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

async function activityOf(spaceId: string) {
  return (
    await db.activityEvent.findMany({ where: { spaceId }, orderBy: { createdAt: "asc" } })
  ).map((event) => [event.type, event.actorId]);
}

async function family() {
  const owner = await createUser();
  const moderator = await createUser();
  const member = await createUser();
  const space = await createSpace(owner.id, { name: "Famille" });
  await addMember(space.id, moderator.id, "MODERATOR");
  await addMember(space.id, member.id);
  return { owner, moderator, member, space };
}

describe("invitations et arrivees (P02, P03)", () => {
  it("l'invite par nom est prevenu une fois, sans lien vers l'espace qu'il ne voit pas encore", async () => {
    const { owner, space } = await family();
    const guest = await createUser();
    const client = await loginAs(owner, app);
    for (let i = 0; i < 2; i++) {
      expect(
        (await client.post(`/spaces/${space.id}/invitations`, { username: guest.username })).status
      ).toBe(202);
    }
    const rows = await notificationsOf(guest.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "core.invitation.received",
      spaceId: null,
      actorId: owner.id,
      data: { spaceName: "Famille" },
    });
  });

  it("une arrivee previent l'OWNER et les moderateurs (regroupee) et entre dans l'activite", async () => {
    const { owner, moderator, member, space } = await family();
    const ownerClient = await loginAs(owner, app);
    const link = await ownerClient.post(`/spaces/${space.id}/invite-links`, {
      expiresInDays: 7,
      maxUses: null,
    });
    const first = await createUser();
    const second = await createUser();
    for (const user of [first, second]) {
      const client = await loginAs(user, app);
      expect((await client.post(`/invite-links/${link.body.code}/join`)).status).toBe(200);
    }
    // Par invitation acceptee aussi.
    const third = await createUser();
    await ownerClient.post(`/spaces/${space.id}/invitations`, { username: third.username });
    const invitation = await db.spaceInvitation.findFirstOrThrow({
      where: { inviteeId: third.id },
    });
    const thirdClient = await loginAs(third, app);
    expect((await thirdClient.post(`/me/invitations/${invitation.id}/accept`)).status).toBe(200);

    for (const manager of [owner, moderator]) {
      const joined = (await notificationsOf(manager.id)).filter(
        (n) => n.type === "core.member.joined"
      );
      expect(joined).toHaveLength(1);
      expect(joined[0]).toMatchObject({ spaceId: space.id, count: 3, actorId: third.id });
    }
    expect(await notificationsOf(member.id)).toEqual([]);
    expect(await activityOf(space.id)).toEqual([
      ["core.member.joined", first.id],
      ["core.member.joined", second.id],
      ["core.member.joined", third.id],
    ]);
  });
});

describe("departs (P08, D53)", () => {
  it("un depart previent les responsables ; une exclusion previent l'exclu sans lien vers l'espace", async () => {
    const { owner, moderator, member, space } = await family();
    const leaver = await createUser();
    await addMember(space.id, leaver.id);
    const leaverClient = await loginAs(leaver, app);
    expect((await leaverClient.post(`/spaces/${space.id}/leave`, {})).status).toBe(204);
    const left = (await notificationsOf(owner.id)).filter((n) => n.type === "core.member.left");
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ actorId: leaver.id, spaceId: space.id });

    const moderatorClient = await loginAs(moderator, app);
    expect((await moderatorClient.delete(`/spaces/${space.id}/members/${member.id}`)).status).toBe(
      204
    );
    const excluded = await notificationsOf(member.id);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toMatchObject({
      type: "core.member.excluded",
      spaceId: null,
      data: { spaceName: "Famille" },
    });
    expect(await activityOf(space.id)).toEqual([["core.member.left", leaver.id]]);
  });
});

describe("transfert de propriete (D92)", () => {
  it("le destinataire est prevenu de la proposition, l'OWNER de la reponse", async () => {
    const { owner, moderator, space } = await family();
    const ownerClient = await loginAs(owner, app);
    const proposed = await ownerClient.post(`/spaces/${space.id}/transfers`, {
      toUserId: moderator.id,
    });
    expect(proposed.status).toBe(201);
    expect((await notificationsOf(moderator.id)).map((n) => n.type)).toEqual([
      "core.transfer.proposed",
    ]);
    const moderatorClient = await loginAs(moderator, app);
    await moderatorClient.post(`/spaces/${space.id}/transfers/${proposed.body.id}/decline`);
    const again = await ownerClient.post(`/spaces/${space.id}/transfers`, {
      toUserId: moderator.id,
    });
    await moderatorClient.post(`/spaces/${space.id}/transfers/${again.body.id}/accept`);
    expect((await notificationsOf(owner.id)).map((n) => n.type)).toEqual([
      "core.transfer.declined",
      "core.transfer.accepted",
    ]);
  });
});

describe("suppression et restauration (P14)", () => {
  it("les autres membres sont prevenus de la suppression puis de la restauration", async () => {
    const { owner, member, space } = await family();
    const client = await loginAs(owner, app);
    expect((await client.delete(`/spaces/${space.id}`)).status).toBe(204);
    const deleted = await notificationsOf(member.id);
    expect(deleted[0]).toMatchObject({
      type: "core.space.deleted",
      spaceId: null,
      actorId: owner.id,
      data: { spaceName: "Famille" },
    });
    expect(await notificationsOf(owner.id)).toEqual([]);
    expect((await client.post(`/spaces/${space.id}/restore`)).status).toBe(200);
    expect((await notificationsOf(member.id)).map((n) => [n.type, n.spaceId])).toEqual([
      ["core.space.deleted", null],
      ["core.space.restored", space.id],
    ]);
  });
});

describe("modules et moderation (P09, D121, D172)", () => {
  it("l'OWNER est prevenu d'une decision sur une demande ; l'activation entre dans l'activite", async () => {
    const { owner, space } = await family();
    const ownerClient = await loginAs(owner, app);
    const admin = await createAdmin();
    const adminClient = await loginAdmin(admin, app);

    await ownerClient.post(`/spaces/${space.id}/modules/meal-plan/requests`, {});
    const first = await db.moduleAccessRequest.findFirstOrThrow({ where: { spaceId: space.id } });
    await adminClient.post(`/admin/module-requests/${first.id}/reject`, { note: "Pas encore" });
    await ownerClient.post(`/spaces/${space.id}/modules/meal-plan/requests`, {});
    const second = await db.moduleAccessRequest.findFirstOrThrow({
      where: { spaceId: space.id, status: "PENDING" },
    });
    await adminClient.post(`/admin/module-requests/${second.id}/approve`);
    expect((await notificationsOf(owner.id)).map((n) => [n.type, n.spaceId, n.data])).toEqual([
      ["core.module.rejected", space.id, { moduleCode: "meal-plan", reason: "Pas encore" }],
      ["core.module.granted", space.id, { moduleCode: "meal-plan" }],
    ]);

    expect(
      (await ownerClient.patch(`/spaces/${space.id}/modules/meal-plan`, { enabled: true })).status
    ).toBe(200);
    expect(await activityOf(space.id)).toEqual([["core.module.enabled", owner.id]]);
  });

  it("l'OWNER est prevenu d'un acces de moderation, avec le motif", async () => {
    const { owner, member, space } = await family();
    const admin = await createAdmin();
    const adminClient = await loginAdmin(admin, app);
    const opened = await adminClient.post(`/admin/spaces/${space.id}/moderation`, {
      reason: "MEMBER_REPORT",
      note: "Signalement d'une recette",
    });
    expect(opened.status).toBe(201);
    const rows = await notificationsOf(owner.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "core.moderation.opened",
      category: "core.platform",
      spaceId: space.id,
      actorId: null,
      data: { reason: "MEMBER_REPORT", note: "Signalement d'une recette" },
    });
    expect(await notificationsOf(member.id)).toEqual([]);
  });
});

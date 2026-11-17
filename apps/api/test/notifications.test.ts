// Centre de notifications et preferences (C6.1) [F-NOT-1, F-NOT-2, D118, D190].
import { NOT_FOUND_UUID } from "@fm/test-utils";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createContext } from "../src/core/http/app.ts";
import { notify, purgeNotifications } from "../src/core/notifications/service.ts";
import { MODULES } from "../src/modules/index.ts";
import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";

const app = createTestApp();
const ctx = createContext({
  env: testEnv,
  db,
  logger: pino({ level: "silent" }),
  modules: MODULES,
});

async function family() {
  const owner = await createUser();
  const member = await createUser();
  const space = await createSpace(owner.id, { name: "Famille" });
  await addMember(space.id, member.id, "MEMBER");
  return { owner, member, space };
}

describe("notify() (service du socle)", () => {
  it("ecrit une notification par destinataire, jamais pour l'auteur de l'action", async () => {
    const { owner, member, space } = await family();
    await notify(ctx, {
      type: "core.member.joined",
      recipients: [owner.id, member.id, owner.id],
      spaceId: space.id,
      actorId: member.id,
      data: { spaceName: "Famille" },
    });
    const rows = await db.notification.findMany({ where: { spaceId: space.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: owner.id,
      type: "core.member.joined",
      category: "core.members",
      spaceId: space.id,
      actorId: member.id,
      count: 1,
    });
  });

  it("refuse un type non declare (erreur de programmation)", async () => {
    const { owner } = await family();
    await expect(notify(ctx, { type: "core.nope", recipients: [owner.id] })).rejects.toThrow(
      /unknown notification type/
    );
  });

  it("respecte les preferences : globale, reglage de l'espace, categorie obligatoire, defaut", async () => {
    const { owner, space } = await family();
    const other = await createSpace(owner.id, { name: "Amis" });
    await db.notificationPreference.create({
      data: { userId: owner.id, category: "core.members", enabled: false },
    });
    await db.notificationPreference.create({
      data: { userId: owner.id, spaceId: other.id, category: "core.members", enabled: true },
    });
    for (const spaceId of [space.id, other.id]) {
      await notify(ctx, { type: "core.member.left", recipients: [owner.id], spaceId });
    }
    // Obligatoire : passe meme si tout est coupe [D121].
    await db.notificationPreference.create({
      data: { userId: owner.id, category: "core.platform", enabled: false },
    });
    await notify(ctx, {
      type: "core.moderation.opened",
      recipients: [owner.id],
      spaceId: space.id,
    });
    // "Nouvelles recettes" est coupee par defaut.
    await notify(ctx, {
      type: "recipes.recipe.created",
      recipients: [owner.id],
      spaceId: space.id,
      moduleCode: "recipes",
    });
    const rows = await db.notification.findMany({
      where: { userId: owner.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((row) => [row.type, row.spaceId])).toEqual([
      ["core.member.left", other.id],
      ["core.moderation.opened", space.id],
    ]);
  });

  it("regroupe par groupKey tant que la notification n'est pas lue, sur 24 h", async () => {
    const { owner, member, space } = await family();
    const event = {
      type: "core.member.joined",
      recipients: [owner.id],
      spaceId: space.id,
      groupKey: `joined:${space.id}`,
    };
    await notify(ctx, { ...event, actorId: member.id });
    const third = await createUser();
    await notify(ctx, { ...event, actorId: third.id, data: { last: true } });
    let rows = await db.notification.findMany({ where: { userId: owner.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: 2, actorId: third.id, data: { last: true } });

    // Lue : la suivante repart a 1.
    await db.notification.updateMany({ where: { userId: owner.id }, data: { readAt: new Date() } });
    await notify(ctx, event);
    // Plus vieille que 24 h : pas de regroupement non plus.
    await db.notification.updateMany({
      where: { userId: owner.id, readAt: null },
      data: { createdAt: new Date(Date.now() - 25 * 3600 * 1000) },
    });
    await notify(ctx, event);
    rows = await db.notification.findMany({ where: { userId: owner.id } });
    expect(rows.map((row) => row.count).sort()).toEqual([1, 1, 2]);
  });

  it("purge les lues de plus de 30 jours et toutes celles de plus de 90 jours [D190]", async () => {
    const { owner } = await family();
    const day = 24 * 3600 * 1000;
    const at = (days: number) => new Date(Date.now() - days * day);
    const base = { userId: owner.id, type: "core.member.left", category: "core.members" };
    await db.notification.createMany({
      data: [
        { ...base, createdAt: at(31), readAt: at(31) },
        { ...base, createdAt: at(31) },
        { ...base, createdAt: at(91) },
        { ...base, createdAt: at(2), readAt: at(1) },
      ],
    });
    expect(await purgeNotifications(db)).toBe(2);
    expect(await db.notification.count({ where: { userId: owner.id } })).toBe(2);
  });
});

describe("GET /me/notifications et lecture", () => {
  it("demande une session", async () => {
    const anonymous = await createClient(app);
    expect((await anonymous.get("/me/notifications")).status).toBe(401);
  });

  it("liste les siennes, les plus recentes d'abord, par curseur, avec l'espace et l'acteur", async () => {
    const { owner, member, space } = await family();
    for (let i = 0; i < 3; i++) {
      await notify(ctx, {
        type: "core.member.joined",
        recipients: [owner.id],
        spaceId: space.id,
        actorId: member.id,
        data: { n: i },
      });
    }
    await notify(ctx, { type: "core.release.published", recipients: [member.id] });
    const client = await loginAs(owner, app);
    const first = await client.get("/me/notifications?limit=2");
    expect(first.status).toBe(200);
    expect(first.body.data.map((n: { data: { n: number } }) => n.data.n)).toEqual([2, 1]);
    expect(first.body.data[0]).toMatchObject({
      type: "core.member.joined",
      category: "core.members",
      space: { id: space.id, name: "Famille" },
      actor: { id: member.id, username: member.username },
      count: 1,
      readAt: null,
    });
    const second = await client.get(`/me/notifications?limit=2&cursor=${first.body.nextCursor}`);
    expect(second.body.data.map((n: { data: { n: number } }) => n.data.n)).toEqual([0]);
    expect(second.body.nextCursor).toBeNull();
    expect((await client.get("/me/notifications/unread-count")).body).toEqual({ count: 3 });
  });

  it("masque les notifications d'un espace qu'on a quitte", async () => {
    const { owner, member, space } = await family();
    await notify(ctx, { type: "core.member.left", recipients: [member.id], spaceId: space.id });
    await db.membership.update({
      where: { spaceId_userId: { spaceId: space.id, userId: member.id } },
      data: { leftAt: new Date() },
    });
    const client = await loginAs(member, app);
    expect((await client.get("/me/notifications")).body.data).toEqual([]);
    expect((await client.get("/me/notifications/unread-count")).body).toEqual({ count: 0 });
    expect(owner.id).toBeTruthy();
  });

  it("marque une notification lue, puis toutes ; jamais celle d'un autre", async () => {
    const { owner, member, space } = await family();
    for (let i = 0; i < 2; i++) {
      await notify(ctx, { type: "core.member.left", recipients: [owner.id], spaceId: space.id });
    }
    await notify(ctx, { type: "core.release.published", recipients: [member.id] });
    const [mine] = await db.notification.findMany({ where: { userId: owner.id } });
    const [theirs] = await db.notification.findMany({ where: { userId: member.id } });
    const client = await loginAs(owner, app);
    expect((await client.post(`/me/notifications/${theirs?.id}/read`)).status).toBe(404);
    expect((await client.post(`/me/notifications/${NOT_FOUND_UUID}/read`)).body.error.code).toBe(
      "NOTIF_001"
    );
    expect((await client.post(`/me/notifications/${mine?.id}/read`)).status).toBe(204);
    expect((await client.get("/me/notifications/unread-count")).body).toEqual({ count: 1 });
    expect((await client.post("/me/notifications/read-all")).status).toBe(204);
    expect((await client.get("/me/notifications/unread-count")).body).toEqual({ count: 0 });
    expect(await db.notification.count({ where: { userId: member.id, readAt: null } })).toBe(1);
  });
});

describe("preferences (F-NOT-2, D118)", () => {
  it("liste les categories reglables du socle et des modules actifs, et les espaces groupes", async () => {
    const { owner, space } = await family();
    const client = await loginAs(owner, app);
    const res = await client.get("/me/notification-preferences");
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([
      { key: "core.members", moduleCode: null, enabled: true },
      { key: "core.releases", moduleCode: null, enabled: true },
      { key: "recipes.sharing", moduleCode: "recipes", enabled: true },
      { key: "recipes.new", moduleCode: "recipes", enabled: false },
    ]);
    // Un espace : ses categories par espace, sans les nouveautes ; l'espace perso n'y est pas.
    expect(res.body.spaces).toEqual([
      {
        spaceId: space.id,
        custom: false,
        categories: [
          { key: "core.members", moduleCode: null, enabled: true },
          { key: "recipes.sharing", moduleCode: "recipes", enabled: true },
          { key: "recipes.new", moduleCode: "recipes", enabled: false },
        ],
      },
    ]);
  });

  it("change une categorie globale ; refuse une categorie obligatoire ou inconnue", async () => {
    const { owner, space } = await family();
    const client = await loginAs(owner, app);
    const res = await client.put("/me/notification-preferences", {
      category: "recipes.new",
      enabled: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.categories[3]).toEqual({
      key: "recipes.new",
      moduleCode: "recipes",
      enabled: true,
    });
    // Un espace sans reglage suit les globales.
    expect(res.body.spaces[0].categories[2].enabled).toBe(true);
    for (const category of ["core.platform", "core.nope"]) {
      const refused = await client.put("/me/notification-preferences", {
        category,
        enabled: false,
      });
      expect(refused.body.error.code).toBe("NOTIF_002");
    }
    expect(space.id).toBeTruthy();
  });

  it("personnalise un espace, puis revient aux reglages globaux", async () => {
    const { owner, space } = await family();
    const client = await loginAs(owner, app);
    const custom = await client.put(`/me/notification-preferences/spaces/${space.id}`, {
      categories: { "core.members": true, "recipes.sharing": false, "recipes.new": false },
    });
    expect(custom.status).toBe(200);
    expect(custom.body.spaces[0]).toMatchObject({
      custom: true,
      categories: [
        { key: "core.members", enabled: true },
        { key: "recipes.sharing", enabled: false },
        { key: "recipes.new", enabled: false },
      ],
    });
    const refused = await client.put(`/me/notification-preferences/spaces/${space.id}`, {
      categories: { "core.releases": true },
    });
    expect(refused.body.error.code).toBe("NOTIF_002");
    const outsider = await createUser();
    const foreign = await createSpace(outsider.id);
    const hidden = await client.put(`/me/notification-preferences/spaces/${foreign.id}`, {
      categories: {},
    });
    expect(hidden.body.error.code).toBe("SPACE_001");

    const reset = await client.delete(`/me/notification-preferences/spaces/${space.id}`);
    expect(reset.status).toBe(200);
    expect(reset.body.spaces[0].custom).toBe(false);
    expect(await db.notificationPreference.count({ where: { spaceId: space.id } })).toBe(0);
  });
});

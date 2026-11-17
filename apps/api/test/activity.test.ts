// Fil d'activite d'un espace (C6.3) [F-SPC-7].
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { recordActivity } from "../src/core/activity/service.ts";
import { createContext } from "../src/core/http/app.ts";
import { MODULES } from "../src/modules/index.ts";
import { createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { describePermissions } from "./helpers/roles.ts";

const app = createTestApp();

/** Ordre d'enregistrement : n = 0, 1, 2, puis la recette (sans n). */
function rank(data: unknown): number {
  const n = (data as { n?: number } | null)?.n;
  return typeof n === "number" ? n : 3;
}
const ctx = createContext({
  env: testEnv,
  db,
  logger: pino({ level: "silent" }),
  modules: MODULES,
});

describePermissions("permissions du fil d'activite", [
  {
    name: "GET /spaces/:id/activity",
    key: "space.activity.view",
    call: (c, f) => c.get(`/spaces/${f.spaceId}/activity`),
  },
]);

describe("fil d'activite (F-SPC-7)", () => {
  it("enregistre des evenements declares et les liste du plus recent au plus ancien", async () => {
    const owner = await createUser();
    const member = await createUser();
    const space = await createSpace(owner.id, { name: "Famille" });
    await addMember(space.id, member.id);
    for (let i = 0; i < 3; i++) {
      await recordActivity(ctx, {
        spaceId: space.id,
        type: "core.member.joined",
        actorId: member.id,
        data: { n: i },
      });
    }
    await recordActivity(ctx, {
      spaceId: space.id,
      type: "recipes.recipe.created",
      moduleCode: "recipes",
      actorId: owner.id,
      targetType: "recipe",
      targetId: "6f1c2a54-7a8b-4c1d-9e2f-0a1b2c3d4e5f",
      data: { title: "Gratin" },
    });
    // Horodatages distincts : deux evenements de la meme milliseconde se departagent par id.
    const events = await db.activityEvent.findMany({
      where: { spaceId: space.id },
      orderBy: { createdAt: "asc" },
    });
    const start = Date.now();
    const ranked = events.sort((a, b) => rank(a.data) - rank(b.data));
    for (const [i, event] of ranked.entries()) {
      await db.activityEvent.update({
        where: { id: event.id },
        data: { createdAt: new Date(start + i * 1000) },
      });
    }
    const client = await loginAs(member, app);
    const first = await client.get(`/spaces/${space.id}/activity?limit=2`);
    expect(first.status).toBe(200);
    expect(first.body.data[0]).toMatchObject({
      type: "recipes.recipe.created",
      moduleCode: "recipes",
      actor: { id: owner.id, username: owner.username },
      targetType: "recipe",
      data: { title: "Gratin" },
    });
    expect(first.body.data[1].data).toEqual({ n: 2 });
    const rest = await client.get(`/spaces/${space.id}/activity?cursor=${first.body.nextCursor}`);
    expect(rest.body.data.map((e: { data: { n: number } }) => e.data.n)).toEqual([1, 0]);
    expect(rest.body.nextCursor).toBeNull();
  });

  it("refuse un type non declare ; un acteur parti reste nomme, un compte supprime ne l'est plus", async () => {
    const owner = await createUser();
    const space = await createSpace(owner.id);
    await expect(
      recordActivity(ctx, { spaceId: space.id, type: "core.nope", actorId: owner.id })
    ).rejects.toThrow(/unknown activity type/);
    const gone = await createUser();
    await recordActivity(ctx, { spaceId: space.id, type: "core.member.left", actorId: gone.id });
    await db.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    const client = await loginAs(owner, app);
    const res = await client.get(`/spaces/${space.id}/activity`);
    expect(res.body.data[0].actor).toBeNull();
  });
});

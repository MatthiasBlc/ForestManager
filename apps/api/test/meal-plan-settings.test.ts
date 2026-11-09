// Planning (C5.1) : reglages d'un espace [D11, D58, D180], droits du lecteur,
// role minimal reglable par l'OWNER [F-MPL-3], espace perso [F-MPL-1].
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser, grantModule } from "./helpers/factories.ts";
import { ACTORS, clientAs, expectPermission, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

beforeAll(async () => {
  await db.module.update({ where: { code: "meal-plan" }, data: { status: "AVAILABLE" } });
});

async function plannedGroup() {
  const f = await groupFixture();
  await grantModule(f.spaceId, "meal-plan");
  return f;
}

const settingsOf = (spaceId: string) => `/spaces/${spaceId}/meal-plan/settings`;

describe("reglages du planning (D11, D180)", () => {
  it("valeurs par defaut sans ligne en base : midi et soir, 4 portions, lundi, MEMBER", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const res = await member.get(settingsOf(f.spaceId));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      mealTimes: ["LUNCH", "DINNER"],
      defaultServings: 4,
      weekStartsOn: "MON",
      editRole: "MEMBER",
      can: { edit: true, manage: false, setEditRole: false },
    });
  });

  it("un moderateur regle repas, portions et debut de semaine ; repas remis dans l'ordre", async () => {
    const f = await plannedGroup();
    const moderator = await loginAs(f.moderator, app);
    const res = await moderator.put(settingsOf(f.spaceId), {
      mealTimes: ["DINNER", "LUNCH"],
      defaultServings: 6,
      weekStartsOn: "SUN",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mealTimes: ["LUNCH", "DINNER"],
      defaultServings: 6,
      weekStartsOn: "SUN",
      editRole: "MEMBER",
      can: { edit: true, manage: true, setEditRole: false },
    });
    const again = await moderator.get(settingsOf(f.spaceId));
    expect(again.body.mealTimes).toEqual(["LUNCH", "DINNER"]);
  });

  it("refuse une liste de repas vide, en double ou hors midi et soir, et des portions hors 1 a 50", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    for (const body of [
      { mealTimes: [], defaultServings: 4, weekStartsOn: "MON" },
      { mealTimes: ["LUNCH", "LUNCH"], defaultServings: 4, weekStartsOn: "MON" },
      { mealTimes: ["LUNCH"], defaultServings: 0, weekStartsOn: "MON" },
      { mealTimes: ["LUNCH"], defaultServings: 51, weekStartsOn: "MON" },
      { mealTimes: ["BREAKFAST"], defaultServings: 4, weekStartsOn: "MON" },
    ]) {
      const res = await owner.put(settingsOf(f.spaceId), body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_001");
    }
  });

  it("le module doit etre actif dans l'espace", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const res = await member.get(settingsOf(f.spaceId));
    expect(res.body.error.code).toBe("MODULE_001");
  });
});

describe("role minimal pour modifier un repas (F-MPL-3, D58)", () => {
  it("seul l'OWNER le change ; un moderateur qui l'envoie est refuse", async () => {
    const f = await plannedGroup();
    const moderator = await loginAs(f.moderator, app);
    const denied = await moderator.put(settingsOf(f.spaceId), {
      mealTimes: ["LUNCH", "DINNER"],
      defaultServings: 4,
      weekStartsOn: "MON",
      editRole: "MODERATOR",
    });
    expect(denied.body.error.code).toBe("SPACE_002");

    const owner = await loginAs(f.owner, app);
    const res = await owner.put(settingsOf(f.spaceId), {
      mealTimes: ["LUNCH", "DINNER"],
      defaultServings: 4,
      weekStartsOn: "MON",
      editRole: "MODERATOR",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      editRole: "MODERATOR",
      can: { edit: true, manage: true, setEditRole: true },
    });
  });

  it("un moderateur peut renvoyer le role actuel sans le changer", async () => {
    const f = await plannedGroup();
    const moderator = await loginAs(f.moderator, app);
    const res = await moderator.put(settingsOf(f.spaceId), {
      mealTimes: ["LUNCH"],
      defaultServings: 2,
      weekStartsOn: "MON",
      editRole: "MEMBER",
    });
    expect(res.status).toBe(200);
  });

  it("un MEMBER perd le droit de modifier quand l'OWNER releve le role minimal", async () => {
    const f = await plannedGroup();
    await db.mealPlanSettings.create({ data: { spaceId: f.spaceId, editRole: "MODERATOR" } });
    const member = await loginAs(f.member, app);
    const res = await member.get(settingsOf(f.spaceId));
    expect(res.body.can).toEqual({ edit: false, manage: false, setEditRole: false });
  });
});

describe("matrice B2 des reglages", () => {
  for (const actor of ACTORS) {
    const canRead = actor === "MEMBER" || actor === "MODERATOR" || actor === "OWNER";
    const canWrite = actor === "MODERATOR" || actor === "OWNER";
    it(`lire - ${actor} ${canRead ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      expectPermission(actor, canRead, await client.get(settingsOf(f.spaceId)));
    });
    it(`regler - ${actor} ${canWrite ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      const res = await client.put(settingsOf(f.spaceId), {
        mealTimes: ["LUNCH"],
        defaultServings: 3,
        weekStartsOn: "MON",
      });
      expectPermission(actor, canWrite, res);
    });
  }
});

describe("espace perso (F-MPL-1)", () => {
  it("son proprietaire a tous les droits", async () => {
    const user = await createUser();
    const space = await db.space.findFirstOrThrow({ where: { personalUserId: user.id } });
    await grantModule(space.id, "meal-plan");
    const client = await loginAs(user, app);
    const res = await client.get(settingsOf(space.id));
    expect(res.status).toBe(200);
    expect(res.body.can).toEqual({ edit: true, manage: true, setEditRole: true });
  });
});

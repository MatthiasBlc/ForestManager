// Planning (C5.2) : calendrier continu [D180], repas recette / texte / "Pas de
// repas" [D181], verrou, echange [D184], recette devenue invisible [D184],
// compteurs D39 sur le detail d'une recette.
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createSpace, grantModule } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";
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

const mealsOf = (spaceId: string) => `/spaces/${spaceId}/meal-plan/meals`;
const mealAt = (spaceId: string, date: string, mealTime: string) =>
  `${mealsOf(spaceId)}/${date}/${mealTime}`;

async function period(client: Client, spaceId: string, from: string, to: string) {
  const res = await client.get(`${mealsOf(spaceId)}?from=${from}&to=${to}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data as Record<string, unknown>[];
}

/** Date ISO a `days` jours d'aujourd'hui (UTC). */
function dayFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("lire une periode (D180)", () => {
  it("une semaine sans repas renvoie une liste vide", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    expect(await period(member, f.spaceId, "2026-11-09", "2026-11-15")).toEqual([]);
  });

  it("refuse une periode a l'envers ou de plus de 31 jours", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    for (const [from, to] of [
      ["2026-11-15", "2026-11-09"],
      ["2026-11-01", "2026-12-02"],
      ["2026-11-01", "demain"],
    ]) {
      const res = await member.get(`${mealsOf(f.spaceId)}?from=${from}&to=${to}`);
      expect(res.body.error.code, `${from} ${to}`).toBe("VALIDATION_001");
    }
  });

  it("ne renvoie que les repas de la periode, tries par date puis midi avant soir", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    for (const [date, mealTime, text] of [
      ["2026-11-10", "DINNER", "Soupe"],
      ["2026-11-10", "LUNCH", "Cantine"],
      ["2026-11-09", "DINNER", "Pizza"],
      ["2026-11-16", "LUNCH", "Hors periode"],
    ] as const) {
      await member.put(mealAt(f.spaceId, date, mealTime), { kind: "TEXT", text });
    }
    const meals = await period(member, f.spaceId, "2026-11-09", "2026-11-15");
    expect(meals.map((m) => m.title)).toEqual(["Pizza", "Cantine", "Soupe"]);
  });

  it("un repas que l'espace ne planifie plus n'est pas renvoye", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), { kind: "TEXT", text: "Cantine" });
    await db.mealPlanSettings.create({ data: { spaceId: f.spaceId, mealTimes: ["DINNER"] } });
    expect(await period(member, f.spaceId, "2026-11-09", "2026-11-15")).toEqual([]);
  });
});

describe("ecrire un repas (D181)", () => {
  it("recette de l'espace : titre, photo, portions et auteur de la modification", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const recipe = await createRecipe(member, f.spaceId, { title: "Dahl de lentilles" });
    const res = await member.put(mealAt(f.spaceId, "2026-11-10", "DINNER"), {
      kind: "RECIPE",
      recipeId: recipe.id,
      comment: "Sans coriandre",
      servings: 6,
      locked: true,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: "2026-11-10",
      mealTime: "DINNER",
      kind: "RECIPE",
      title: "Dahl de lentilles",
      recipe: { id: recipe.id, imageUrl: null },
      comment: "Sans coriandre",
      servings: 6,
      locked: true,
      updatedBy: { id: f.member.id, username: f.member.username },
    });
  });

  it("recette partagee dans l'espace : acceptee (F-MPL-5)", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const elsewhere = await createSpace(f.member.id);
    const recipe = await createRecipe(member, elsewhere.id, { title: "Curry" });
    await member.put(`/spaces/${elsewhere.id}/recipes/${recipe.id}/shares`, {
      spaceIds: [f.spaceId],
    });
    const res = await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Curry");
  });

  it("refuse une recette qui n'est pas visible dans l'espace", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const elsewhere = await createSpace(f.member.id);
    const recipe = await createRecipe(member, elsewhere.id);
    const res = await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    expect(res.body.error.code).toBe("RECIPE_001");
  });

  it('texte libre, puis "Pas de repas" qui efface le reste', async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const url = mealAt(f.spaceId, "2026-11-10", "LUNCH");
    const text = await member.put(url, {
      kind: "TEXT",
      text: "Resto japonais",
      comment: "Reserver",
    });
    expect(text.body).toMatchObject({ kind: "TEXT", title: "Resto japonais", recipe: null });
    const skipped = await member.put(url, { kind: "SKIPPED" });
    expect(skipped.body).toMatchObject({
      kind: "SKIPPED",
      title: null,
      comment: null,
      servings: null,
      locked: false,
    });
  });

  it('refuse un "Pas de repas" verrouille, un texte vide et des portions hors 1 a 50', async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const url = mealAt(f.spaceId, "2026-11-10", "LUNCH");
    for (const body of [
      { kind: "SKIPPED", locked: true },
      { kind: "TEXT", text: "  " },
      { kind: "TEXT", text: "Soupe", servings: 0 },
      { kind: "TEXT", text: "Soupe", servings: 51 },
      { kind: "RECIPE" },
    ]) {
      const res = await member.put(url, body);
      expect(res.body.error?.code, JSON.stringify(body)).toBe("VALIDATION_001");
    }
  });

  it("refuse un repas que l'espace ne planifie pas, une date ou un repas invalides", async () => {
    const f = await plannedGroup();
    await db.mealPlanSettings.create({ data: { spaceId: f.spaceId, mealTimes: ["DINNER"] } });
    const member = await loginAs(f.member, app);
    const lunch = await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "TEXT",
      text: "Soupe",
    });
    expect(lunch.body.error.code).toBe("MEAL_001");
    for (const url of [
      mealAt(f.spaceId, "2026-13-40", "DINNER"),
      mealAt(f.spaceId, "2026-11-10", "BREAKFAST"),
    ]) {
      const res = await member.put(url, { kind: "TEXT", text: "Soupe" });
      expect(res.body.error.code, url).toBe("VALIDATION_001");
    }
  });

  it("vider un repas le retire ; vider une case vide reussit aussi", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const url = mealAt(f.spaceId, "2026-11-10", "LUNCH");
    await member.put(url, { kind: "TEXT", text: "Soupe" });
    expect((await member.delete(url)).status).toBe(204);
    expect((await member.delete(url)).status).toBe(204);
    expect(await period(member, f.spaceId, "2026-11-10", "2026-11-10")).toEqual([]);
  });
});

describe("recette devenue invisible (D184)", () => {
  it("retiree de l'espace : le repas garde son dernier titre, sans lien", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const elsewhere = await createSpace(f.member.id);
    const recipe = await createRecipe(member, elsewhere.id, { title: "Curry" });
    await member.put(`/spaces/${elsewhere.id}/recipes/${recipe.id}/shares`, {
      spaceIds: [f.spaceId],
    });
    await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    await member.put(`/spaces/${elsewhere.id}/recipes/${recipe.id}/shares`, { spaceIds: [] });
    const [meal] = await period(member, f.spaceId, "2026-11-10", "2026-11-10");
    expect(meal).toMatchObject({ kind: "RECIPE", title: "Curry", recipe: null });
  });

  it("supprimee puis purgee : le repas reste lisible", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const recipe = await createRecipe(member, f.spaceId, { title: "Gratin" });
    await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    await db.recipeBlock.deleteMany({ where: { recipeId: recipe.id } });
    await db.recipeRevision.deleteMany({ where: { recipeId: recipe.id } });
    await db.recipe.delete({ where: { id: recipe.id } });
    const [meal] = await period(member, f.spaceId, "2026-11-10", "2026-11-10");
    expect(meal).toMatchObject({ kind: "RECIPE", title: "Gratin", recipe: null });
  });

  it("masquee par la moderation : sans lien pour les autres membres", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const recipe = await createRecipe(owner, f.spaceId, { title: "Gratin" });
    await owner.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    await db.recipe.update({
      where: { id: recipe.id },
      data: { hiddenAt: new Date(), hiddenReason: "Contenu signale" },
    });
    const member = await loginAs(f.member, app);
    const [meal] = await period(member, f.spaceId, "2026-11-10", "2026-11-10");
    expect(meal).toMatchObject({ title: "Gratin", recipe: null });
  });

  it("le titre suit la recette tant qu'elle est visible", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const recipe = await createRecipe(member, f.spaceId, { title: "Gratin" });
    await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    await db.recipe.update({ where: { id: recipe.id }, data: { title: "Gratin dauphinois" } });
    const [meal] = await period(member, f.spaceId, "2026-11-10", "2026-11-10");
    expect(meal).toMatchObject({ title: "Gratin dauphinois", recipe: { id: recipe.id } });
  });
});

describe("echanger deux repas (D69, D184)", () => {
  it("tout le contenu change de case, verrou compris", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
      kind: "TEXT",
      text: "Soupe",
      locked: true,
      servings: 2,
    });
    await member.put(mealAt(f.spaceId, "2026-11-11", "DINNER"), { kind: "SKIPPED" });
    const res = await member.post(`${mealsOf(f.spaceId)}/swap`, {
      a: { date: "2026-11-10", mealTime: "LUNCH" },
      b: { date: "2026-11-11", mealTime: "DINNER" },
    });
    expect(res.status).toBe(200);
    const meals = await period(member, f.spaceId, "2026-11-10", "2026-11-11");
    expect(meals).toMatchObject([
      { date: "2026-11-10", mealTime: "LUNCH", kind: "SKIPPED", locked: false },
      {
        date: "2026-11-11",
        mealTime: "DINNER",
        kind: "TEXT",
        title: "Soupe",
        locked: true,
        servings: 2,
      },
    ]);
  });

  it("echanger avec une case vide deplace le repas", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    await member.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), { kind: "TEXT", text: "Soupe" });
    await member.post(`${mealsOf(f.spaceId)}/swap`, {
      a: { date: "2026-11-10", mealTime: "LUNCH" },
      b: { date: "2026-11-12", mealTime: "LUNCH" },
    });
    const meals = await period(member, f.spaceId, "2026-11-10", "2026-11-12");
    expect(meals).toMatchObject([{ date: "2026-11-12", mealTime: "LUNCH", title: "Soupe" }]);
  });

  it("refuse d'echanger une case avec elle-meme", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const cell = { date: "2026-11-10", mealTime: "LUNCH" };
    const res = await member.post(`${mealsOf(f.spaceId)}/swap`, { a: cell, b: cell });
    expect(res.body.error.code).toBe("VALIDATION_001");
  });
});

describe("droits (F-MPL-3, D58)", () => {
  it("role minimal releve : un membre lit mais ne modifie plus", async () => {
    const f = await plannedGroup();
    await db.mealPlanSettings.create({ data: { spaceId: f.spaceId, editRole: "MODERATOR" } });
    const member = await loginAs(f.member, app);
    expect((await member.get(`${mealsOf(f.spaceId)}?from=2026-11-09&to=2026-11-15`)).status).toBe(
      200
    );
    const url = mealAt(f.spaceId, "2026-11-10", "LUNCH");
    for (const res of [
      await member.put(url, { kind: "TEXT", text: "Soupe" }),
      await member.delete(url),
      await member.post(`${mealsOf(f.spaceId)}/swap`, {
        a: { date: "2026-11-10", mealTime: "LUNCH" },
        b: { date: "2026-11-11", mealTime: "LUNCH" },
      }),
    ]) {
      expect(res.body.error.code).toBe("SPACE_002");
    }
  });

  for (const actor of ACTORS) {
    const allowed = actor === "MEMBER" || actor === "MODERATOR" || actor === "OWNER";
    it(`ecrire un repas - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      const res = await client.put(mealAt(f.spaceId, "2026-11-10", "LUNCH"), {
        kind: "TEXT",
        text: "Soupe",
      });
      expectPermission(actor, allowed, res);
    });
  }
});

describe("compteurs sur le detail d'une recette (D39)", () => {
  it("fois planifiee et derniere fois, seulement avec le planning actif", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const recipe = await createRecipe(member, f.spaceId);
    const detail = () => member.get(`/spaces/${f.spaceId}/recipes/${recipe.id}`);
    expect((await detail()).body.planning).toBeNull();

    await grantModule(f.spaceId, "meal-plan");
    expect((await detail()).body.planning).toEqual({ count: 0, lastOn: null });

    for (const [days, mealTime] of [
      [-10, "LUNCH"],
      [-3, "DINNER"],
      [4, "LUNCH"],
    ] as const) {
      await member.put(mealAt(f.spaceId, dayFromToday(days), mealTime), {
        kind: "RECIPE",
        recipeId: recipe.id,
      });
    }
    // Le futur compte comme planifie, pas comme cuisine.
    expect((await detail()).body.planning).toEqual({ count: 3, lastOn: dayFromToday(-3) });
  });
});

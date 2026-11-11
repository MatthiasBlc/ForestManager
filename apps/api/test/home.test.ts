// Accueil a widgets (C6b.3) [D60, D193].
import {
  activityWidgetSchema,
  homeResponseSchema,
  mostCookedWidgetSchema,
  recentRecipesWidgetSchema,
  upcomingMealsWidgetSchema,
  type HomeResponse,
} from "@fm/shared";
import { describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser, grantModule } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";

const app = createTestApp();

async function home(client: Client): Promise<HomeResponse> {
  const res = await client.get("/me/home");
  expect(res.status).toBe(200);
  return homeResponseSchema.parse(res.body);
}

function data(body: HomeResponse, key: string) {
  return body.widgets.find((w) => w.key === key)?.data;
}

/** Date du jour decalee de `days` (UTC, sans heure). */
function day(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

describe("GET /me/home", () => {
  it("exige une session", async () => {
    expect((await (await createClient(app)).get("/me/home")).status).toBe(401);
  });

  it("propose les widgets des modules actifs, ceux par defaut d'abord choisis", async () => {
    const lea = await createUser();
    const client = await loginAs(lea, app);
    const solo = await home(client);
    // Sans espace groupe ni Planning : seulement les recettes recentes.
    expect(solo.available.map((w) => w.key)).toEqual(["recipes.recent"]);
    expect(solo.widgets.map((w) => w.key)).toEqual(["recipes.recent"]);
    expect(solo.custom).toBe(false);

    const famille = await createSpace(lea.id);
    await grantModule(famille.id, "meal-plan");
    const full = await home(client);
    // Ordre propose par le registre (maquette D-ACCUEIL), activite coupee par defaut.
    expect(full.available).toEqual([
      { key: "meal-plan.upcoming", default: true },
      { key: "meal-plan.most-cooked", default: true },
      { key: "recipes.recent", default: true },
      { key: "core.activity", default: false },
    ]);
    expect(full.widgets.map((w) => w.key)).toEqual([
      "meal-plan.upcoming",
      "meal-plan.most-cooked",
      "recipes.recent",
    ]);
  });

  it("recettes recentes : celles de ses espaces, les plus recentes d'abord, une ligne chacune", async () => {
    const lea = await createUser();
    const sam = await createUser({ username: "sam_h1" });
    const famille = await createSpace(lea.id, { name: "Famille" });
    const amis = await createSpace(lea.id, { name: "Amis" });
    await addMember(famille.id, sam.id);
    const client = await loginAs(lea, app);
    const samClient = await loginAs(sam, app);
    const shared = await createRecipe(client, famille.id, { title: "Dahl" });
    await client.put(`/spaces/${famille.id}/recipes/${shared.id}/shares`, { spaceIds: [amis.id] });
    const hidden = await createRecipe(samClient, famille.id, { title: "Masquee" });
    await db.recipe.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });
    await createRecipe(samClient, famille.id, { title: "Tarte de Sam" });
    const stranger = await createUser();
    const elsewhere = await createSpace(stranger.id);
    await createRecipe(await loginAs(stranger, app), elsewhere.id, { title: "Ailleurs" });

    const recent = recentRecipesWidgetSchema.parse(data(await home(client), "recipes.recent"));
    expect(recent.recipes.map((r) => r.title)).toEqual(["Tarte de Sam", "Dahl"]);
    expect(recent.recipes[0]).toMatchObject({ spaceId: famille.id, author: "sam_h1" });
  });

  it("prochains repas : a partir d'aujourd'hui, par espace avec le Planning", async () => {
    const lea = await createUser();
    const famille = await createSpace(lea.id, { name: "Famille" });
    await grantModule(famille.id, "meal-plan");
    const client = await loginAs(lea, app);
    const gratin = await createRecipe(client, famille.id, { title: "Gratin" });
    await db.mealSlot.createMany({
      data: [
        { spaceId: famille.id, date: day(-1), mealTime: "DINNER", kind: "TEXT", text: "Hier" },
        { spaceId: famille.id, date: day(1), mealTime: "DINNER", kind: "TEXT", text: "Soupe" },
        {
          spaceId: famille.id,
          date: day(1),
          mealTime: "LUNCH",
          kind: "RECIPE",
          recipeId: gratin.id,
          text: "Gratin",
        },
        { spaceId: famille.id, date: day(2), mealTime: "LUNCH", kind: "SKIPPED" },
      ],
    });

    const upcoming = upcomingMealsWidgetSchema.parse(
      data(await home(client), "meal-plan.upcoming")
    );
    expect(upcoming.spaces).toHaveLength(1);
    expect(upcoming.spaces[0]).toMatchObject({ spaceId: famille.id, spaceName: "Famille" });
    expect(upcoming.spaces[0]?.meals).toEqual([
      {
        date: day(1).toISOString().slice(0, 10),
        mealTime: "LUNCH",
        title: "Gratin",
        recipeId: gratin.id,
      },
      {
        date: day(1).toISOString().slice(0, 10),
        mealTime: "DINNER",
        title: "Soupe",
        recipeId: null,
      },
    ]);
  });

  it("recettes les plus cuisinees : repas passes planifies, les plus frequents d'abord", async () => {
    const lea = await createUser();
    const famille = await createSpace(lea.id);
    await grantModule(famille.id, "meal-plan");
    const client = await loginAs(lea, app);
    const dahl = await createRecipe(client, famille.id, { title: "Dahl" });
    const gratin = await createRecipe(client, famille.id, { title: "Gratin" });
    const meal = (recipe: { id: string }, offset: number, title: string) => ({
      spaceId: famille.id,
      date: day(offset),
      mealTime: "DINNER" as const,
      kind: "RECIPE" as const,
      recipeId: recipe.id,
      text: title,
    });
    await db.mealSlot.createMany({
      data: [
        meal(gratin, -3, "Gratin"),
        meal(dahl, -2, "Dahl"),
        meal(dahl, -1, "Dahl"),
        meal(gratin, 3, "Gratin"),
        meal(gratin, 4, "Gratin"),
      ],
    });

    const cooked = mostCookedWidgetSchema.parse(data(await home(client), "meal-plan.most-cooked"));
    expect(cooked.recipes.map((r) => [r.title, r.count])).toEqual([
      ["Dahl", 2],
      ["Gratin", 1],
    ]);
  });
});

describe("PATCH /me/preferences homeWidgets", () => {
  it("enregistre l'ordre et le choix, refuse une cle inconnue, revient au defaut avec null", async () => {
    const lea = await createUser();
    const famille = await createSpace(lea.id, { name: "Famille" });
    const client = await loginAs(lea, app);
    await db.activityEvent.create({
      data: { spaceId: famille.id, type: "core.space.exported", actorId: lea.id },
    });

    const unknown = await client.patch("/me/preferences", { homeWidgets: ["recipes.nope"] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("VALIDATION_001");

    const saved = await client.patch("/me/preferences", {
      homeWidgets: ["core.activity", "recipes.recent"],
    });
    expect(saved.status).toBe(200);
    const body = await home(client);
    expect(body.custom).toBe(true);
    expect(body.widgets.map((w) => w.key)).toEqual(["core.activity", "recipes.recent"]);
    const activity = activityWidgetSchema.parse(data(body, "core.activity"));
    expect(activity.events).toEqual([
      expect.objectContaining({
        spaceId: famille.id,
        spaceName: "Famille",
        event: expect.objectContaining({ type: "core.space.exported" }),
      }),
    ]);

    await client.patch("/me/preferences", { homeWidgets: null });
    const reset = await home(client);
    expect(reset.custom).toBe(false);
    expect(reset.widgets.map((w) => w.key)).toEqual(["recipes.recent"]);
  });
});

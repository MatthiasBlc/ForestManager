// Recherche globale (C6b.1) [P16, D119, D191].
import type { SearchGroup } from "@fm/shared";
import { describe, expect, it } from "vitest";

import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser, grantModule } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";

const app = createTestApp();

function group(body: { groups: SearchGroup[] }, key: string) {
  return body.groups.find((g) => g.key === key)?.items ?? [];
}

/** Date du jour decalee de `days`, au format AAAA-MM-JJ (UTC). */
function day(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

describe("GET /search", () => {
  it("exige une session et au moins 2 caracteres", async () => {
    const anonymous = await createClient(app);
    expect((await anonymous.get("/search?q=gratin")).status).toBe(401);
    const user = await createUser();
    const client = await loginAs(user, app);
    expect((await client.get("/search?q=g")).status).toBe(400);
  });

  it("trouve les recettes de tous ses espaces, sans accents ni casse, avec le nom de l'espace", async () => {
    const lea = await createUser({ username: "lea_s1" });
    const famille = await createSpace(lea.id, { name: "Famille" });
    const client = await loginAs(lea, app);
    await createRecipe(client, famille.id, { title: "Gratin dauphinois" });
    await createRecipe(client, lea.personalSpaceId, { title: "Gâteau au chocolat" });
    await createRecipe(client, famille.id, { title: "Dahl" });

    const res = await client.get("/search?q=GRAT");
    expect(res.status).toBe(200);
    const recipes = group(res.body, "recipes.recipes");
    expect(recipes.map((r) => r.title)).toEqual(["Gratin dauphinois"]);
    expect(recipes[0]).toMatchObject({ spaceId: famille.id, spaceName: "Famille" });

    const cake = group((await client.get("/search?q=gateau")).body, "recipes.recipes");
    expect(cake.map((r) => r.spaceId)).toEqual([lea.personalSpaceId]);
  });

  it("ne montre que les espaces ou l'on est membre actif et ou le module est actif", async () => {
    const lea = await createUser();
    const sam = await createUser();
    const samSpace = await createSpace(sam.id, { name: "Colloc" });
    const off = await createSpace(lea.id, { name: "Sans recettes" });
    const samClient = await loginAs(sam, app);
    const leaClient = await loginAs(lea, app);
    await createRecipe(samClient, samSpace.id, { title: "Gratin de Sam" });
    await createRecipe(leaClient, off.id, { title: "Gratin coupe" });
    await db.spaceModule.updateMany({
      where: { spaceId: off.id, moduleCode: "recipes" },
      data: { enabled: false },
    });

    const res = await leaClient.get("/search?q=gratin");
    expect(group(res.body, "recipes.recipes")).toEqual([]);
  });

  it("donne une seule ligne par recette partagee, dans l'espace courant s'il la voit", async () => {
    const lea = await createUser();
    const famille = await createSpace(lea.id, { name: "Famille" });
    const amis = await createSpace(lea.id, { name: "Amis" });
    const client = await loginAs(lea, app);
    const recipe = await createRecipe(client, famille.id, { title: "Gratin" });
    const shared = await client.put(`/spaces/${famille.id}/recipes/${recipe.id}/shares`, {
      spaceIds: [amis.id],
    });
    expect(shared.status).toBe(200);

    const fromAmis = group(
      (await client.get(`/search?q=gratin&spaceId=${amis.id}`)).body,
      "recipes.recipes"
    );
    expect(fromAmis).toHaveLength(1);
    expect(fromAmis[0]).toMatchObject({ id: recipe.id, spaceId: amis.id, spaceName: "Amis" });

    const anywhere = group((await client.get("/search?q=gratin")).body, "recipes.recipes");
    expect(anywhere).toHaveLength(1);
    expect(anywhere[0]?.spaceId).toBe(famille.id);
  });

  it("cache une recette masquee par la moderation, sauf a son auteur", async () => {
    const lea = await createUser();
    const sam = await createUser();
    const famille = await createSpace(lea.id);
    await addMember(famille.id, sam.id);
    const leaClient = await loginAs(lea, app);
    const recipe = await createRecipe(leaClient, famille.id, { title: "Gratin" });
    await db.recipe.update({ where: { id: recipe.id }, data: { hiddenAt: new Date() } });

    const samClient = await loginAs(sam, app);
    expect(group((await samClient.get("/search?q=gratin")).body, "recipes.recipes")).toEqual([]);
    expect(group((await leaClient.get("/search?q=gratin")).body, "recipes.recipes")).toHaveLength(
      1
    );
  });

  it("marque les bases et limite chaque groupe a 5 resultats, debut du titre d'abord", async () => {
    const lea = await createUser();
    const client = await loginAs(lea, app);
    for (let i = 1; i <= 6; i++) {
      await createRecipe(client, lea.personalSpaceId, { title: `Pates ${String(i)}` });
    }
    await createRecipe(client, lea.personalSpaceId, { title: "Sauce pour pates", isBase: true });

    const recipes = group((await client.get("/search?q=pates")).body, "recipes.recipes");
    expect(recipes).toHaveLength(5);
    expect(recipes.every((r) => r.title.startsWith("Pates"))).toBe(true);
    const sauce = group((await client.get("/search?q=sauce")).body, "recipes.recipes");
    expect(sauce[0]?.data).toMatchObject({ isBase: true, adapted: false });
  });

  it("trouve les ingredients utilises dans l'espace courant, avec le nombre de recettes", async () => {
    const lea = await createUser();
    const famille = await createSpace(lea.id, { name: "Famille" });
    const client = await loginAs(lea, app);
    await createRecipe(client, famille.id, { title: "Gratin" });
    await createRecipe(client, famille.id, { title: "Salade" });
    await client.post("/ingredients", { name: "Patate douce" });

    const res = await client.get(`/search?q=pate&spaceId=${famille.id}`);
    const ingredients = group(res.body, "recipes.ingredients");
    expect(ingredients.map((i) => i.title)).toEqual(["Pâtes"]);
    expect(ingredients[0]).toMatchObject({ spaceId: famille.id, data: { recipeCount: 2 } });

    // Sans espace courant : l'espace perso, ou rien n'utilise les pates.
    expect(group((await client.get("/search?q=pate")).body, "recipes.ingredients")).toEqual([]);
  });

  it("trouve les membres des espaces partages et les espaces par leur nom", async () => {
    const lea = await createUser({ username: "lea_m1" });
    const sam = await createUser({ username: "samuel_m1" });
    const stranger = await createUser({ username: "samantha_m1" });
    const famille = await createSpace(lea.id, { name: "Famille Martin" });
    await addMember(famille.id, sam.id);
    await createSpace(stranger.id, { name: "Famille Dupont" });
    const client = await loginAs(lea, app);

    const members = group((await client.get("/search?q=sam")).body, "core.members");
    expect(members).toEqual([
      expect.objectContaining({ id: sam.id, title: "samuel_m1", spaceId: famille.id }),
    ]);
    // Pas soi-meme.
    expect(group((await client.get("/search?q=lea_m")).body, "core.members")).toEqual([]);

    const spaces = group((await client.get("/search?q=famille")).body, "core.spaces");
    expect(spaces).toEqual([
      expect.objectContaining({ id: famille.id, title: "Famille Martin", spaceId: famille.id }),
    ]);
  });

  it("trouve les repas du planning proches d'aujourd'hui", async () => {
    const lea = await createUser();
    const famille = await createSpace(lea.id, { name: "Famille" });
    await grantModule(famille.id, "meal-plan");
    const client = await loginAs(lea, app);
    const gratin = await createRecipe(client, famille.id, { title: "Gratin" });
    await db.mealSlot.createMany({
      data: [
        {
          spaceId: famille.id,
          date: day(2),
          mealTime: "LUNCH",
          kind: "RECIPE",
          recipeId: gratin.id,
          text: "Gratin",
        },
        {
          spaceId: famille.id,
          date: day(-3),
          mealTime: "DINNER",
          kind: "TEXT",
          text: "Gratin froid",
        },
        {
          spaceId: famille.id,
          date: day(60),
          mealTime: "LUNCH",
          kind: "RECIPE",
          recipeId: gratin.id,
          text: "Gratin",
        },
      ],
    });

    const meals = group((await client.get("/search?q=gratin")).body, "meal-plan.meals");
    expect(meals.map((m) => m.title)).toEqual(["Gratin", "Gratin froid"]);
    expect(meals[0]).toMatchObject({
      spaceId: famille.id,
      data: { date: day(2).toISOString().slice(0, 10), mealTime: "LUNCH" },
    });
  });

  it("omet les groupes vides", async () => {
    const lea = await createUser();
    const client = await loginAs(lea, app);
    const res = await client.get("/search?q=introuvable");
    expect(res.body).toEqual({ groups: [] });
  });
});

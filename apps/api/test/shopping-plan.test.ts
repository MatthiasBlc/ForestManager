// Liste de courses (C9) : depuis le planning, apercu des ingredients additionnes
// (portions du repas, sous-recettes depliees, repas sans recette, deja ajoutes),
// puis ajout des lignes cochees, fusion par produit et par section [D228, D231].
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { grantModule } from "./helpers/factories.ts";
import { createRecipe, ingredient, unitId } from "./helpers/recipes.ts";
import { groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

beforeAll(async () => {
  await db.module.updateMany({
    where: { code: { in: ["shopping", "meal-plan"] } },
    data: { status: "AVAILABLE" },
  });
});

async function setup() {
  const f = await groupFixture();
  await grantModule(f.spaceId, "shopping");
  await grantModule(f.spaceId, "meal-plan");
  const member = await loginAs(f.member, app);
  const base = `/spaces/${f.spaceId}/shopping`;
  const { body } = await member.get(base);
  return { f, member, base, sections: body.sections as { id: string; aisleId: string }[] };
}

const meal = (spaceId: string, date: string, time: "LUNCH" | "DINNER") =>
  `/spaces/${spaceId}/meal-plan/meals/${date}/${time}`;

/** Recette pour 4 : 4 oignons (piece), 200 g de creme, sel a gout, persil facultatif. */
async function curry(client: Client, spaceId: string) {
  const piece = await unitId("piece");
  const g = await unitId("g");
  const ids = {
    onion: await ingredient(client, "Oignon"),
    cream: await ingredient(client, "Crème"),
    salt: await ingredient(client, "Sel"),
    parsley: await ingredient(client, "Persil"),
  };
  const recipe = await createRecipe(client, spaceId, {
    title: "Curry",
    yieldQuantity: 4,
    blocks: [
      {
        kind: "LOCAL",
        ingredients: [
          { ingredientId: ids.onion, quantity: 4, unitId: piece },
          { ingredientId: ids.cream, quantity: 200, unitId: g },
          { ingredientId: ids.salt, quantity: null, unitId: await unitId("to-taste") },
          { ingredientId: ids.parsley, quantity: 10, unitId: g, optional: true },
        ],
        steps: ["Cuire."],
      },
    ],
  });
  return { recipe, ids, piece, g };
}

type PreviewLine = {
  ingredient: { id: string; name: string };
  sectionId: string | null;
  parts: { quantity: number; unitId: string | null }[];
  optional: boolean;
  toCheck: boolean;
  inList: { quantity: number; unitId: string | null }[] | null;
  sources: { recipeTitle: string; date: string; parts: unknown[] }[];
};

const lineOf = (lines: PreviewLine[], id: string) => lines.find((l) => l.ingredient.id === id);

describe("apercu depuis le planning (D228)", () => {
  it("additionne les repas de la periode aux portions de chaque repas", async () => {
    const { f, member, base } = await setup();
    const { recipe, ids, piece, g } = await curry(member, f.spaceId);
    await member.put(meal(f.spaceId, "2026-11-24", "DINNER"), {
      kind: "RECIPE",
      recipeId: recipe.id,
      servings: 2,
    });
    await member.put(meal(f.spaceId, "2026-11-26", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    await member.put(meal(f.spaceId, "2026-11-27", "LUNCH"), { kind: "TEXT", text: "Restes" });
    await member.put(meal(f.spaceId, "2026-11-28", "LUNCH"), { kind: "SKIPPED" });
    // Hors periode.
    await member.put(meal(f.spaceId, "2026-12-05", "LUNCH"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });

    const res = await member.post(`${base}/from-plan/preview`, {
      from: "2026-11-24",
      to: "2026-11-30",
    });
    expect(res.status).toBe(200);
    const lines = res.body.lines as PreviewLine[];
    // 2 portions puis 4 (portions par defaut) : 2 + 4 oignons, 100 + 200 g de creme.
    expect(lineOf(lines, ids.onion)).toMatchObject({
      ingredient: { name: "oignon" },
      parts: [{ quantity: 6, unitId: piece }],
      optional: false,
      toCheck: false,
      inList: null,
    });
    expect(lineOf(lines, ids.onion)?.sources.map((s) => [s.date, s.recipeTitle])).toEqual([
      ["2026-11-24", "Curry"],
      ["2026-11-26", "Curry"],
    ]);
    expect(lineOf(lines, ids.cream)?.parts).toEqual([{ quantity: 300, unitId: g }]);
    expect(lineOf(lines, ids.salt)?.parts).toEqual([]);
    expect(lineOf(lines, ids.parsley)?.optional).toBe(true);
    expect(res.body.skippedMeals).toEqual([
      { date: "2026-11-27", mealTime: "LUNCH", title: "Restes" },
    ]);
    expect(res.body.addedMeals).toEqual([]);
    expect(res.body.missingSubRecipes).toEqual([]);
  });

  it("deplie une sous-recette a l'echelle de la quantite utilisee ; signale une sous-recette invisible", async () => {
    const { f, member, base } = await setup();
    const ml = await unitId("ml");
    const g = await unitId("g");
    const soy = await ingredient(member, "Sauce soja");
    const sauce = await createRecipe(member, f.spaceId, {
      title: "Sauce teriyaki",
      isBase: true,
      yieldQuantity: 300,
      yieldUnitId: ml,
      blocks: [
        {
          kind: "LOCAL",
          ingredients: [{ ingredientId: soy, quantity: 100, unitId: ml }],
          steps: ["Melanger."],
        },
      ],
    });
    // Recette d'un autre espace, non partagee ici : invisible.
    const elsewhere = await loginAs(f.outsider, app);
    const hidden = await createRecipe(elsewhere, f.outsider.personalSpaceId, {
      title: "Fond secret",
      isBase: true,
    });
    const salmon = await ingredient(member, "Saumon");
    const dish = await createRecipe(member, f.spaceId, {
      title: "Saumon teriyaki",
      yieldQuantity: 2,
      blocks: [
        { kind: "RECIPE", recipeId: sauce.id, quantity: 150, unitId: ml },
        {
          kind: "LOCAL",
          ingredients: [{ ingredientId: salmon, quantity: 300, unitId: g }],
          steps: ["Cuire."],
        },
      ],
    });
    await db.recipeBlock.create({
      data: {
        recipeId: dish.id,
        position: 9,
        kind: "RECIPE",
        subRecipeId: hidden.id,
        subQuantity: 1,
      },
    });
    await member.put(meal(f.spaceId, "2026-11-24", "DINNER"), {
      kind: "RECIPE",
      recipeId: dish.id,
      servings: 4,
    });

    const res = await member.post(`${base}/from-plan/preview`, {
      from: "2026-11-24",
      to: "2026-11-24",
    });
    const lines = res.body.lines as PreviewLine[];
    // 4 portions d'un plat pour 2 : x2 ; la moitie de la sauce (150 / 300 ml) : 2 x 50 ml,
    // affiches dans l'unite la plus lisible.
    expect(lineOf(lines, salmon)?.parts).toEqual([{ quantity: 600, unitId: g }]);
    expect(lineOf(lines, soy)?.parts).toEqual([{ quantity: 10, unitId: await unitId("cl") }]);
    expect(res.body.missingSubRecipes).toEqual([
      { title: "Fond secret", inRecipe: "Saumon teriyaki" },
    ]);
  });

  it("rendement hors portions : quantites telles quelles, a verifier", async () => {
    const { f, member, base } = await setup();
    const g = await unitId("g");
    const flour = await ingredient(member, "Farine");
    const cake = await createRecipe(member, f.spaceId, {
      title: "Cake",
      yieldQuantity: 1,
      yieldUnitId: await unitId("piece"),
      blocks: [
        {
          kind: "LOCAL",
          ingredients: [{ ingredientId: flour, quantity: 250, unitId: g }],
          steps: ["Cuire."],
        },
      ],
    });
    await member.put(meal(f.spaceId, "2026-11-24", "DINNER"), {
      kind: "RECIPE",
      recipeId: cake.id,
      servings: 8,
    });
    const res = await member.post(`${base}/from-plan/preview`, {
      from: "2026-11-24",
      to: "2026-11-24",
    });
    expect(lineOf(res.body.lines as PreviewLine[], flour)).toMatchObject({
      parts: [{ quantity: 250, unitId: g }],
      toCheck: true,
    });
  });

  it("le planning doit etre actif dans l'espace", async () => {
    const f = await groupFixture();
    await grantModule(f.spaceId, "shopping");
    const member = await loginAs(f.member, app);
    const res = await member.post(`/spaces/${f.spaceId}/shopping/from-plan/preview`, {
      from: "2026-11-24",
      to: "2026-11-30",
    });
    expect(res.body.error.code).toBe("MODULE_001");
  });
});

describe("ajout depuis le planning (D228, D231)", () => {
  it("ajoute les lignes cochees, fusionne avec la liste, signale les repas deja ajoutes", async () => {
    const { f, member, base, sections } = await setup();
    const { recipe, ids, piece } = await curry(member, f.spaceId);
    const produce = sections[0];
    if (!produce) throw new Error("sections expected");
    await db.ingredient.update({ where: { id: ids.onion }, data: { aisleId: produce.aisleId } });
    await member.put(meal(f.spaceId, "2026-11-24", "DINNER"), {
      kind: "RECIPE",
      recipeId: recipe.id,
    });
    const existing = await member.post(`${base}/items`, {
      ingredientId: ids.onion,
      parts: [{ quantity: 1, unitId: piece }],
    });
    const period = { from: "2026-11-24", to: "2026-11-30" };

    const preview = await member.post(`${base}/from-plan/preview`, period);
    expect(lineOf(preview.body.lines as PreviewLine[], ids.onion)).toMatchObject({
      sectionId: produce.id,
      inList: [{ quantity: 1, unitId: piece }],
    });

    const res = await member.post(`${base}/from-plan`, {
      ...period,
      ingredientIds: [ids.onion, ids.salt],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ added: 1, updated: 1 });

    const { body } = await member.get(base);
    const onion = body.items.find((i: { id: string }) => i.id === existing.body.id);
    expect(onion.parts).toEqual([{ quantity: 5, unitId: piece }]);
    expect(onion.sources).toEqual([
      {
        mealSlotId: expect.any(String),
        recipeId: recipe.id,
        recipeTitle: "Curry",
        date: "2026-11-24",
        mealTime: "DINNER",
        parts: [{ quantity: 4, unitId: piece }],
      },
    ]);
    expect(
      body.items.some((i: { ingredient: { id: string } | null }) => i.ingredient?.id === ids.cream)
    ).toBe(false);

    const again = await member.post(`${base}/from-plan/preview`, period);
    expect(again.body.addedMeals).toEqual([
      { date: "2026-11-24", mealTime: "DINNER", title: "Curry" },
    ]);

    const activity = await db.activityEvent.findMany({
      where: { spaceId: f.spaceId, type: "shopping.list.generated" },
    });
    expect(activity).toHaveLength(1);
  });

  it("refuse une periode de plus de 31 jours et une liste vide", async () => {
    const { member, base } = await setup();
    expect(
      (
        await member.post(`${base}/from-plan`, {
          from: "2026-11-01",
          to: "2026-12-15",
          ingredientIds: ["00000000-0000-4000-8000-000000000000"],
        })
      ).body.error.code
    ).toBe("VALIDATION_001");
    expect(
      (
        await member.post(`${base}/from-plan`, {
          from: "2026-11-24",
          to: "2026-11-30",
          ingredientIds: [],
        })
      ).body.error.code
    ).toBe("VALIDATION_001");
  });
});

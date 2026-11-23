// Depuis le planning [D228, D231] : apercu des ingredients des repas de la periode
// (portions du repas, sous-recettes depliees), puis ajout des lignes cochees,
// recalculees cote serveur et fusionnees par produit et par section.
import {
  aggregatePlanLines,
  productKey,
  resolveSectionId,
  scaleQuantity,
  type ApplyPlanBody,
  type PlanIngredientLine,
  type PlanPreview,
  type PlanLine,
} from "@fm/shared";

import { recordActivity } from "../../core/activity/service.ts";
import type { Context } from "../../core/context.ts";
import { AppError } from "../../core/http/errors.ts";
import { optionalService, requiredService } from "../services.ts";
import { addItems, loadUnits, loadWeights, quantified } from "./items.ts";

const LOCALE = "fr"; // francais seul en V2 [D34]

interface Computed {
  preview: PlanPreview;
  lines: PlanLine[];
}

async function compute(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  from: string,
  to: string
): Promise<Computed> {
  const meals = await optionalService(ctx, "meal-plan.period")?.meals(spaceId, from, to);
  if (!meals) throw new AppError("MODULE_001");

  const recipeIds = meals.flatMap((m) => (m.kind === "RECIPE" && m.recipeId ? [m.recipeId] : []));
  const recipes = await requiredService(ctx, "recipes.ingredients").forShopping(
    spaceId,
    viewerId,
    recipeIds
  );

  const raw: PlanIngredientLine[] = [];
  const toCheck = new Set<string>();
  const skippedMeals: PlanPreview["skippedMeals"] = [];
  const missingSubRecipes: PlanPreview["missingSubRecipes"] = [];
  for (const meal of meals) {
    // "Pas de repas" : rien a acheter, rien a signaler.
    if (meal.kind === "SKIPPED") continue;
    const recipe = meal.recipeId ? recipes.get(meal.recipeId) : undefined;
    if (meal.kind !== "RECIPE" || !recipe) {
      skippedMeals.push({ date: meal.date, mealTime: meal.mealTime, title: meal.text ?? "" });
      continue;
    }
    for (const title of recipe.missing) missingSubRecipes.push({ title, inRecipe: recipe.title });
    const source = {
      mealSlotId: meal.id,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      date: meal.date,
      mealTime: meal.mealTime,
    };
    for (const line of recipe.lines) {
      if (!recipe.inPortions) toCheck.add(line.ingredientId);
      raw.push({
        ingredientId: line.ingredientId,
        quantity: recipe.inPortions
          ? scaleQuantity(line.quantity, recipe.yieldQuantity, meal.servings)
          : line.quantity,
        unitId: line.unitId,
        optional: line.optional,
        source,
      });
    }
  }

  const ingredientIds = [...new Set(raw.map((line) => line.ingredientId))];
  const [units, weights, ingredients, favorites, sections, items] = await Promise.all([
    loadUnits(ctx.db),
    loadWeights(ctx.db, ingredientIds),
    ctx.db.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: {
        id: true,
        aisleId: true,
        translations: { where: { locale: LOCALE }, select: { name: true, namePlural: true } },
      },
    }),
    ctx.db.shoppingPlacement.findMany({ where: { spaceId } }),
    ctx.db.shoppingSection.findMany({ where: { spaceId }, select: { id: true, aisleId: true } }),
    ctx.db.shoppingItem.findMany({
      where: { spaceId },
      select: {
        productKey: true,
        sectionId: true,
        checkedAt: true,
        parts: { orderBy: { position: "asc" }, select: { quantity: true, unitId: true } },
        sources: { select: { mealSlotId: true, recipeId: true } },
      },
    }),
  ]);
  const lines = aggregatePlanLines(raw, units, weights);
  const ingredientOf = new Map(ingredients.map((row) => [row.id, row]));
  const favoriteOf = new Map(favorites.map((row) => [row.productKey, row.sectionId]));

  const added = new Set(
    items.flatMap((item) => item.sources.map((s) => `${s.mealSlotId ?? ""}|${s.recipeId ?? ""}`))
  );
  const addedMeals = meals.flatMap((meal) => {
    const recipe = meal.recipeId ? recipes.get(meal.recipeId) : undefined;
    if (meal.kind !== "RECIPE" || !recipe || !added.has(`${meal.id}|${recipe.id}`)) return [];
    return [{ date: meal.date, mealTime: meal.mealTime, title: recipe.title }];
  });

  const previewLines = lines.map((line) => {
    const row = ingredientOf.get(line.ingredientId);
    const key = productKey({ ingredientId: line.ingredientId, label: null });
    const sectionId = resolveSectionId(
      { key, aisleId: row?.aisleId ?? null },
      favoriteOf,
      sections
    );
    const open = items.find(
      (item) => item.productKey === key && item.sectionId === sectionId && item.checkedAt === null
    );
    const name = row?.translations[0];
    return {
      ingredient: {
        id: line.ingredientId,
        name: name?.name ?? "",
        namePlural: name?.namePlural ?? null,
      },
      sectionId,
      parts: quantified(line.parts),
      optional: line.optional,
      toCheck: toCheck.has(line.ingredientId),
      inList: open ? open.parts : null,
      sources: line.sources.map(({ source, parts }) => ({ ...source, parts: quantified(parts) })),
    };
  });

  return {
    preview: { lines: previewLines, addedMeals, skippedMeals, missingSubRecipes },
    lines,
  };
}

export async function previewFromPlan(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  from: string,
  to: string
): Promise<PlanPreview> {
  return (await compute(ctx, spaceId, viewerId, from, to)).preview;
}

export async function applyFromPlan(
  ctx: Context,
  spaceId: string,
  userId: string,
  body: ApplyPlanBody
): Promise<{ added: number; updated: number }> {
  const { lines } = await compute(ctx, spaceId, userId, body.from, body.to);
  const chosen = new Set(body.ingredientIds);
  const inputs = lines
    .filter((line) => chosen.has(line.ingredientId))
    .map((line) => ({
      ingredientId: line.ingredientId,
      label: null,
      parts: line.parts,
      sources: line.sources.map(({ source, parts }) => ({ ...source, parts })),
    }));
  const result = await ctx.db.$transaction((tx) => addItems(tx, spaceId, userId, inputs));
  const count = result.created.length + result.updated.length;
  if (count > 0) {
    // Une ligne d'activite par ajout depuis le planning, pas par coche [D228].
    await recordActivity(ctx, {
      spaceId,
      type: "shopping.list.generated",
      moduleCode: "shopping",
      actorId: userId,
      data: { from: body.from, to: body.to, count },
    });
  }
  return { added: result.created.length, updated: result.updated.length };
}

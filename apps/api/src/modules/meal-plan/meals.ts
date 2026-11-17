// Calendrier continu [D180] : une ligne par repas rempli ou marque, une case vide
// n'a pas de ligne. Repas recette / texte / "Pas de repas" [D181], verrou qui suit
// le repas a l'echange, dernier titre connu d'une recette devenue invisible [D184].
import type { Meal, MealCell, PutMealBody, SwapMealsBody } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { isModuleActive } from "../../core/modules/guards.ts";
import { requiredService, type MealPlanStats } from "../services.ts";
import { readSettings } from "./settings.ts";

/** Date de calendrier stockee a minuit UTC (`@db.Date`). */
export function toDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIso(now = new Date()): string {
  return toIsoDate(now);
}

export const mealSelect = {
  date: true,
  mealTime: true,
  kind: true,
  recipeId: true,
  text: true,
  comment: true,
  servings: true,
  locked: true,
  updatedAt: true,
  updatedBy: { select: { id: true, username: true } },
} as const;

export type MealRow = Prisma.MealSlotGetPayload<{ select: typeof mealSelect }>;

/** Contenu deplace par un echange : tout sauf la case. */
type MealContent = Pick<
  Prisma.MealSlotUncheckedCreateInput,
  "kind" | "recipeId" | "text" | "comment" | "servings" | "locked"
>;

export const cellWhere = (spaceId: string, cell: MealCell) => ({
  spaceId_date_mealTime: { spaceId, date: toDbDate(cell.date), mealTime: cell.mealTime },
});

export async function present(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  rows: readonly MealRow[]
): Promise<Meal[]> {
  const ids = rows.flatMap((row) => (row.kind === "RECIPE" && row.recipeId ? [row.recipeId] : []));
  const visible = await requiredService(ctx, "recipes.catalog").visible(spaceId, viewerId, ids);
  return rows.map((row) => {
    const recipe = row.kind === "RECIPE" && row.recipeId ? visible.get(row.recipeId) : undefined;
    return {
      date: toIsoDate(row.date),
      mealTime: row.mealTime,
      kind: row.kind,
      title: row.kind === "SKIPPED" ? null : (recipe?.title ?? row.text),
      recipe: recipe ? { id: recipe.id, imageUrl: recipe.imageUrl } : null,
      comment: row.comment,
      servings: row.servings,
      locked: row.locked,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function assertPlanned(ctx: Context, spaceId: string, cells: readonly MealCell[]) {
  const { mealTimes } = await readSettings(ctx.db, spaceId);
  if (cells.some((cell) => !mealTimes.includes(cell.mealTime))) throw new AppError("MEAL_001");
}

/** Repas de la periode, limites aux repas que l'espace planifie, dans l'ordre du calendrier. */
export async function listMeals(
  ctx: Context,
  spaceId: string,
  viewerId: string,
  from: string,
  to: string
): Promise<Meal[]> {
  const { mealTimes } = await readSettings(ctx.db, spaceId);
  const rows = await ctx.db.mealSlot.findMany({
    where: {
      spaceId,
      date: { gte: toDbDate(from), lte: toDbDate(to) },
      mealTime: { in: mealTimes },
    },
    select: mealSelect,
    orderBy: [{ date: "asc" }, { mealTime: "asc" }],
  });
  return present(ctx, spaceId, viewerId, rows);
}

const blank = (comment: string | null | undefined) => (comment ? comment : null);

export async function putMeal(
  ctx: Context,
  spaceId: string,
  userId: string,
  cell: MealCell,
  body: PutMealBody
): Promise<Meal> {
  await assertPlanned(ctx, spaceId, [cell]);
  let content: MealContent;
  if (body.kind === "RECIPE") {
    const found = await requiredService(ctx, "recipes.catalog").visible(spaceId, userId, [
      body.recipeId,
    ]);
    const recipe = found.get(body.recipeId);
    if (!recipe) throw new AppError("RECIPE_001");
    content = {
      kind: "RECIPE",
      recipeId: recipe.id,
      text: recipe.title,
      comment: blank(body.comment),
      servings: body.servings ?? null,
      locked: body.locked ?? false,
    };
  } else if (body.kind === "TEXT") {
    content = {
      kind: "TEXT",
      recipeId: null,
      text: body.text,
      comment: blank(body.comment),
      servings: body.servings ?? null,
      locked: body.locked ?? false,
    };
  } else {
    content = {
      kind: "SKIPPED",
      recipeId: null,
      text: null,
      comment: null,
      servings: null,
      locked: false,
    };
  }
  const row = await ctx.db.mealSlot.upsert({
    where: cellWhere(spaceId, cell),
    create: {
      spaceId,
      date: toDbDate(cell.date),
      mealTime: cell.mealTime,
      ...content,
      updatedById: userId,
    },
    update: { ...content, updatedById: userId },
    select: mealSelect,
  });
  const [meal] = await present(ctx, spaceId, userId, [row]);
  if (!meal) throw new Error("meal not presented");
  return meal;
}

export async function clearMeal(ctx: Context, spaceId: string, cell: MealCell): Promise<void> {
  await ctx.db.mealSlot.deleteMany({
    where: { spaceId, date: toDbDate(cell.date), mealTime: cell.mealTime },
  });
}

/** Echange tout le contenu de deux cases, verrou compris ; une case vide = deplacer [D184]. */
export async function swapMeals(
  ctx: Context,
  spaceId: string,
  userId: string,
  { a, b }: SwapMealsBody
): Promise<Meal[]> {
  await assertPlanned(ctx, spaceId, [a, b]);
  const rows = await ctx.db.$transaction(async (tx) => {
    const [rowA, rowB] = await Promise.all(
      [a, b].map((cell) => tx.mealSlot.findUnique({ where: cellWhere(spaceId, cell) }))
    );
    await tx.mealSlot.deleteMany({
      where: { spaceId, OR: [a, b].map((c) => ({ date: toDbDate(c.date), mealTime: c.mealTime })) },
    });
    const moves: [MealCell, typeof rowA][] = [
      [b, rowA ?? null],
      [a, rowB ?? null],
    ];
    const created: MealRow[] = [];
    for (const [cell, source] of moves) {
      if (!source) continue;
      created.push(
        await tx.mealSlot.create({
          data: {
            spaceId,
            date: toDbDate(cell.date),
            mealTime: cell.mealTime,
            kind: source.kind,
            recipeId: source.recipeId,
            text: source.text,
            comment: source.comment,
            servings: source.servings,
            locked: source.locked,
            updatedById: userId,
          },
          select: mealSelect,
        })
      );
    }
    return created;
  });
  return present(ctx, spaceId, userId, rows);
}

/** Service `meal-plan.recipeStats` : compteurs D39 d'une recette dans un espace. */
export function recipeStats(ctx: Context): MealPlanStats {
  return {
    async forRecipe(spaceId, recipeId) {
      if (!(await isModuleActive(ctx.db, spaceId, "meal-plan"))) return null;
      const where = { spaceId, recipeId, kind: "RECIPE" as const };
      const [count, last] = await Promise.all([
        ctx.db.mealSlot.count({ where }),
        ctx.db.mealSlot.findFirst({
          where: { ...where, date: { lte: toDbDate(todayIso()) } },
          orderBy: { date: "desc" },
          select: { date: true },
        }),
      ]);
      return { count, lastOn: last ? toIsoDate(last.date) : null };
    },
  };
}

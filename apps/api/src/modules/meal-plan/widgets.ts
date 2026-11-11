// Widgets d'accueil du Planning [D193] : prochains repas par espace, et recettes
// les plus cuisinees (repas passes planifies, D39).
import type { ApiWidget } from "../../core/home/types.ts";
import { requiredService } from "../services.ts";
import { toDbDate, toIsoDate, todayIso } from "./meals.ts";

const UPCOMING_DAYS = 7;
const UPCOMING_PER_SPACE = 3;
const MOST_COOKED = 3;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export const MEAL_PLAN_WIDGETS: Readonly<Record<string, ApiWidget>> = {
  "meal-plan.upcoming": {
    default: true,
    order: 10,
    async load(ctx, input) {
      const today = toDbDate(todayIso());
      const spaces = await Promise.all(
        input.spaces.map(async (space) => {
          const rows = await ctx.db.mealSlot.findMany({
            where: {
              spaceId: space.id,
              kind: { not: "SKIPPED" },
              date: { gte: today, lte: addDays(today, UPCOMING_DAYS) },
            },
            orderBy: [{ date: "asc" }, { mealTime: "asc" }],
            take: UPCOMING_PER_SPACE,
            select: {
              date: true,
              mealTime: true,
              text: true,
              recipeId: true,
              recipe: { select: { title: true, deletedAt: true, hiddenAt: true } },
            },
          });
          return {
            spaceId: space.id,
            spaceName: space.name,
            meals: rows.map((row) => {
              // Recette encore visible : son titre ; sinon le dernier titre connu [D184].
              const live = row.recipe && !row.recipe.deletedAt && !row.recipe.hiddenAt;
              return {
                date: toIsoDate(row.date),
                mealTime: row.mealTime,
                title: (live ? row.recipe?.title : null) ?? row.text ?? "",
                recipeId: live ? row.recipeId : null,
              };
            }),
          };
        })
      );
      return { spaces };
    },
  },
  "meal-plan.most-cooked": {
    default: true,
    order: 20,
    async load(ctx, input) {
      const rows = await ctx.db.mealSlot.groupBy({
        by: ["recipeId", "spaceId"],
        where: {
          spaceId: { in: input.spaces.map((space) => space.id) },
          kind: "RECIPE",
          recipeId: { not: null },
          date: { lte: toDbDate(todayIso()) },
        },
        _count: { _all: true },
      });
      // Total par recette, ouverte dans l'espace ou elle a ete le plus planifiee.
      const totals = new Map<string, { count: number; spaceId: string; best: number }>();
      for (const row of rows) {
        if (!row.recipeId) continue;
        const current = totals.get(row.recipeId);
        const n = row._count._all;
        if (!current) totals.set(row.recipeId, { count: n, spaceId: row.spaceId, best: n });
        else {
          current.count += n;
          if (n > current.best) Object.assign(current, { spaceId: row.spaceId, best: n });
        }
      }
      const ranked = [...totals.entries()].sort((a, b) => b[1].count - a[1].count);
      const catalog = requiredService(ctx, "recipes.catalog");
      const names = new Map(input.spaces.map((space) => [space.id, space.name]));
      const recipes = [];
      for (const [id, total] of ranked) {
        if (recipes.length >= MOST_COOKED) break;
        const visible = (await catalog.visible(total.spaceId, input.userId, [id])).get(id);
        if (!visible) continue;
        recipes.push({
          id,
          title: visible.title,
          count: total.count,
          spaceId: total.spaceId,
          spaceName: names.get(total.spaceId) ?? "",
        });
      }
      return { recipes };
    },
  },
};

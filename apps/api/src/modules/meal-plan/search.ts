// Recherche globale, groupe du Planning (P16) [D119, D191] : repas de 2 semaines
// en arriere a 4 semaines en avant, les plus proches d'aujourd'hui d'abord.
import type { SearchGroup } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import type { SearchInput } from "../../core/search/types.ts";

const PAST_DAYS = 14;
const FUTURE_DAYS = 28;

interface MealRow {
  id: string;
  title: string;
  date: Date;
  mealTime: string;
  spaceId: string;
  spaceName: string;
}

function utcDay(offset: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

export async function searchMeals(ctx: Context, input: SearchInput): Promise<SearchGroup[]> {
  const ids = Prisma.join(input.spaces.map((space) => space.id));
  const today = utcDay(0);
  // Recette encore visible : son titre ; sinon le dernier titre connu ou le texte [D184].
  const rows = await ctx.db.$queryRaw<MealRow[]>`
    SELECT id, title, date, "mealTime", "spaceId", "spaceName" FROM (
      SELECT m.id, m.date, m."mealTime"::text AS "mealTime", s.id AS "spaceId", s.name AS "spaceName",
        CASE WHEN r.id IS NOT NULL AND r."deletedAt" IS NULL AND r."hiddenAt" IS NULL
          THEN r.title ELSE m.text END AS title
      FROM "MealSlot" m
      JOIN "Space" s ON s.id = m."spaceId"
      LEFT JOIN "Recipe" r ON r.id = m."recipeId"
      WHERE m."spaceId" IN (${ids}) AND m.kind <> 'SKIPPED'
        AND m.date BETWEEN ${utcDay(-PAST_DAYS)} AND ${utcDay(FUTURE_DAYS)}
    ) found
    WHERE title IS NOT NULL AND lower(unaccent(title)) LIKE ${input.like}
    ORDER BY abs(date - ${today}::date), date DESC, "mealTime" DESC
    LIMIT ${input.limit}`;
  return [
    {
      key: "meal-plan.meals",
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        spaceId: row.spaceId,
        spaceName: row.spaceName,
        data: { date: row.date.toISOString().slice(0, 10), mealTime: row.mealTime },
      })),
    },
  ];
}

// Articles de la liste [D228, D231] : lecture et presentation.
import type { MealTime, ShoppingItem } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { toUserSummary } from "../../core/storage/images.ts";

const LOCALE = "fr"; // francais seul en V2 [D34]

export const itemInclude = {
  ingredient: {
    select: {
      id: true,
      translations: { where: { locale: LOCALE }, select: { name: true, namePlural: true } },
    },
  },
  parts: { orderBy: { position: "asc" }, select: { quantity: true, unitId: true } },
  sources: {
    orderBy: [{ date: "asc" }, { mealTime: "asc" }, { id: "asc" }],
    select: {
      mealSlotId: true,
      recipeId: true,
      recipeTitle: true,
      date: true,
      mealTime: true,
      parts: true,
    },
  },
  checkedBy: { select: { id: true, username: true, avatarKey: true } },
} as const satisfies Prisma.ShoppingItemInclude;

export type ItemRow = Prisma.ShoppingItemGetPayload<{ include: typeof itemInclude }>;

/** Parts gardees en JSON dans une source : `[{ quantity, unitId }]`. */
export function partsOf(json: Prisma.JsonValue): { quantity: number; unitId: string | null }[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((part) => {
    if (part === null || typeof part !== "object" || Array.isArray(part)) return [];
    const { quantity, unitId } = part;
    if (typeof quantity !== "number") return [];
    return [{ quantity, unitId: typeof unitId === "string" ? unitId : null }];
  });
}

export function toItem(ctx: Context, row: ItemRow): ShoppingItem {
  const name = row.ingredient?.translations[0];
  return {
    id: row.id,
    sectionId: row.sectionId,
    ingredient: row.ingredient
      ? { id: row.ingredient.id, name: name?.name ?? "", namePlural: name?.namePlural ?? null }
      : null,
    label: row.label,
    parts: row.parts,
    sortOrder: row.sortOrder,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    checkedBy: row.checkedBy ? toUserSummary(ctx, row.checkedBy) : null,
    sources: row.sources.map((source) => ({
      mealSlotId: source.mealSlotId,
      recipeId: source.recipeId,
      recipeTitle: source.recipeTitle,
      date: source.date.toISOString().slice(0, 10),
      mealTime: source.mealTime satisfies MealTime,
      parts: partsOf(source.parts),
    })),
  };
}

export async function listItems(ctx: Context, spaceId: string): Promise<ShoppingItem[]> {
  const rows = await ctx.db.shoppingItem.findMany({
    where: { spaceId },
    include: itemInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => toItem(ctx, row));
}

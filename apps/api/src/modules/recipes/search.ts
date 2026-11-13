// Recherche globale, groupes du module Recettes (P16) [D191] : recettes de tous
// les espaces de l'utilisateur, ingredients utilises dans l'espace courant.
import type { SearchGroup } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import type { SearchInput } from "../../core/search/types.ts";
import { visibleInSql } from "./list.ts";

const LOCALE = "fr"; // francais seul en V2.0 [D34]

const prefixOf = (text: string) => `${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

interface RecipeRow {
  id: string;
  title: string;
  isBase: boolean;
  adapted: boolean;
  spaceId: string;
  spaceName: string;
}

/** Une ligne par recette : dans l'espace courant s'il la voit, sinon l'origine, sinon le premier. */
async function recipes(ctx: Context, input: SearchInput): Promise<SearchGroup> {
  const ids = Prisma.join(input.spaces.map((space) => space.id));
  const rows = await ctx.db.$queryRaw<RecipeRow[]>`
    SELECT id, title, "isBase", adapted, "spaceId", "spaceName" FROM (
      SELECT DISTINCT ON (r.id) r.id, r.title, r."isBase",
        (r."adaptedFromId" IS NOT NULL) AS adapted,
        s.id AS "spaceId", s.name AS "spaceName",
        (lower(unaccent(r.title)) LIKE ${prefixOf(input.text)}) AS prefix
      FROM "Recipe" r
      JOIN "Space" s ON s.id IN (${ids}) AND (r."homeSpaceId" = s.id OR EXISTS (
        SELECT 1 FROM "RecipeShare" sh
        WHERE sh."recipeId" = r.id AND sh."spaceId" = s.id AND sh."removedAt" IS NULL))
      WHERE r."deletedAt" IS NULL
        AND (r."hiddenAt" IS NULL OR r."authorId" = ${input.userId})
        AND lower(unaccent(r.title)) LIKE ${input.like}
      ORDER BY r.id, (s.id = ${input.currentSpaceId}) DESC, (s.id = r."homeSpaceId") DESC, s.name
    ) found
    ORDER BY prefix DESC, lower(unaccent(title)), id
    LIMIT ${input.limit}`;
  return {
    key: "recipes.recipes",
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      spaceId: row.spaceId,
      spaceName: row.spaceName,
      data: { isBase: row.isBase, adapted: row.adapted },
    })),
  };
}

/** Ingredients des recettes visibles dans l'espace courant (ouvrent la liste filtree). */
async function ingredients(ctx: Context, input: SearchInput): Promise<SearchGroup> {
  const current = input.spaces.find((space) => space.id === input.currentSpaceId);
  if (!current) return { key: "recipes.ingredients", items: [] };
  const rows = await ctx.db.$queryRaw<{ id: string; name: string; count: number }[]>`
    SELECT t."ingredientId" AS id, t.name, COUNT(DISTINCT r.id)::int AS count
    FROM "Recipe" r
    JOIN "RecipeBlock" b ON b."recipeId" = r.id
    JOIN "RecipeIngredient" ri ON ri."blockId" = b.id
    JOIN "IngredientTranslation" t ON t."ingredientId" = ri."ingredientId" AND t.locale = ${LOCALE}
    WHERE ${visibleInSql(current.id)} AND r."deletedAt" IS NULL
      AND (r."hiddenAt" IS NULL OR r."authorId" = ${input.userId})
      AND (t.normalized LIKE ${prefixOf(input.text)}
        OR t.normalized LIKE ${`% ${prefixOf(input.text)}`})
    GROUP BY t."ingredientId", t.name, t.normalized
    ORDER BY (t.normalized LIKE ${prefixOf(input.text)}) DESC, count DESC, t.name
    LIMIT ${input.limit}`;
  return {
    key: "recipes.ingredients",
    items: rows.map((row) => ({
      id: row.id,
      title: row.name,
      spaceId: current.id,
      spaceName: current.name,
      data: { recipeCount: row.count },
    })),
  };
}

export async function searchRecipes(ctx: Context, input: SearchInput): Promise<SearchGroup[]> {
  return Promise.all([recipes(ctx, input), ingredients(ctx, input)]);
}

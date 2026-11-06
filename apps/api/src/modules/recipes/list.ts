// Liste des recettes d'un espace : recherche, filtres, tri et pagination par
// curseur [F-REC-11, D72]. Le curseur porte la cle de tri et l'id de la
// derniere recette renvoyee (pagination par cle, stable quand on ajoute).
import {
  normalizeName,
  type RecipeListQuery,
  type RecipeSort,
  type RecipeSummary,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { summaryInclude, toSummary } from "./content.ts";

/** Temps total ; une recette sans temps passe apres les autres au tri par temps. */
const TOTAL = Prisma.sql`(CASE WHEN num_nonnulls(r."prepMinutes", r."cookMinutes", r."restMinutes") = 0 THEN NULL
  ELSE COALESCE(r."prepMinutes", 0) + COALESCE(r."cookMinutes", 0) + COALESCE(r."restMinutes", 0) END)`;
const NO_TIME = 2_147_483_647;

interface SortSpec {
  key: Prisma.Sql;
  descending: boolean;
  /** Valeur de la cle telle que stockee dans le curseur. */
  parse: (value: unknown) => unknown;
  /** Valeur du curseur en parametre SQL. */
  bind: (value: unknown) => Prisma.Sql;
}

const bindValue = (value: unknown) => Prisma.sql`${value}`;

const SORTS: Record<RecipeSort, SortSpec> = {
  recent: {
    key: Prisma.sql`r."updatedAt"`,
    descending: true,
    parse: (value) => {
      const date = typeof value === "string" ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
    },
    // Dates stockees en UTC sans fuseau (timestamp(3)).
    bind: (value) => Prisma.sql`CAST(${String(value).replace("Z", "")} AS timestamp(3))`,
  },
  title: {
    key: Prisma.sql`(lower(unaccent(r.title)) COLLATE "C")`,
    descending: false,
    parse: (value) => (typeof value === "string" ? value : undefined),
    bind: bindValue,
  },
  time: {
    key: Prisma.sql`COALESCE(${TOTAL}, ${NO_TIME})`,
    descending: false,
    parse: (value) => (Number.isInteger(value) ? value : undefined),
    bind: bindValue,
  },
};

interface Cursor {
  key: unknown;
  id: string;
}

function encodeCursor(key: unknown, id: string): string {
  const value = key instanceof Date ? key.toISOString() : key;
  return Buffer.from(JSON.stringify([value, id])).toString("base64url");
}

function decodeCursor(raw: string, sort: SortSpec): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === "string") {
      const key = sort.parse(parsed[0]);
      if (key !== undefined) return { key, id: parsed[1] };
    }
  } catch {
    // curseur illisible : refuse ci-dessous
  }
  throw new AppError("VALIDATION_001", [
    { location: "query", path: "cursor", code: "custom", message: "Curseur invalide" },
  ]);
}

/** Recettes visibles dans un espace : origine ou partage actif [D03]. */
export function visibleInSql(spaceId: string): Prisma.Sql {
  return Prisma.sql`(r."homeSpaceId" = ${spaceId} OR EXISTS (SELECT 1 FROM "RecipeShare" sh
    WHERE sh."recipeId" = r.id AND sh."spaceId" = ${spaceId} AND sh."removedAt" IS NULL))`;
}

/** "Mes recettes" [D82] : recettes de l'auteur dans les espaces dont il est membre actif. */
export function authoredBySql(userId: string): Prisma.Sql {
  return Prisma.sql`(r."authorId" = ${userId} AND r."homeSpaceId" IN (SELECT m."spaceId"
    FROM "Membership" m JOIN "Space" s ON s.id = m."spaceId"
    WHERE m."userId" = ${userId} AND m."leftAt" IS NULL AND s."deletedAt" IS NULL))`;
}

function filters(scope: Prisma.Sql, spaceId: string, query: RecipeListQuery): Prisma.Sql[] {
  const where = [scope, Prisma.sql`r."deletedAt" IS NULL`];
  const text = query.q ? normalizeName(query.q) : "";
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(Prisma.sql`lower(unaccent(r.title)) LIKE ${like}`);
  }
  for (const tagId of query.tagIds ?? []) {
    where.push(Prisma.sql`(
      EXISTS (SELECT 1 FROM "RecipeGlobalTag" g WHERE g."recipeId" = r.id AND g."tagId" = ${tagId})
      OR EXISTS (SELECT 1 FROM "RecipeSpaceTag" s
        WHERE s."recipeId" = r.id AND s."spaceId" = ${spaceId} AND s."tagId" = ${tagId}))`);
  }
  for (const ingredientId of query.ingredientIds ?? []) {
    where.push(Prisma.sql`EXISTS (SELECT 1 FROM "RecipeIngredient" ri
      JOIN "RecipeBlock" b ON b.id = ri."blockId"
      WHERE b."recipeId" = r.id AND ri."ingredientId" = ${ingredientId})`);
  }
  if (query.maxMinutes !== undefined) where.push(Prisma.sql`${TOTAL} <= ${query.maxMinutes}`);
  if (query.authorId) where.push(Prisma.sql`r."authorId" = ${query.authorId}`);
  if (query.base !== undefined) where.push(Prisma.sql`r."isBase" = ${query.base}`);
  return where;
}

/**
 * `scope` : recettes candidates (par defaut celles visibles dans l'espace) ;
 * les tags d'espace lus et filtres sont ceux de `spaceId` [D19].
 */
export async function listRecipes(
  ctx: Context,
  spaceId: string,
  query: RecipeListQuery,
  scope: Prisma.Sql = visibleInSql(spaceId)
): Promise<{ data: RecipeSummary[]; nextCursor: string | null }> {
  const sort = SORTS[query.sort];
  const where = filters(scope, spaceId, query);
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor, sort);
    where.push(
      sort.descending
        ? Prisma.sql`(${sort.key}, r.id) < (${sort.bind(cursor.key)}, ${cursor.id})`
        : Prisma.sql`(${sort.key}, r.id) > (${sort.bind(cursor.key)}, ${cursor.id})`
    );
  }
  const direction = sort.descending ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const rows = await ctx.db.$queryRaw<{ id: string; sort_key: unknown }[]>`
    SELECT r.id, ${sort.key} AS sort_key
    FROM "Recipe" r
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY sort_key ${direction}, r.id ${direction}
    LIMIT ${query.limit + 1}`;

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > query.limit && last ? encodeCursor(last.sort_key, last.id) : null;

  const recipes = await ctx.db.recipe.findMany({
    where: { id: { in: page.map((row) => row.id) } },
    include: summaryInclude(spaceId),
  });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const data = page.flatMap((row) => {
    const recipe = byId.get(row.id);
    return recipe ? [toSummary(recipe)] : [];
  });
  return { data, nextCursor };
}

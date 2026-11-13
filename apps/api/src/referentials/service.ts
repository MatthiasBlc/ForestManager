// Referentiels vus par les membres [D09, D120, D160] : unites, ingredients
// (autocompletion et creation a la volee), tags globaux.
import { normalizeName, type Ingredient, type Tag, type Unit } from "@fm/shared";

import type { Context } from "../core/context.ts";

const LOCALE = "fr"; // francais seul en V2.0 [D34]

export async function listUnits(ctx: Context): Promise<Unit[]> {
  const rows = await ctx.db.unit.findMany({
    orderBy: { sortOrder: "asc" },
    include: { translations: { where: { locale: LOCALE } } },
  });
  return rows.map((row) => {
    const t = row.translations[0];
    return {
      id: row.id,
      code: row.code,
      dimension: row.dimension,
      toBase: row.toBase,
      metric: row.metric,
      name: t?.name ?? row.code,
      namePlural: t?.namePlural ?? null,
      abbreviation: t?.abbreviation ?? row.code,
    };
  });
}

export async function listGlobalTags(ctx: Context): Promise<Tag[]> {
  const rows = await ctx.db.tag.findMany({
    where: { scope: "GLOBAL", deletedAt: null, mergedIntoId: null },
    include: { translations: { where: { locale: LOCALE } } },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    name: row.translations[0]?.name ?? row.name,
  }));
}

interface IngredientRow {
  id: string;
  name: string;
  namePlural: string | null;
  defaultUnitId: string | null;
  matchedName: string | null;
}

/**
 * Autocompletion : prefixe du nom ou d'un de ses mots, puis ressemblance
 * (pg_trgm). Un ingredient fusionne renvoie sa cible, avec le synonyme saisi [D120].
 */
export async function searchIngredients(
  ctx: Context,
  query: string,
  limit: number
): Promise<Ingredient[]> {
  const q = normalizeName(query);
  const like = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await ctx.db.$queryRaw<IngredientRow[]>`
    SELECT id, name, "namePlural", "defaultUnitId", "matchedName" FROM (
      SELECT DISTINCT ON (target.id)
        target.id,
        tt.name,
        tt."namePlural",
        target."defaultUnitId",
        CASE WHEN i.id <> target.id THEN t.name END AS "matchedName",
        (t.normalized LIKE ${like} || '%') AS prefix,
        similarity(t.normalized, ${q}) AS score
      FROM "IngredientTranslation" t
      JOIN "Ingredient" i ON i.id = t."ingredientId"
      JOIN "Ingredient" target ON target.id = COALESCE(i."mergedIntoId", i.id)
      JOIN "IngredientTranslation" tt ON tt."ingredientId" = target.id AND tt.locale = ${LOCALE}
      WHERE t.locale = ${LOCALE}
        AND (t.normalized LIKE ${like} || '%' OR t.normalized LIKE '% ' || ${like} || '%' OR t.normalized % ${q})
      ORDER BY target.id, (t.normalized LIKE ${like} || '%') DESC, similarity(t.normalized, ${q}) DESC
    ) found
    ORDER BY prefix DESC, score DESC, name ASC
    LIMIT ${limit}`;
  return rows;
}

/** Ingredient existant (cible d'une fusion le cas echeant) ou nouveau [D09]. */
export async function findOrCreateIngredient(
  ctx: Context,
  name: string,
  userId: string
): Promise<{ ingredient: Ingredient; created: boolean }> {
  const display = name.trim().replace(/\s+/g, " ");
  const normalized = normalizeName(display);
  const existing = async () => {
    const translation = await ctx.db.ingredientTranslation.findUnique({
      where: { locale_normalized: { locale: LOCALE, normalized } },
      include: { ingredient: true },
    });
    if (!translation) return null;
    const targetId = translation.ingredient.mergedIntoId ?? translation.ingredient.id;
    const [found] = await searchById(ctx, targetId);
    return found ?? null;
  };
  const found = await existing();
  if (found) return { ingredient: found, created: false };
  try {
    const row = await ctx.db.ingredient.create({
      data: {
        createdById: userId,
        translations: { create: { locale: LOCALE, name: display, normalized } },
      },
    });
    return {
      ingredient: {
        id: row.id,
        name: display,
        namePlural: null,
        defaultUnitId: null,
        matchedName: null,
      },
      created: true,
    };
  } catch (error) {
    // Creation simultanee du meme nom : on renvoie celui qui a gagne.
    const winner = await existing();
    if (winner) return { ingredient: winner, created: false };
    throw error;
  }
}

async function searchById(ctx: Context, id: string): Promise<Ingredient[]> {
  const row = await ctx.db.ingredient.findUnique({
    where: { id },
    include: { translations: { where: { locale: LOCALE } } },
  });
  if (!row) return [];
  const t = row.translations[0];
  return [
    {
      id: row.id,
      name: t?.name ?? "",
      namePlural: t?.namePlural ?? null,
      defaultUnitId: row.defaultUnitId,
      matchedName: null,
    },
  ];
}

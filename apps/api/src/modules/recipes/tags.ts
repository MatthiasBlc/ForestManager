// Tags d'espace du module Recettes [D08, D19] : tout membre en cree (en taguant),
// les moderateurs renomment, fusionnent, suppriment, rangent en familles [D216].
// Catalogue d'un espace : familles et tags avec leur nombre de recettes.
import {
  normalizeName,
  type CatalogTag,
  type Tag,
  type TagCatalog,
  type TagFamily,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { visibleInSql } from "./list.ts";

const LOCALE = "fr"; // francais seul en V2.0 [D34]

type Db = Context["db"] | Prisma.TransactionClient;

const slugOf = (name: string) => normalizeName(name).replace(/ /g, "-");

function toTag(row: { id: string; scope: "GLOBAL" | "SPACE"; name: string }): Tag {
  return { id: row.id, scope: row.scope, name: row.name };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function listSpaceTags(ctx: Context, spaceId: string): Promise<Tag[]> {
  const rows = await ctx.db.tag.findMany({
    where: { spaceId, deletedAt: null, mergedIntoId: null },
    orderBy: { name: "asc" },
  });
  return rows.map(toTag);
}

/** Tag existant de meme slug (cible d'une fusion le cas echeant) ou nouveau. */
export async function findOrCreateSpaceTag(
  ctx: Context,
  spaceId: string,
  name: string,
  userId: string
): Promise<{ tag: Tag; created: boolean }> {
  return findOrCreateIn(ctx.db, spaceId, name, userId);
}

async function findOrCreateIn(
  db: Db,
  spaceId: string,
  name: string,
  userId: string
): Promise<{ tag: Tag; created: boolean }> {
  const slug = slugOf(name);
  const existing = await db.tag.findUnique({ where: { spaceId_slug: { spaceId, slug } } });
  if (existing && !existing.deletedAt) {
    const target = existing.mergedIntoId
      ? await db.tag.findUniqueOrThrow({ where: { id: existing.mergedIntoId } })
      : existing;
    return { tag: toTag(target), created: false };
  }
  if (existing) {
    // Tag supprime : il revient avec le nom saisi.
    const revived = await db.tag.update({
      where: { id: existing.id },
      data: { deletedAt: null, mergedIntoId: null, name: name.trim() },
    });
    return { tag: toTag(revived), created: true };
  }
  const row = await db.tag.create({
    data: { scope: "SPACE", spaceId, name: name.trim(), slug, createdById: userId },
  });
  return { tag: toTag(row), created: true };
}

async function activeTag(ctx: Context, spaceId: string, tagId: string) {
  const tag = await ctx.db.tag.findFirst({
    where: { id: tagId, spaceId, deletedAt: null, mergedIntoId: null },
  });
  if (!tag) throw new AppError("RECIPE_003");
  return tag;
}

/** Place en fin de famille pour un tag qui y entre. */
async function endOfFamily(db: Db, familyId: string): Promise<number> {
  const last = await db.tag.aggregate({ where: { familyId }, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? -1) + 1;
}

/** Ordre d'affichage : dans une famille son rang, puis le nom ; "Autres" par nom. */
function byFamilyOrder(
  a: { familyId: string | null; sortOrder: number; name: string },
  b: { familyId: string | null; sortOrder: number; name: string }
): number {
  const rank = (t: typeof a) => (t.familyId ? t.sortOrder : 0);
  return rank(a) - rank(b) || a.name.localeCompare(b.name, "fr");
}

/** Renomme et/ou range dans une famille de l'espace (null : sans famille). */
export async function updateSpaceTag(
  ctx: Context,
  spaceId: string,
  tagId: string,
  body: { name?: string | undefined; familyId?: string | null | undefined }
): Promise<Tag> {
  const current = await activeTag(ctx, spaceId, tagId);
  if (body.familyId) await spaceFamily(ctx, spaceId, body.familyId);
  const joins = body.familyId && body.familyId !== current.familyId;
  try {
    const row = await ctx.db.tag.update({
      where: { id: tagId },
      data: {
        ...(body.name === undefined ? {} : { name: body.name.trim(), slug: slugOf(body.name) }),
        ...(body.familyId === undefined ? {} : { familyId: body.familyId }),
        ...(joins ? { sortOrder: await endOfFamily(ctx.db, body.familyId ?? "") } : {}),
      },
    });
    return toTag(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("RECIPE_002");
    throw error;
  }
}

/** Fusionne `tagId` dans `intoTagId` : les recettes taguees passent sur la cible. */
export async function mergeSpaceTag(
  ctx: Context,
  spaceId: string,
  tagId: string,
  intoTagId: string
): Promise<void> {
  if (tagId === intoTagId) throw new AppError("VALIDATION_001");
  await activeTag(ctx, spaceId, tagId);
  await activeTag(ctx, spaceId, intoTagId);
  await ctx.db.$transaction([
    ctx.db.$executeRaw`
      INSERT INTO "RecipeSpaceTag" ("recipeId", "spaceId", "tagId")
      SELECT "recipeId", "spaceId", ${intoTagId} FROM "RecipeSpaceTag" WHERE "tagId" = ${tagId}
      ON CONFLICT DO NOTHING`,
    ctx.db.recipeSpaceTag.deleteMany({ where: { tagId } }),
    ctx.db.tag.update({ where: { id: tagId }, data: { mergedIntoId: intoTagId } }),
  ]);
}

export async function deleteSpaceTag(ctx: Context, spaceId: string, tagId: string): Promise<void> {
  await activeTag(ctx, spaceId, tagId);
  await ctx.db.$transaction([
    ctx.db.recipeSpaceTag.deleteMany({ where: { tagId } }),
    ctx.db.tag.update({ where: { id: tagId }, data: { deletedAt: new Date() } }),
  ]);
}

// --- Familles d'espace [D216] ---

async function spaceFamily(ctx: Context, spaceId: string, familyId: string) {
  const family = await ctx.db.tagFamily.findFirst({
    where: { id: familyId, scope: "SPACE", spaceId },
  });
  if (!family) throw new AppError("RECIPE_018");
  return family;
}

function toFamily(row: { id: string; scope: "GLOBAL" | "SPACE"; name: string }): TagFamily {
  return { id: row.id, scope: row.scope, name: row.name };
}

async function listSpaceFamilies(ctx: Context, spaceId: string): Promise<TagFamily[]> {
  const rows = await ctx.db.tagFamily.findMany({
    where: { scope: "SPACE", spaceId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toFamily);
}

/** Une autre famille de l'espace porte deja ce nom (sans casse ni accents). */
async function assertFamilyNameFree(
  ctx: Context,
  spaceId: string,
  name: string,
  exceptId?: string
) {
  const others = await ctx.db.tagFamily.findMany({
    where: { scope: "SPACE", spaceId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  const wanted = normalizeName(name);
  if (others.some((f) => normalizeName(f.name) === wanted)) throw new AppError("RECIPE_019");
}

/** Nouvelle famille en fin de liste. */
export async function createSpaceFamily(
  ctx: Context,
  spaceId: string,
  name: string
): Promise<TagFamily> {
  await assertFamilyNameFree(ctx, spaceId, name);
  const last = await ctx.db.tagFamily.aggregate({
    where: { scope: "SPACE", spaceId },
    _max: { sortOrder: true },
  });
  const row = await ctx.db.tagFamily.create({
    data: {
      scope: "SPACE",
      spaceId,
      name: name.trim(),
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  return toFamily(row);
}

export async function renameSpaceFamily(
  ctx: Context,
  spaceId: string,
  familyId: string,
  name: string
): Promise<TagFamily> {
  await spaceFamily(ctx, spaceId, familyId);
  await assertFamilyNameFree(ctx, spaceId, name, familyId);
  const row = await ctx.db.tagFamily.update({
    where: { id: familyId },
    data: { name: name.trim() },
  });
  return toFamily(row);
}

/** Ordre des familles de l'espace : la liste complete, chacune une fois. */
export async function reorderSpaceFamilies(
  ctx: Context,
  spaceId: string,
  ids: string[]
): Promise<TagFamily[]> {
  const known = new Set((await listSpaceFamilies(ctx, spaceId)).map((f) => f.id));
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== known.size ||
    ids.some((i) => !known.has(i))
  ) {
    throw new AppError("RECIPE_020");
  }
  await ctx.db.$transaction(
    ids.map((id, index) => ctx.db.tagFamily.update({ where: { id }, data: { sortOrder: index } }))
  );
  return listSpaceFamilies(ctx, spaceId);
}

/** Ordre des tags d'une famille de l'espace : chacun de ses tags une fois. */
export async function reorderFamilyTags(
  ctx: Context,
  spaceId: string,
  familyId: string,
  ids: string[]
): Promise<Tag[]> {
  await spaceFamily(ctx, spaceId, familyId);
  const live = { familyId, spaceId, deletedAt: null, mergedIntoId: null };
  const known = new Set(
    (await ctx.db.tag.findMany({ where: live, select: { id: true } })).map((t) => t.id)
  );
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== known.size ||
    ids.some((i) => !known.has(i))
  ) {
    throw new AppError("RECIPE_021");
  }
  await ctx.db.$transaction(
    ids.map((id, index) => ctx.db.tag.update({ where: { id }, data: { sortOrder: index } }))
  );
  const rows = await ctx.db.tag.findMany({ where: live, orderBy: { sortOrder: "asc" } });
  return rows.map(toTag);
}

/** Suppression : ses tags restent, sans famille ("Autres"). */
export async function deleteSpaceFamily(
  ctx: Context,
  spaceId: string,
  familyId: string
): Promise<void> {
  await spaceFamily(ctx, spaceId, familyId);
  await ctx.db.tagFamily.delete({ where: { id: familyId } });
}

// --- Catalogue [D216] ---

/**
 * Familles globales puis de l'espace, dans leur ordre ; tags globaux et de
 * l'espace avec leur famille et le nombre de recettes visibles ici par `viewerId`
 * (une recette masquee ne compte que pour son auteur, comme dans la liste).
 */
export async function tagCatalog(
  ctx: Context,
  spaceId: string,
  viewerId: string
): Promise<TagCatalog> {
  const visible = Prisma.sql`${visibleInSql(spaceId)} AND r."deletedAt" IS NULL
    AND (r."hiddenAt" IS NULL OR r."authorId" = ${viewerId})`;
  const [globalFamilies, spaceFamilies, tags, counts] = await Promise.all([
    ctx.db.tagFamily.findMany({
      where: { scope: "GLOBAL" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { translations: { where: { locale: LOCALE } } },
    }),
    listSpaceFamilies(ctx, spaceId),
    ctx.db.tag.findMany({
      where: {
        OR: [{ scope: "GLOBAL" }, { scope: "SPACE", spaceId }],
        deletedAt: null,
        mergedIntoId: null,
      },
      include: { translations: { where: { locale: LOCALE } } },
    }),
    ctx.db.$queryRaw<{ tagId: string; count: number }[]>`
      SELECT t."tagId", count(*)::int AS count FROM (
        SELECT g."tagId", g."recipeId" FROM "RecipeGlobalTag" g
        UNION ALL
        SELECT s."tagId", s."recipeId" FROM "RecipeSpaceTag" s WHERE s."spaceId" = ${spaceId}
      ) t JOIN "Recipe" r ON r.id = t."recipeId"
      WHERE ${visible}
      GROUP BY t."tagId"`,
  ]);
  const countOf = new Map(counts.map((row) => [row.tagId, row.count]));
  const catalogTags: CatalogTag[] = tags
    .map((row) => ({
      id: row.id,
      scope: row.scope,
      name: row.translations[0]?.name ?? row.name,
      familyId: row.familyId,
      sortOrder: row.sortOrder,
      recipeCount: countOf.get(row.id) ?? 0,
    }))
    .sort(byFamilyOrder)
    .map(({ sortOrder: _, ...tag }) => tag);
  return {
    families: [
      ...globalFamilies.map((row) =>
        toFamily({ ...row, name: row.translations[0]?.name ?? row.name })
      ),
      ...spaceFamilies,
    ],
    tags: catalogTags,
  };
}

// --- Tags repris au partage [D216] ---

/** Tags d'espace actifs de chaque recette dans son espace d'origine, par recette. */
export async function homeTagsOf(
  db: Db,
  recipes: readonly { id: string; homeSpaceId: string }[]
): Promise<Map<string, Tag[]>> {
  const rows = await db.recipeSpaceTag.findMany({
    where: {
      OR: recipes.map((r) => ({ recipeId: r.id, spaceId: r.homeSpaceId })),
      tag: { deletedAt: null, mergedIntoId: null },
    },
    include: { tag: true },
  });
  const byRecipe = new Map<string, Tag[]>();
  for (const row of rows) {
    const list = byRecipe.get(row.recipeId) ?? [];
    list.push(toTag(row.tag));
    byRecipe.set(row.recipeId, list);
  }
  for (const list of byRecipe.values()) list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return byRecipe;
}

/**
 * Pose dans `spaceId` les tags d'origine de la recette choisis (`tagIds`) : un tag
 * de meme nom (slug) de l'espace cible est pose, sinon il y est cree (sans famille).
 * Un id qui n'est pas un tag d'origine de la recette est ignore.
 */
export async function carryHomeTags(
  db: Db,
  recipe: { id: string; homeSpaceId: string },
  tagIds: readonly string[],
  spaceId: string,
  userId: string
): Promise<void> {
  if (tagIds.length === 0) return;
  const home = (await homeTagsOf(db, [recipe])).get(recipe.id) ?? [];
  const chosen = home.filter((tag) => tagIds.includes(tag.id));
  const targets: string[] = [];
  for (const tag of chosen) {
    targets.push((await findOrCreateIn(db, spaceId, tag.name, userId)).tag.id);
  }
  if (targets.length === 0) return;
  await db.recipeSpaceTag.createMany({
    data: targets.map((tagId) => ({ recipeId: recipe.id, spaceId, tagId })),
    skipDuplicates: true,
  });
}

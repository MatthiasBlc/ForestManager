// Tags d'espace du module Recettes [D08, D19] : tout membre en cree (en taguant),
// les moderateurs renomment, fusionnent, suppriment.
import { normalizeName, type Tag } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { AppError } from "../../core/http/errors.ts";

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
  const slug = slugOf(name);
  const existing = await ctx.db.tag.findUnique({ where: { spaceId_slug: { spaceId, slug } } });
  if (existing && !existing.deletedAt) {
    const target = existing.mergedIntoId
      ? await ctx.db.tag.findUniqueOrThrow({ where: { id: existing.mergedIntoId } })
      : existing;
    return { tag: toTag(target), created: false };
  }
  if (existing) {
    // Tag supprime : il revient avec le nom saisi.
    const revived = await ctx.db.tag.update({
      where: { id: existing.id },
      data: { deletedAt: null, mergedIntoId: null, name: name.trim() },
    });
    return { tag: toTag(revived), created: true };
  }
  const row = await ctx.db.tag.create({
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

export async function renameSpaceTag(
  ctx: Context,
  spaceId: string,
  tagId: string,
  name: string
): Promise<Tag> {
  await activeTag(ctx, spaceId, tagId);
  try {
    const row = await ctx.db.tag.update({
      where: { id: tagId },
      data: { name: name.trim(), slug: slugOf(name) },
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

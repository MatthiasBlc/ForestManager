// Historique des revisions d'une recette et restauration [D05, D30, D55, F-REC-8].
// Les changements de chaque revision sont calcules en comparant son instantane
// a celui de la revision precedente (rien de plus n'est stocke).
import {
  blockInputSchema,
  type Recipe,
  type RecipeRevision,
  type RevisionChange,
} from "@fm/shared";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import type { Context } from "../../core/context.ts";
import { AppError } from "../../core/http/errors.ts";
import { linksOf, type RecipeContent } from "./content.ts";
import {
  findEditable,
  findVisible,
  getRecipe,
  writeRevision,
  type RecipeActor,
} from "./service.ts";

/** Forme de `snapshotOf` (content.ts), relue a la lecture. */
export const snapshotSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  yield: z.object({ quantity: z.number(), unitId: z.string().nullable() }),
  times: z.object({
    prep: z.number().nullable(),
    cook: z.number().nullable(),
    rest: z.number().nullable(),
  }),
  isBase: z.boolean(),
  blocks: z.array(blockInputSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

/** Ce que l'on compare pour chaque type de changement, dans l'ordre affiche. */
const PARTS: Record<RevisionChange, (s: Snapshot) => unknown> = {
  title: (s) => s.title,
  description: (s) => s.description,
  notes: (s) => s.notes,
  source: (s) => s.sourceUrl,
  yield: (s) => s.yield,
  times: (s) => s.times,
  base: (s) => s.isBase,
  blocks: (s) => s.blocks.map((block) => (block.kind === "LOCAL" ? { title: block.title } : block)),
  ingredients: (s) => s.blocks.map((block) => (block.kind === "LOCAL" ? block.ingredients : [])),
  steps: (s) => s.blocks.map((block) => (block.kind === "LOCAL" ? block.steps : [])),
};

export async function snapshotAt(
  db: Context["db"],
  recipeId: string,
  number: number
): Promise<Snapshot> {
  const row = await db.recipeRevision.findUniqueOrThrow({
    where: { recipeId_number: { recipeId, number } },
    select: { snapshot: true },
  });
  return snapshotSchema.parse(row.snapshot);
}

export function changesBetween(previous: Snapshot | null, next: Snapshot): RevisionChange[] {
  if (!previous) return [];
  return (Object.keys(PARTS) as RevisionChange[]).filter(
    (key) => !isDeepStrictEqual(PARTS[key](previous), PARTS[key](next))
  );
}

/** Revisions de la plus recente a la plus ancienne ; visible par qui voit la recette. */
export async function listRevisions(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<RecipeRevision[]> {
  await findVisible(ctx, actor, recipeId);
  const rows = await ctx.db.recipeRevision.findMany({
    where: { recipeId },
    orderBy: { number: "asc" },
    select: {
      number: true,
      source: true,
      snapshot: true,
      createdAt: true,
      author: { select: { id: true, username: true } },
    },
  });
  let previous: Snapshot | null = null;
  const revisions = rows.map((row) => {
    const snapshot = snapshotSchema.parse(row.snapshot);
    const revision: RecipeRevision = {
      number: row.number,
      source: row.source,
      author: { id: row.author.id, username: row.author.username, avatarUrl: null },
      createdAt: row.createdAt.toISOString(),
      changes: changesBetween(previous, snapshot),
    };
    previous = snapshot;
    return revision;
  });
  return revisions.reverse();
}

export function contentOf(
  snapshot: Snapshot,
  tags: Pick<RecipeContent, "globalTagIds" | "spaceTagIds">
) {
  return {
    title: snapshot.title,
    description: snapshot.description,
    notes: snapshot.notes,
    sourceUrl: snapshot.sourceUrl,
    yieldQuantity: snapshot.yield.quantity,
    yieldUnitId: snapshot.yield.unitId,
    prepMinutes: snapshot.times.prep,
    cookMinutes: snapshot.times.cook,
    restMinutes: snapshot.times.rest,
    isBase: snapshot.isBase,
    blocks: snapshot.blocks,
    ...tags,
  } satisfies RecipeContent;
}

/**
 * Restaure le contenu d'une revision dans une nouvelle revision RESTORE [D55] :
 * rien n'est efface. Les tags actuels sont gardes (hors revisions, D19).
 */
export async function restoreRevision(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  number: number,
  baseRevision: number
): Promise<Recipe> {
  const current = await findEditable(ctx, actor, recipeId);
  if (number === current.currentRevision) throw new AppError("RECIPE_005");
  const row = await ctx.db.recipeRevision.findUnique({
    where: { recipeId_number: { recipeId, number } },
    select: { snapshot: true },
  });
  if (!row) throw new AppError("RECIPE_006");
  const tags = {
    globalTagIds: current.globalTags.map((link) => link.tag.id),
    spaceTagIds: current.spaceTags.map((link) => link.tag.id),
  };
  const content = contentOf(snapshotSchema.parse(row.snapshot), tags);
  // Les liens de la revision restauree etaient valables : ils sont gardes.
  const keepLinks = new Set(linksOf(content.blocks));
  await writeRevision(ctx, actor, recipeId, content, baseRevision, "RESTORE", keepLinks);
  return getRecipe(ctx, actor, recipeId);
}

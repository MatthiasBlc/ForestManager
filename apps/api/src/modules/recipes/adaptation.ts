// Adaptation d'une recette pour un espace (C3.6) [D17, D105, D140, D166] :
// copie liee a l'original et a la revision avec laquelle elle est alignee.
// L'original n'est jamais modifie ; "Original modifie" quand il avance, et la
// comparaison relit les instantanes de revision (rien de plus n'est stocke).
import {
  isAllowed,
  modulePermissionDefinition,
  type Recipe,
  type RecipeComparison,
  type RecipeContentView,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import { AppError } from "../../core/http/errors.ts";
import { isModuleActive } from "../../core/modules/guards.ts";
import { loadAccess } from "../../core/spaces/access.ts";
import { LOCALE, linksOf } from "./content.ts";
import { canModerate, RECIPE_PERMISSIONS } from "./permissions.ts";
import { contentOf, snapshotAt, type Snapshot } from "./revisions.ts";
import { createRecipe, findEditable, findVisible, rightsOf, type RecipeActor } from "./service.ts";

type Db = Context["db"];

/** Acteur dans l'espace cible : membre actif, module actif, droit de creer. */
export async function targetActor(
  ctx: Context,
  userId: string,
  spaceId: string
): Promise<RecipeActor> {
  const access = await loadAccess(ctx.db, spaceId, userId);
  if (!(await isModuleActive(ctx.db, spaceId, "recipes"))) throw new AppError("MODULE_001");
  const space = { kind: access.space.kind, role: access.role };
  const create = modulePermissionDefinition(RECIPE_PERMISSIONS["recipes.create"]);
  if (!isAllowed(create, { authenticated: true, space })) throw new AppError("SPACE_002");
  return { userId, spaceId, moderate: canModerate(space.kind, space.role) };
}

/**
 * F-ADAPTER : nouvelle recette de l'espace cible, a l'auteur qui adapte, avec le
 * contenu actuel et les tags globaux de l'original (pas ses tags d'espace, D19).
 * Les liens de l'original sont gardes, meme non visibles dans l'espace cible.
 */
export async function adaptRecipe(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  targetSpaceId: string
): Promise<Recipe> {
  const original = await findVisible(ctx, actor, recipeId);
  const target = await targetActor(ctx, actor.userId, targetSpaceId);
  const snapshot = await snapshotAt(ctx.db, original.id, original.currentRevision);
  const content = contentOf(snapshot, {
    globalTagIds: original.globalTags.map((link) => link.tag.id),
    spaceTagIds: [],
  });
  return createRecipe(ctx, target, content, {
    adaptedFromId: original.id,
    adaptedFromRevision: original.currentRevision,
    keepLinks: new Set(linksOf(content.blocks)),
  });
}

/** Instantanes rendus lisibles : noms des ingredients, titres des recettes liees. */
export async function viewsOf(
  db: Db,
  snapshots: readonly Snapshot[]
): Promise<RecipeContentView[]> {
  const blocks = snapshots.flatMap((s) => s.blocks);
  const ingredientIds = new Set(
    blocks.flatMap((b) => (b.kind === "LOCAL" ? b.ingredients.map((l) => l.ingredientId) : []))
  );
  const [names, linked] = await Promise.all([
    db.ingredientTranslation.findMany({
      where: { ingredientId: { in: [...ingredientIds] }, locale: LOCALE },
      select: { ingredientId: true, name: true, namePlural: true },
    }),
    db.recipe.findMany({
      where: { id: { in: linksOf(blocks) } },
      select: { id: true, title: true, deletedAt: true },
    }),
  ]);
  const nameOf = new Map(names.map((row) => [row.ingredientId, row]));
  const titleOf = new Map(linked.map((row) => [row.id, row.deletedAt ? null : row.title]));
  return snapshots.map((s) => ({
    title: s.title,
    description: s.description,
    notes: s.notes,
    sourceUrl: s.sourceUrl,
    yieldQuantity: s.yield.quantity,
    yieldUnitId: s.yield.unitId,
    prepMinutes: s.times.prep,
    cookMinutes: s.times.cook,
    restMinutes: s.times.rest,
    isBase: s.isBase,
    blocks: s.blocks.map((block) =>
      block.kind === "RECIPE"
        ? {
            kind: "RECIPE" as const,
            recipeId: block.recipeId,
            title: titleOf.get(block.recipeId) ?? null,
            quantity: block.quantity,
            unitId: block.unitId ?? null,
          }
        : {
            kind: "LOCAL" as const,
            title: block.title ?? null,
            ingredients: block.ingredients.map((line) => ({
              ingredientId: line.ingredientId,
              name: nameOf.get(line.ingredientId)?.name ?? "",
              namePlural: nameOf.get(line.ingredientId)?.namePlural ?? null,
              quantity: line.quantity ?? null,
              unitId: line.unitId ?? null,
              note: line.note ?? null,
              optional: line.optional,
            })),
            steps: block.steps,
          }
    ),
  }));
}

/** Adaptation visible ici et son original (meme supprime). */
async function findAdaptation(ctx: Context, actor: RecipeActor, recipeId: string) {
  const adaptation = await findVisible(ctx, actor, recipeId);
  if (!adaptation.adaptedFromId || adaptation.adaptedFromRevision === null) {
    throw new AppError("RECIPE_011");
  }
  const original = await ctx.db.recipe.findUniqueOrThrow({
    where: { id: adaptation.adaptedFromId },
    select: {
      id: true,
      title: true,
      currentRevision: true,
      deletedAt: true,
      author: { select: { id: true, username: true } },
      homeSpace: { select: { id: true, name: true } },
    },
  });
  return { adaptation, original, baseRevision: adaptation.adaptedFromRevision };
}

/**
 * E-COMPARER-ORIGINAL : lisible par tout membre qui voit l'adaptation, meme sans
 * voir l'original (l'adaptation en est deja une copie, D17).
 */
export async function compareWithOriginal(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<RecipeComparison> {
  const { adaptation, original, baseRevision } = await findAdaptation(ctx, actor, recipeId);
  const deleted = original.deletedAt !== null;
  const [base, current, mine, last, can] = await Promise.all([
    snapshotAt(ctx.db, original.id, baseRevision),
    deleted ? null : snapshotAt(ctx.db, original.id, original.currentRevision),
    snapshotAt(ctx.db, adaptation.id, adaptation.currentRevision),
    !deleted && original.currentRevision > baseRevision
      ? ctx.db.recipeRevision.findUniqueOrThrow({
          where: { recipeId_number: { recipeId: original.id, number: original.currentRevision } },
          select: { createdAt: true, author: { select: { id: true, username: true } } },
        })
      : null,
    rightsOf(ctx, actor, adaptation),
  ]);
  const views = await viewsOf(ctx.db, current ? [base, mine, current] : [base, mine]);
  const [baseView, mineView, currentView] = views;
  if (!baseView || !mineView) throw new Error("missing views");
  return {
    original: {
      id: original.id,
      title: original.title,
      author: { id: original.author.id, username: original.author.username, avatarUrl: null },
      homeSpace: original.homeSpace,
      deleted,
      currentRevision: original.currentRevision,
      lastChange: last
        ? {
            at: last.createdAt.toISOString(),
            by: { id: last.author.id, username: last.author.username, avatarUrl: null },
          }
        : null,
    },
    baseRevision,
    base: baseView,
    current: currentView ?? null,
    adaptation: mineView,
    canMarkSeen: can.edit,
  };
}

/** "Marquer comme vu" : l'adaptation s'aligne sur la revision actuelle de l'original. */
export async function markOriginalSeen(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<void> {
  const { original } = await findAdaptation(ctx, actor, recipeId);
  await findEditable(ctx, actor, recipeId);
  await ctx.db.recipe.update({
    where: { id: recipeId },
    data: { adaptedFromRevision: original.currentRevision },
  });
}

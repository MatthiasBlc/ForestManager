// Recettes d'un espace (C3.2) : creer, lire, modifier, supprimer [D05, D57, D122].
// Visibilite : espace d'origine ; le partage (C3.5) ajoutera les espaces de partage.
import type { Recipe, RevisionSource } from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import {
  blocksCreate,
  checkTags,
  detailInclude,
  recipeColumns,
  resolveContent,
  snapshotOf,
  toRecipe,
  type RecipeContent,
} from "./content.ts";

/** Qui agit, dans quel espace, avec quels droits de module. */
export interface RecipeActor {
  userId: string;
  spaceId: string;
  /** Permission `recipes.moderate` dans cet espace (MOD, OWNER, OWNER du perso). */
  moderate: boolean;
}

/** Recettes visibles dans un espace [D03]. */
export function visibleIn(spaceId: string): Prisma.RecipeWhereInput {
  return { homeSpaceId: spaceId, deletedAt: null };
}

interface RightsRow {
  homeSpaceId: string;
  authorId: string;
}

async function authorIsActiveMember(ctx: Context, recipe: RightsRow): Promise<boolean> {
  const membership = await ctx.db.membership.findUnique({
    where: { spaceId_userId: { spaceId: recipe.homeSpaceId, userId: recipe.authorId } },
    select: { leftAt: true },
  });
  return membership !== null && membership.leftAt === null;
}

/**
 * Modifier : auteur, MOD et OWNER de l'espace d'origine (D57, D122).
 * Supprimer : auteur ; MOD et OWNER de l'espace d'origine si l'auteur en est parti.
 */
async function rightsOf(
  ctx: Context,
  actor: RecipeActor,
  recipe: RightsRow
): Promise<Recipe["can"]> {
  if (recipe.homeSpaceId !== actor.spaceId) return { edit: false, delete: false };
  if (recipe.authorId === actor.userId) return { edit: true, delete: true };
  if (!actor.moderate) return { edit: false, delete: false };
  return { edit: true, delete: !(await authorIsActiveMember(ctx, recipe)) };
}

export async function findVisible(ctx: Context, actor: RecipeActor, recipeId: string) {
  const row = await ctx.db.recipe.findFirst({
    where: { id: recipeId, ...visibleIn(actor.spaceId) },
    include: detailInclude(actor.spaceId),
  });
  if (!row) throw new AppError("RECIPE_001");
  return row;
}

export async function getRecipe(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<Recipe> {
  const row = await findVisible(ctx, actor, recipeId);
  return toRecipe(row, await rightsOf(ctx, actor, row));
}

export async function createRecipe(
  ctx: Context,
  actor: RecipeActor,
  input: RecipeContent
): Promise<Recipe> {
  const content = await resolveContent(ctx.db, input, actor.spaceId);
  const id = await ctx.db.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        ...recipeColumns(content),
        homeSpaceId: actor.spaceId,
        authorId: actor.userId,
        currentRevision: 1,
        blocks: blocksCreate(content.blocks),
        globalTags: { create: content.globalTagIds.map((tagId) => ({ tagId })) },
        spaceTags: {
          create: content.spaceTagIds.map((tagId) => ({ tagId, spaceId: actor.spaceId })),
        },
        revisions: {
          create: {
            number: 1,
            source: "CREATE",
            authorId: actor.userId,
            snapshot: snapshotOf(content),
          },
        },
      },
      select: { id: true },
    });
    return recipe.id;
  });
  return getRecipe(ctx, actor, id);
}

export async function updateRecipe(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  input: RecipeContent & { revision: number }
): Promise<Recipe> {
  await findEditable(ctx, actor, recipeId);
  await writeRevision(ctx, actor, recipeId, input, input.revision, "EDIT");
  return getRecipe(ctx, actor, recipeId);
}

/** Recette visible que l'acteur peut modifier (sinon SPACE_002). */
export async function findEditable(ctx: Context, actor: RecipeActor, recipeId: string) {
  const current = await findVisible(ctx, actor, recipeId);
  if (!(await rightsOf(ctx, actor, current)).edit) throw new AppError("SPACE_002");
  return current;
}

/**
 * Remplace le contenu et ajoute la revision suivante. Verrou optimiste [D163] :
 * `baseRevision` doit encore etre la revision courante, sinon RECIPE_004.
 */
export async function writeRevision(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  input: RecipeContent,
  baseRevision: number,
  source: RevisionSource
): Promise<void> {
  const content = await resolveContent(ctx.db, input, actor.spaceId);
  const number = baseRevision + 1;
  await ctx.db.$transaction(async (tx) => {
    const updated = await tx.recipe.updateMany({
      where: { id: recipeId, deletedAt: null, currentRevision: baseRevision },
      data: { ...recipeColumns(content), currentRevision: number },
    });
    if (updated.count === 0) throw new AppError("RECIPE_004");
    await tx.recipeBlock.deleteMany({ where: { recipeId } });
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        blocks: blocksCreate(content.blocks),
        globalTags: {
          deleteMany: {},
          create: content.globalTagIds.map((tagId) => ({ tagId })),
        },
        spaceTags: {
          deleteMany: { spaceId: actor.spaceId },
          create: content.spaceTagIds.map((tagId) => ({ tagId, spaceId: actor.spaceId })),
        },
        revisions: {
          create: { number, source, authorId: actor.userId, snapshot: snapshotOf(content) },
        },
      },
    });
  });
}

/** Suppression masquee : la recette disparait de tous les espaces [F-REC-10]. */
export async function deleteRecipe(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<void> {
  const current = await findVisible(ctx, actor, recipeId);
  if (!(await rightsOf(ctx, actor, current)).delete) throw new AppError("SPACE_002");
  await ctx.db.recipe.update({ where: { id: recipeId }, data: { deletedAt: new Date() } });
}

/** Tags d'espace poses sur une recette visible, par tout membre [D19, D27]. */
export async function setSpaceTags(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  tagIds: string[]
): Promise<Recipe> {
  await findVisible(ctx, actor, recipeId);
  await checkTags(ctx.db, tagIds, actor.spaceId, "tagIds");
  await ctx.db.$transaction([
    ctx.db.recipeSpaceTag.deleteMany({ where: { recipeId, spaceId: actor.spaceId } }),
    ctx.db.recipeSpaceTag.createMany({
      data: tagIds.map((tagId) => ({ recipeId, spaceId: actor.spaceId, tagId })),
    }),
  ]);
  return getRecipe(ctx, actor, recipeId);
}

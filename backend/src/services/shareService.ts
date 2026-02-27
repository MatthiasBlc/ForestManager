import { PrismaClient } from "@prisma/client";
import prisma from "../util/db";
import { RECIPE_TAGS_SELECT, RECIPE_INGREDIENTS_SELECT, RECIPE_STEPS_SELECT } from "../util/prismaSelects";
import { resolveTagsForFork } from "./tagService";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface SourceRecipeForShare {
  id: string;
  title: string;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
  imageUrl: string | null;
  communityId: string;
  tags: { tagId: string; tag: { id: string; name: string; scope: string; communityId: string | null } }[];
  ingredients: { ingredientId: string; quantity: number | null; order: number }[];
  steps: { order: number; instruction: string }[];
}

/**
 * Cree un fork d'une recette vers une communaute cible.
 * Copie tags/ingredients, met a jour les analytics de la chaine, cree les activity logs.
 */
export async function forkRecipe(
  userId: string,
  sourceRecipe: SourceRecipeForShare,
  targetCommunityId: string,
  targetCommunityName: string
) {
  return prisma.$transaction(async (tx) => {
    // Creer la nouvelle recette (fork)
    const forkedRecipe = await tx.recipe.create({
      data: {
        title: sourceRecipe.title,
        servings: sourceRecipe.servings,
        prepTime: sourceRecipe.prepTime,
        cookTime: sourceRecipe.cookTime,
        restTime: sourceRecipe.restTime,
        imageUrl: sourceRecipe.imageUrl,
        creatorId: userId,
        communityId: targetCommunityId,
        originRecipeId: sourceRecipe.id,
        sharedFromCommunityId: sourceRecipe.communityId,
        isVariant: false,
      },
    });

    // Copier les steps
    if (sourceRecipe.steps.length > 0) {
      await tx.recipeStep.createMany({
        data: sourceRecipe.steps.map((s) => ({
          recipeId: forkedRecipe.id,
          order: s.order,
          instruction: s.instruction,
        })),
      });
    }

    // Copier les tags (scope-aware)
    let forkPendingTagIds: string[] = [];
    if (sourceRecipe.tags.length > 0) {
      const sourceTags = sourceRecipe.tags.map((rt) => ({
        id: rt.tag.id,
        name: rt.tag.name,
        scope: rt.tag.scope,
        communityId: rt.tag.communityId,
      }));
      const { tagIds, pendingTagIds } = await resolveTagsForFork(tx, sourceTags, targetCommunityId, userId);
      forkPendingTagIds = pendingTagIds;
      if (tagIds.length > 0) {
        await tx.recipeTag.createMany({
          data: tagIds.map((tagId) => ({
            recipeId: forkedRecipe.id,
            tagId,
          })),
        });
      }
    }

    // Copier les ingredients
    if (sourceRecipe.ingredients.length > 0) {
      await tx.recipeIngredient.createMany({
        data: sourceRecipe.ingredients.map((ri) => ({
          recipeId: forkedRecipe.id,
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          order: ri.order,
        })),
      });
    }

    // Mettre a jour les analytics (remonter la chaine des ancetres)
    await updateAncestorAnalytics(tx, sourceRecipe.id);

    // Creer ActivityLog dans la communaute source
    await tx.activityLog.create({
      data: {
        type: "RECIPE_SHARED",
        userId,
        communityId: sourceRecipe.communityId,
        recipeId: sourceRecipe.id,
        metadata: {
          targetCommunityId,
          targetCommunityName,
          forkedRecipeId: forkedRecipe.id,
        },
      },
    });

    // Creer ActivityLog dans la communaute cible
    await tx.activityLog.create({
      data: {
        type: "RECIPE_SHARED",
        userId,
        communityId: targetCommunityId,
        recipeId: forkedRecipe.id,
        metadata: {
          fromCommunityId: sourceRecipe.communityId,
          originRecipeId: sourceRecipe.id,
        },
      },
    });

    // Recuperer la recette forkee avec toutes ses relations
    const forkedResult = await tx.recipe.findUnique({
      where: { id: forkedRecipe.id },
      select: {
        id: true,
        title: true,
        servings: true,
        prepTime: true,
        cookTime: true,
        restTime: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        creatorId: true,
        communityId: true,
        originRecipeId: true,
        sharedFromCommunityId: true,
        isVariant: true,
        community: { select: { id: true, name: true } },
        tags: RECIPE_TAGS_SELECT,
        ingredients: RECIPE_INGREDIENTS_SELECT,
        steps: RECIPE_STEPS_SELECT,
      },
    });

    return { recipe: forkedResult, pendingTagIds: forkPendingTagIds };
  });
}

interface SourceRecipeForPublish {
  id: string;
  title: string;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
  imageUrl: string | null;
  tags: { tagId: string }[];
  ingredients: { ingredientId: string; quantity: number | null; order: number }[];
  steps: { order: number; instruction: string }[];
}

/**
 * Publie une recette personnelle vers plusieurs communautes.
 */
export async function publishRecipe(
  userId: string,
  sourceRecipe: SourceRecipeForPublish,
  communityIds: string[]
) {
  return prisma.$transaction(async (tx) => {
    const results = [];

    for (const communityId of communityIds) {
      const communityRecipe = await tx.recipe.create({
        data: {
          title: sourceRecipe.title,
          servings: sourceRecipe.servings,
          prepTime: sourceRecipe.prepTime,
          cookTime: sourceRecipe.cookTime,
          restTime: sourceRecipe.restTime,
          imageUrl: sourceRecipe.imageUrl,
          creatorId: userId,
          communityId,
          originRecipeId: sourceRecipe.id,
        },
      });

      // Copier les steps
      if (sourceRecipe.steps.length > 0) {
        await tx.recipeStep.createMany({
          data: sourceRecipe.steps.map((s) => ({
            recipeId: communityRecipe.id,
            order: s.order,
            instruction: s.instruction,
          })),
        });
      }

      if (sourceRecipe.tags.length > 0) {
        await tx.recipeTag.createMany({
          data: sourceRecipe.tags.map((rt) => ({
            recipeId: communityRecipe.id,
            tagId: rt.tagId,
          })),
        });
      }

      if (sourceRecipe.ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: sourceRecipe.ingredients.map((ri) => ({
            recipeId: communityRecipe.id,
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            order: ri.order,
          })),
        });
      }

      await tx.activityLog.create({
        data: {
          type: "RECIPE_CREATED",
          userId,
          communityId,
          recipeId: communityRecipe.id,
        },
      });

      results.push(communityRecipe);
    }

    return Promise.all(
      results.map((r) =>
        tx.recipe.findUnique({
          where: { id: r.id },
          select: {
            id: true,
            title: true,
            communityId: true,
            community: { select: { id: true, name: true } },
            createdAt: true,
          },
        })
      )
    );
  });
}

/**
 * Trouve toutes les communautes ou une recette (et sa famille) existe.
 * Remonte la chaine originRecipeId jusqu'a la racine, puis descend pour tout collecter.
 */
export async function getRecipeFamilyCommunities(recipeId: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, deletedAt: null },
  });

  if (!recipe) return null;

  // Remonter la chaine jusqu'a la racine
  let rootId = recipe.id;
  let current = recipe;
  while (current.originRecipeId) {
    const parent = await prisma.recipe.findFirst({
      where: { id: current.originRecipeId, deletedAt: null },
    });
    if (!parent) break;
    rootId = parent.id;
    current = parent;
  }

  // BFS pour collecter tous les IDs de la famille
  const allIds = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await prisma.recipe.findMany({
      where: { originRecipeId: parentId, deletedAt: null },
      select: { id: true },
    });
    for (const child of children) {
      if (!allIds.has(child.id)) {
        allIds.add(child.id);
        queue.push(child.id);
      }
    }
  }

  // Trouver toutes les communautes uniques
  const copies = await prisma.recipe.findMany({
    where: {
      id: { in: Array.from(allIds) },
      deletedAt: null,
      communityId: { not: null },
    },
    select: {
      communityId: true,
      community: { select: { id: true, name: true } },
    },
  });

  const seen = new Set<string>();
  return copies
    .filter((c) => c.community && !seen.has(c.community.id) && seen.add(c.community.id))
    .map((c) => c.community!);
}

// --- Helper interne ---

async function updateAncestorAnalytics(tx: TransactionClient, sourceRecipeId: string) {
  const recipesToUpdate: string[] = [sourceRecipeId];
  let currentRecipeId: string | null = sourceRecipeId;

  while (currentRecipeId) {
    const parentRecipe: { originRecipeId: string | null } | null =
      await tx.recipe.findFirst({
        where: { id: currentRecipeId },
        select: { originRecipeId: true },
      });

    if (parentRecipe?.originRecipeId) {
      recipesToUpdate.push(parentRecipe.originRecipeId);
      currentRecipeId = parentRecipe.originRecipeId;
    } else {
      currentRecipeId = null;
    }
  }

  for (const ancestorId of recipesToUpdate) {
    await tx.recipeAnalytics.upsert({
      where: { recipeId: ancestorId },
      create: { recipeId: ancestorId, shares: 1, forks: 1 },
      update: { shares: { increment: 1 }, forks: { increment: 1 } },
    });
  }
}

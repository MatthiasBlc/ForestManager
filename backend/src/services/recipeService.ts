import prisma from "../util/db";
import { PrismaClient } from "@prisma/client";
import { RECIPE_TAGS_SELECT, RECIPE_INGREDIENTS_SELECT, RECIPE_STEPS_SELECT } from "../util/prismaSelects";
import { resolveTagsForRecipe } from "./tagService";
import { StepInput } from "../util/validation";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface IngredientInput {
  name: string;
  quantity?: number;
  unitId?: string;
}

// --- Helpers partages pour tags/ingredients ---

export async function upsertTags(
  tx: TransactionClient,
  recipeId: string,
  tags: string[],
  userId: string,
  communityId: string | null
): Promise<string[]> {
  const { tagIds, pendingTagIds } = await resolveTagsForRecipe(tx, tags, userId, communityId);

  for (const tagId of tagIds) {
    await tx.recipeTag.create({
      data: { recipeId, tagId },
    });
  }

  return pendingTagIds;
}

export async function upsertIngredients(
  tx: TransactionClient,
  recipeId: string,
  ingredients: IngredientInput[],
  userId?: string
) {
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    const ingredientName = ing.name.trim().toLowerCase();
    if (!ingredientName) continue;

    // Chercher l'ingredient existant d'abord
    let ingredient = await tx.ingredient.findUnique({
      where: { name: ingredientName },
    });

    if (!ingredient) {
      // Nouvel ingredient : PENDING si cree par un user, APPROVED si pas de userId (admin/seed)
      ingredient = await tx.ingredient.create({
        data: {
          name: ingredientName,
          status: userId ? "PENDING" : "APPROVED",
          createdById: userId ?? null,
        },
      });
    }

    await tx.recipeIngredient.create({
      data: {
        recipeId,
        ingredientId: ingredient.id,
        quantity: ing.quantity ?? null,
        unitId: ing.unitId ?? null,
        order: i,
      },
    });
  }
}

export async function upsertProposalIngredients(
  tx: TransactionClient,
  proposalId: string,
  ingredients: IngredientInput[],
  userId?: string
) {
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    const ingredientName = ing.name.trim().toLowerCase();
    if (!ingredientName) continue;

    let ingredient = await tx.ingredient.findUnique({
      where: { name: ingredientName },
    });

    if (!ingredient) {
      ingredient = await tx.ingredient.create({
        data: {
          name: ingredientName,
          status: userId ? "PENDING" : "APPROVED",
          createdById: userId ?? null,
        },
      });
    }

    await tx.proposalIngredient.create({
      data: {
        proposalId,
        ingredientId: ingredient.id,
        quantity: ing.quantity ?? null,
        unitId: ing.unitId ?? null,
        order: i,
      },
    });
  }
}

// --- Helpers pour steps ---

export async function upsertSteps(
  tx: TransactionClient,
  recipeId: string,
  steps: StepInput[]
) {
  for (let i = 0; i < steps.length; i++) {
    await tx.recipeStep.create({
      data: {
        recipeId,
        order: i,
        instruction: steps[i].instruction.trim(),
      },
    });
  }
}

export async function upsertProposalSteps(
  tx: TransactionClient,
  proposalId: string,
  steps: StepInput[]
) {
  for (let i = 0; i < steps.length; i++) {
    await tx.proposalStep.create({
      data: {
        proposalId,
        order: i,
        instruction: steps[i].instruction.trim(),
      },
    });
  }
}

// --- Select pour re-fetch apres create/update ---

const RECIPE_RESULT_SELECT = {
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
  tags: RECIPE_TAGS_SELECT,
  ingredients: RECIPE_INGREDIENTS_SELECT,
  steps: RECIPE_STEPS_SELECT,
};

// --- Service functions ---

interface CreateRecipeData {
  title: string;
  servings: number;
  prepTime?: number | null;
  cookTime?: number | null;
  restTime?: number | null;
  steps: StepInput[];
  imageUrl?: string | null;
  tags: string[];
  ingredients: IngredientInput[];
}

export async function createRecipe(userId: string, data: CreateRecipeData) {
  return prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        title: data.title.trim(),
        servings: data.servings,
        prepTime: data.prepTime ?? null,
        cookTime: data.cookTime ?? null,
        restTime: data.restTime ?? null,
        imageUrl: data.imageUrl?.trim() || null,
        creatorId: userId,
      },
    });

    await upsertSteps(tx, recipe.id, data.steps);

    if (data.tags.length > 0) {
      await upsertTags(tx, recipe.id, data.tags, userId, null);
    }

    if (data.ingredients.length > 0) {
      await upsertIngredients(tx, recipe.id, data.ingredients, userId);
    }

    return tx.recipe.findUnique({
      where: { id: recipe.id },
      select: RECIPE_RESULT_SELECT,
    });
  });
}

interface UpdateRecipeData {
  title?: string;
  servings?: number;
  prepTime?: number | null;
  cookTime?: number | null;
  restTime?: number | null;
  steps?: StepInput[];
  imageUrl?: string;
  tags?: string[];
  ingredients?: IngredientInput[];
}

interface RecipeForSync {
  communityId: string | null;
  originRecipeId: string | null;
  sharedFromCommunityId: string | null;
  isVariant: boolean;
}

export async function updateRecipe(
  recipeId: string,
  data: UpdateRecipeData,
  recipe: RecipeForSync,
  userId: string
) {
  let pendingTagIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    // Mettre a jour les champs de base
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.servings !== undefined && { servings: data.servings }),
        ...(data.prepTime !== undefined && { prepTime: data.prepTime }),
        ...(data.cookTime !== undefined && { cookTime: data.cookTime }),
        ...(data.restTime !== undefined && { restTime: data.restTime }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl?.trim() || null }),
      },
    });

    // Remplacer steps si fournis
    if (data.steps !== undefined) {
      await tx.recipeStep.deleteMany({ where: { recipeId } });
      await upsertSteps(tx, recipeId, data.steps);
    }

    // Remplacer tags si fournis
    if (data.tags !== undefined) {
      await tx.recipeTag.deleteMany({ where: { recipeId } });
      pendingTagIds = await upsertTags(tx, recipeId, data.tags, userId, recipe.communityId);
    }

    // Remplacer ingredients si fournis
    if (data.ingredients !== undefined) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId } });
      await upsertIngredients(tx, recipeId, data.ingredients, userId);
    }

    // Synchronisation bidirectionnelle
    await syncLinkedRecipes(tx, recipeId, data, recipe, userId);

    return tx.recipe.findUnique({
      where: { id: recipeId },
      select: RECIPE_RESULT_SELECT,
    });
  });

  return { result, pendingTagIds };
}

/**
 * Synchronise titre, contenu, imageUrl et ingredients vers les recettes liees.
 * Tags sont LOCAUX (pas synchronises).
 * Forks (sharedFromCommunityId != null) et variantes (isVariant = true) sont exclus.
 */
async function syncLinkedRecipes(
  tx: TransactionClient,
  recipeId: string,
  data: UpdateRecipeData,
  recipe: RecipeForSync,
  userId: string
) {
  const syncData: Record<string, unknown> = {};
  if (data.title !== undefined) syncData.title = data.title.trim();
  if (data.servings !== undefined) syncData.servings = data.servings;
  if (data.prepTime !== undefined) syncData.prepTime = data.prepTime;
  if (data.cookTime !== undefined) syncData.cookTime = data.cookTime;
  if (data.restTime !== undefined) syncData.restTime = data.restTime;
  if (data.imageUrl !== undefined) syncData.imageUrl = data.imageUrl?.trim() || null;

  const hasSyncableFields = Object.keys(syncData).length > 0 || data.ingredients !== undefined || data.steps !== undefined;
  if (!hasSyncableFields) return;

  // Trouver les recettes liees a synchroniser
  let linkedRecipeIds: string[] = [];

  if (recipe.communityId === null) {
    // Recette personnelle : synchroniser toutes les copies communautaires
    const copies = await tx.recipe.findMany({
      where: {
        originRecipeId: recipeId,
        communityId: { not: null },
        deletedAt: null,
        isVariant: false,
        sharedFromCommunityId: null,
      },
      select: { id: true },
    });
    linkedRecipeIds = copies.map((c) => c.id);
  } else if (recipe.originRecipeId && !recipe.sharedFromCommunityId && !recipe.isVariant) {
    // Recette communautaire (pas un fork, pas une variante) : synchroniser la recette perso + autres copies
    linkedRecipeIds.push(recipe.originRecipeId);

    const otherCopies = await tx.recipe.findMany({
      where: {
        originRecipeId: recipe.originRecipeId,
        id: { not: recipeId },
        deletedAt: null,
        isVariant: false,
        sharedFromCommunityId: null,
      },
      select: { id: true },
    });
    linkedRecipeIds.push(...otherCopies.map((c) => c.id));
  }

  if (linkedRecipeIds.length === 0) return;

  // Mettre a jour titre, contenu, imageUrl
  if (Object.keys(syncData).length > 0) {
    await tx.recipe.updateMany({
      where: { id: { in: linkedRecipeIds } },
      data: syncData,
    });
  }

  // Synchroniser les steps
  if (data.steps !== undefined) {
    for (const linkedId of linkedRecipeIds) {
      await tx.recipeStep.deleteMany({ where: { recipeId: linkedId } });
      await upsertSteps(tx, linkedId, data.steps);
    }
  }

  // Synchroniser les ingredients
  if (data.ingredients !== undefined) {
    for (const linkedId of linkedRecipeIds) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: linkedId } });
      await upsertIngredients(tx, linkedId, data.ingredients, userId);
    }
  }
}

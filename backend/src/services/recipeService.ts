import prisma from "../util/db";
import { PrismaClient } from "@prisma/client";
import { RECIPE_TAGS_SELECT, RECIPE_INGREDIENTS_SELECT } from "../util/prismaSelects";
import { resolveTagsForRecipe } from "./tagService";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface IngredientInput {
  name: string;
  quantity?: string;
}

// --- Helpers partages pour tags/ingredients ---

export async function upsertTags(
  tx: TransactionClient,
  recipeId: string,
  tags: string[],
  userId: string,
  communityId: string | null
) {
  const { tagIds } = await resolveTagsForRecipe(tx, tags, userId, communityId);

  for (const tagId of tagIds) {
    await tx.recipeTag.create({
      data: { recipeId, tagId },
    });
  }
}

export async function upsertIngredients(
  tx: TransactionClient,
  recipeId: string,
  ingredients: IngredientInput[]
) {
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    const ingredientName = ing.name.trim().toLowerCase();
    if (!ingredientName) continue;

    const ingredient = await tx.ingredient.upsert({
      where: { name: ingredientName },
      create: { name: ingredientName },
      update: {},
    });

    await tx.recipeIngredient.create({
      data: {
        recipeId,
        ingredientId: ingredient.id,
        quantity: ing.quantity?.trim() || null,
        order: i,
      },
    });
  }
}

// --- Select pour re-fetch apres create/update ---

const RECIPE_RESULT_SELECT = {
  id: true,
  title: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  creatorId: true,
  tags: RECIPE_TAGS_SELECT,
  ingredients: RECIPE_INGREDIENTS_SELECT,
};

// --- Service functions ---

interface CreateRecipeData {
  title: string;
  content: string;
  imageUrl?: string | null;
  tags: string[];
  ingredients: IngredientInput[];
}

export async function createRecipe(userId: string, data: CreateRecipeData) {
  return prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        title: data.title.trim(),
        content: data.content.trim(),
        imageUrl: data.imageUrl?.trim() || null,
        creatorId: userId,
      },
    });

    if (data.tags.length > 0) {
      await upsertTags(tx, recipe.id, data.tags, userId, null);
    }

    if (data.ingredients.length > 0) {
      await upsertIngredients(tx, recipe.id, data.ingredients);
    }

    return tx.recipe.findUnique({
      where: { id: recipe.id },
      select: RECIPE_RESULT_SELECT,
    });
  });
}

interface UpdateRecipeData {
  title?: string;
  content?: string;
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
  return prisma.$transaction(async (tx) => {
    // Mettre a jour les champs de base
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.content !== undefined && { content: data.content.trim() }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl?.trim() || null }),
      },
    });

    // Remplacer tags si fournis
    if (data.tags !== undefined) {
      await tx.recipeTag.deleteMany({ where: { recipeId } });
      await upsertTags(tx, recipeId, data.tags, userId, recipe.communityId);
    }

    // Remplacer ingredients si fournis
    if (data.ingredients !== undefined) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId } });
      await upsertIngredients(tx, recipeId, data.ingredients);
    }

    // Synchronisation bidirectionnelle
    await syncLinkedRecipes(tx, recipeId, data, recipe);

    return tx.recipe.findUnique({
      where: { id: recipeId },
      select: RECIPE_RESULT_SELECT,
    });
  });
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
  recipe: RecipeForSync
) {
  const syncData: Record<string, unknown> = {};
  if (data.title !== undefined) syncData.title = data.title.trim();
  if (data.content !== undefined) syncData.content = data.content.trim();
  if (data.imageUrl !== undefined) syncData.imageUrl = data.imageUrl?.trim() || null;

  const hasSyncableFields = Object.keys(syncData).length > 0 || data.ingredients !== undefined;
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

  // Synchroniser les ingredients
  if (data.ingredients !== undefined) {
    for (const linkedId of linkedRecipeIds) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: linkedId } });
      await upsertIngredients(tx, linkedId, data.ingredients);
    }
  }
}

import prisma from "../util/db";
import { RECIPE_TAGS_SELECT, RECIPE_INGREDIENTS_SELECT, RECIPE_STEPS_SELECT } from "../util/prismaSelects";
import { IngredientInput, upsertTags, upsertIngredients, upsertSteps } from "./recipeService";
import { StepInput } from "../util/validation";

interface CreateCommunityRecipeData {
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

const COMMUNITY_RECIPE_SELECT = {
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
  tags: RECIPE_TAGS_SELECT,
  ingredients: RECIPE_INGREDIENTS_SELECT,
  steps: RECIPE_STEPS_SELECT,
};

/**
 * Cree une recette communautaire + sa copie personnelle dans une transaction.
 * Gere les tags/ingredients sur les deux recettes et cree l'ActivityLog.
 */
export async function createCommunityRecipe(
  userId: string,
  communityId: string,
  data: CreateCommunityRecipeData
) {
  let pendingTagIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    // 1. Creer la recette personnelle (communityId: null)
    const personalRecipe = await tx.recipe.create({
      data: {
        title: data.title.trim(),
        servings: data.servings,
        prepTime: data.prepTime ?? null,
        cookTime: data.cookTime ?? null,
        restTime: data.restTime ?? null,
        imageUrl: data.imageUrl?.trim() || null,
        creatorId: userId,
        communityId: null,
      },
    });

    // 2. Creer la copie communautaire liee a la recette perso
    const communityRecipe = await tx.recipe.create({
      data: {
        title: data.title.trim(),
        servings: data.servings,
        prepTime: data.prepTime ?? null,
        cookTime: data.cookTime ?? null,
        restTime: data.restTime ?? null,
        imageUrl: data.imageUrl?.trim() || null,
        creatorId: userId,
        communityId,
        originRecipeId: personalRecipe.id,
      },
    });

    // 3. Gerer steps/tags/ingredients sur les DEUX recettes
    await upsertSteps(tx, personalRecipe.id, data.steps);
    await upsertSteps(tx, communityRecipe.id, data.steps);
    // IMPORTANT: traiter la recette communautaire EN PREMIER pour que les tags
    // inconnus deviennent COMMUNITY PENDING (et non GLOBAL APPROVED via le perso)
    if (data.tags.length > 0) {
      pendingTagIds = await upsertTags(tx, communityRecipe.id, data.tags, userId, communityId);
      await upsertTags(tx, personalRecipe.id, data.tags, userId, null);
    }

    if (data.ingredients.length > 0) {
      await upsertIngredients(tx, personalRecipe.id, data.ingredients, userId);
      await upsertIngredients(tx, communityRecipe.id, data.ingredients, userId);
    }

    // 4. Creer ActivityLog
    await tx.activityLog.create({
      data: {
        type: "RECIPE_CREATED",
        userId,
        communityId,
        recipeId: communityRecipe.id,
      },
    });

    // Fetch les deux recettes avec leurs relations
    const [personal, community] = await Promise.all([
      tx.recipe.findUnique({
        where: { id: personalRecipe.id },
        select: COMMUNITY_RECIPE_SELECT,
      }),
      tx.recipe.findUnique({
        where: { id: communityRecipe.id },
        select: COMMUNITY_RECIPE_SELECT,
      }),
    ]);

    return { personal, community };
  });

  return { ...result, pendingTagIds };
}

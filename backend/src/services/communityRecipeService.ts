import prisma from "../util/db";
import { normalizeNames } from "../util/validation";
import { RECIPE_TAGS_SELECT, RECIPE_INGREDIENTS_SELECT } from "../util/prismaSelects";
import { IngredientInput } from "./recipeService";

interface CreateCommunityRecipeData {
  title: string;
  content: string;
  imageUrl?: string | null;
  tags: string[];
  ingredients: IngredientInput[];
}

const COMMUNITY_RECIPE_SELECT = {
  id: true,
  title: true,
  content: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  creatorId: true,
  communityId: true,
  originRecipeId: true,
  tags: RECIPE_TAGS_SELECT,
  ingredients: RECIPE_INGREDIENTS_SELECT,
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
  return prisma.$transaction(async (tx) => {
    // 1. Creer la recette personnelle (communityId: null)
    const personalRecipe = await tx.recipe.create({
      data: {
        title: data.title.trim(),
        content: data.content.trim(),
        imageUrl: data.imageUrl?.trim() || null,
        creatorId: userId,
        communityId: null,
      },
    });

    // 2. Creer la copie communautaire liee a la recette perso
    const communityRecipe = await tx.recipe.create({
      data: {
        title: data.title.trim(),
        content: data.content.trim(),
        imageUrl: data.imageUrl?.trim() || null,
        creatorId: userId,
        communityId,
        originRecipeId: personalRecipe.id,
      },
    });

    // 3. Gerer tags/ingredients sur les DEUX recettes
    if (data.tags.length > 0) {
      const normalizedTags = normalizeNames(data.tags);

      for (const tagName of normalizedTags) {
        let tag = await tx.tag.findFirst({
          where: { name: tagName, communityId: null },
        });
        if (!tag) {
          tag = await tx.tag.create({ data: { name: tagName } });
        }

        await tx.recipeTag.createMany({
          data: [
            { recipeId: personalRecipe.id, tagId: tag.id },
            { recipeId: communityRecipe.id, tagId: tag.id },
          ],
        });
      }
    }

    if (data.ingredients.length > 0) {
      for (let i = 0; i < data.ingredients.length; i++) {
        const ing = data.ingredients[i];
        const ingredientName = ing.name.trim().toLowerCase();
        if (!ingredientName) continue;

        const ingredient = await tx.ingredient.upsert({
          where: { name: ingredientName },
          create: { name: ingredientName },
          update: {},
        });

        await tx.recipeIngredient.createMany({
          data: [
            {
              recipeId: personalRecipe.id,
              ingredientId: ingredient.id,
              quantity: ing.quantity?.trim() || null,
              order: i,
            },
            {
              recipeId: communityRecipe.id,
              ingredientId: ingredient.id,
              quantity: ing.quantity?.trim() || null,
              order: i,
            },
          ],
        });
      }
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
}

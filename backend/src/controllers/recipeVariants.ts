import { RequestHandler } from "express";
import prisma from "../util/db";
import { Prisma } from "@prisma/client";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { RECIPE_TAGS_SELECT } from "../util/prismaSelects";
import { requireRecipeAccess } from "../services/membershipService";
import { formatTags } from "../util/responseFormatters";

interface GetVariantsQuery {
  limit?: string;
  offset?: string;
}

/**
 * GET /api/recipes/:recipeId/variants
 * Liste les variantes d'une recette (isVariant = true, meme communaute)
 * Tri: par MAX(createdAt, updatedAt) DESC
 */
export const getVariants: RequestHandler<
  { recipeId: string },
  unknown,
  unknown,
  GetVariantsQuery
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;
  const { limit, offset } = parsePagination(req.query);

  try {
    assertIsDefine(authenticatedUserId);

    // Recuperer la recette parent
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        deletedAt: null,
      },
      select: {
        id: true,
        communityId: true,
        creatorId: true,
      },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    await requireRecipeAccess(authenticatedUserId, recipe);

    // Construire la clause where pour les variantes
    const whereClause: Prisma.RecipeWhereInput = {
      originRecipeId: recipeId,
      isVariant: true,
      deletedAt: null,
    };

    // Si c'est une recette communautaire, ne retourner que les variantes de la meme communaute
    if (recipe.communityId !== null) {
      whereClause.communityId = recipe.communityId;
    }

    // Recuperer les variantes
    const variants = await prisma.recipe.findMany({
      where: whereClause,
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
        isVariant: true,
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
        tags: RECIPE_TAGS_SELECT,
      },
    });

    // Trier par MAX(createdAt, updatedAt) DESC
    const sortedVariants = variants.sort((a, b) => {
      const maxA = a.updatedAt > a.createdAt ? a.updatedAt : a.createdAt;
      const maxB = b.updatedAt > b.createdAt ? b.updatedAt : b.createdAt;
      return maxB.getTime() - maxA.getTime();
    });

    // Appliquer pagination
    const total = sortedVariants.length;
    const paginatedVariants = sortedVariants.slice(offset, offset + limit);

    const data = paginatedVariants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      servings: variant.servings,
      prepTime: variant.prepTime,
      cookTime: variant.cookTime,
      restTime: variant.restTime,
      imageUrl: variant.imageUrl,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      creatorId: variant.creatorId,
      creator: variant.creator,
      communityId: variant.communityId,
      originRecipeId: variant.originRecipeId,
      isVariant: variant.isVariant,
      tags: formatTags(variant.tags),
    }));

    res.status(200).json({
      data,
      pagination: buildPaginationMeta(total, limit, offset, paginatedVariants.length),
    });
  } catch (error) {
    next(error);
  }
};

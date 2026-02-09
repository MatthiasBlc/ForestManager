import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";

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
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

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

    // Verification d'acces selon le type de recette
    if (recipe.communityId === null) {
      // Recette personnelle : seul le createur peut voir les variantes
      if (recipe.creatorId !== authenticatedUserId) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }
    } else {
      // Recette communautaire : l'utilisateur doit etre membre de la communaute
      const membership = await prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: recipe.communityId,
          deletedAt: null,
        },
      });

      if (!membership) {
        throw createHttpError(403, "COMMUNITY_001: Not a member");
      }
    }

    // Construire la clause where pour les variantes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
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
        content: true,
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
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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
      content: variant.content,
      imageUrl: variant.imageUrl,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      creatorId: variant.creatorId,
      creator: variant.creator,
      communityId: variant.communityId,
      originRecipeId: variant.originRecipeId,
      isVariant: variant.isVariant,
      tags: variant.tags.map((rt) => rt.tag),
    }));

    res.status(200).json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + paginatedVariants.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

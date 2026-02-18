import { RequestHandler } from "express";
import prisma from "../util/db";
import { assertIsDefine } from "../util/assertIsDefine";
import { parsePagination } from "../util/pagination";

interface SearchIngredientsQuery {
  search?: string;
  limit?: string;
}

export const searchIngredients: RequestHandler<unknown, unknown, unknown, SearchIngredientsQuery> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const search = req.query.search?.trim().toLowerCase() || "";
  const { limit } = parsePagination(req.query);

  try {
    assertIsDefine(authenticatedUserId);

    // Retourner APPROVED + PENDING (les PENDING sont utilisables immediatement)
    const ingredients = await prisma.ingredient.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : undefined,
      select: {
        id: true,
        name: true,
        status: true,
        _count: {
          select: {
            recipes: {
              where: {
                recipe: {
                  deletedAt: null,
                  creatorId: authenticatedUserId,
                  communityId: null,
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: limit,
    });

    const data = ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      status: ingredient.status,
      recipeCount: ingredient._count.recipes,
    }));

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ingredients/:id/suggested-unit
 * Retourne l'unite suggeree pour un ingredient
 */
export const getSuggestedUnit: RequestHandler<{ id: string }> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { id } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    const ingredient = await prisma.ingredient.findUnique({
      where: { id },
      select: { id: true, defaultUnitId: true },
    });

    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    // 1. Si defaultUnitId existe (defini par admin) → utiliser
    if (ingredient.defaultUnitId) {
      return res.status(200).json({
        suggestedUnitId: ingredient.defaultUnitId,
        source: "default",
      });
    }

    // 2. Sinon, calculer l'unite la plus utilisee dans les recettes
    const unitCounts = await prisma.recipeIngredient.groupBy({
      by: ["unitId"],
      where: {
        ingredientId: id,
        unitId: { not: null },
      },
      _count: { unitId: true },
      orderBy: { _count: { unitId: "desc" } },
      take: 1,
    });

    if (unitCounts.length > 0 && unitCounts[0].unitId) {
      return res.status(200).json({
        suggestedUnitId: unitCounts[0].unitId,
        source: "popular",
      });
    }

    // 3. Aucune suggestion
    res.status(200).json({
      suggestedUnitId: null,
      source: null,
    });
  } catch (error) {
    next(error);
  }
};

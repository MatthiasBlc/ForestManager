import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { Prisma } from "@prisma/client";
import prisma from "../util/db";
import { MEAL_006 } from "../constants/errorCodes";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { CreateMealIdeaInput, UpdateMealIdeaInput } from "../schemas/mealPlan.schema";
import { formatDeletedRelation } from "../util/responseFormatters";

// Include for queries
const ideaInclude = {
  recipe: {
    select: { id: true, title: true, imageKey: true, deletedAt: true },
  },
  createdBy: {
    select: { id: true, username: true },
  },
};

function formatIdea(idea: Prisma.MealIdeaGetPayload<{ include: typeof ideaInclude }>) {
  return {
    ...idea,
    recipe: formatDeletedRelation(idea.recipe, ["id", "title", "imageKey"]),
    createdBy: idea.createdBy ? { id: idea.createdBy.id, username: idea.createdBy.username } : null,
  };
}

/**
 * GET /api/communities/:communityId/meal-ideas
 * Liste paginee, searchable (memberOf)
 */
export const listIdeas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const { limit, offset } = parsePagination(req.query as { limit?: string; offset?: string });
    const search = req.query.search as string | undefined;

    const where: Prisma.MealIdeaWhereInput = {
      communityId,
      deletedAt: null,
    };

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [ideas, total] = await Promise.all([
      prisma.mealIdea.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: ideaInclude,
      }),
      prisma.mealIdea.count({ where }),
    ]);

    res.json({
      data: ideas.map(formatIdea),
      pagination: buildPaginationMeta(total, limit, offset, ideas.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/meal-ideas
 * Creer une idee (memberOf)
 */
export const createIdea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const userId = req.session.userId!;
    const body = req.body as CreateMealIdeaInput;

    // Validate recipeId if provided - must be in community
    if (body.recipeId) {
      const recipe = await prisma.recipe.findFirst({
        where: { id: body.recipeId, communityId, deletedAt: null },
      });
      if (!recipe) {
        throw createHttpError(404, "MEAL_004: Recipe not found in this community");
      }
    }

    const idea = await prisma.mealIdea.create({
      data: {
        communityId,
        name: body.name,
        comment: body.comment,
        recipeId: body.recipeId,
        createdById: userId,
      },
      include: ideaInclude,
    });

    res.status(201).json(formatIdea(idea));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/communities/:communityId/meal-ideas/:ideaId
 * Modifier (createur ou MODERATOR)
 */
export const updateIdea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, ideaId } = req.params;
    const userId = req.session.userId!;
    const body = req.body as UpdateMealIdeaInput;

    const idea = await prisma.mealIdea.findUnique({ where: { id: ideaId } });

    if (!idea || idea.communityId !== communityId || idea.deletedAt !== null) {
      throw createHttpError(404, MEAL_006);
    }

    // Permission: createur ou MODERATOR
    const userCommunity = req.userCommunity!;
    if (idea.createdById !== userId && userCommunity.role !== "MODERATOR") {
      throw createHttpError(403, "COMMUNITY_002: Permission insufficient");
    }

    // Validate recipeId if provided - must be in community
    if (body.recipeId) {
      const recipe = await prisma.recipe.findFirst({
        where: { id: body.recipeId, communityId, deletedAt: null },
      });
      if (!recipe) {
        throw createHttpError(404, "MEAL_004: Recipe not found in this community");
      }
    }

    const updated = await prisma.mealIdea.update({
      where: { id: ideaId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.comment !== undefined && { comment: body.comment }),
        ...(body.recipeId !== undefined && { recipeId: body.recipeId }),
      },
      include: ideaInclude,
    });

    res.json(formatIdea(updated));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/communities/:communityId/meal-ideas/:ideaId
 * Soft delete (createur ou MODERATOR)
 */
export const deleteIdea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, ideaId } = req.params;
    const userId = req.session.userId!;

    const idea = await prisma.mealIdea.findUnique({ where: { id: ideaId } });

    if (!idea || idea.communityId !== communityId || idea.deletedAt !== null) {
      throw createHttpError(404, MEAL_006);
    }

    // Permission: createur ou MODERATOR
    const userCommunity = req.userCommunity!;
    if (idea.createdById !== userId && userCommunity.role !== "MODERATOR") {
      throw createHttpError(403, "COMMUNITY_002: Permission insufficient");
    }

    await prisma.mealIdea.update({
      where: { id: ideaId },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

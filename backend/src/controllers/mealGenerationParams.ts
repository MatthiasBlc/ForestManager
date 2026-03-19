import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import { MEAL_GEN_001, MEAL_GEN_005 } from "../constants/errorCodes";
import {
  CreateMealGenerationParamsInput,
  UpdateMealGenerationParamsInput,
} from "../schemas/mealPlan.schema";

// Include pour les requetes detail
const paramsDetailInclude = {
  exclusions: {
    select: { id: true, day: true, mealTime: true },
    orderBy: [{ day: "asc" as const }, { mealTime: "asc" as const }],
  },
  rules: {
    select: {
      id: true,
      tagId: true,
      recipeId: true,
      weight: true,
      mealTimeConstraint: true,
      frequencyMin: true,
      frequencyMax: true,
      frequencyPer: true,
      tagCooldownDays: true,
      tag: { select: { id: true, name: true } },
      recipe: { select: { id: true, title: true, deletedAt: true } },
    },
  },
  slotPins: {
    select: {
      id: true,
      day: true,
      mealTime: true,
      tagId: true,
      tag: { select: { id: true, name: true } },
    },
    orderBy: [{ day: "asc" as const }, { mealTime: "asc" as const }],
  },
};

// Helper: format rules (ajouter isDeleted sur recipe)
function formatRule(rule: any) {
  return {
    ...rule,
    recipe: rule.recipe
      ? {
          id: rule.recipe.id,
          title: rule.recipe.title,
          isDeleted: rule.recipe.deletedAt !== null,
        }
      : null,
  };
}

// Helper: format params detail
function formatParamsDetail(params: any) {
  return {
    ...params,
    rules: params.rules.map(formatRule),
  };
}

/**
 * GET /api/communities/:communityId/meal-generation-params
 * Liste des jeux de params (memberOf)
 */
export const listParams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;

    const paramsList = await prisma.mealGenerationParams.findMany({
      where: { communityId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        cooldownDays: true,
        useIdeas: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ data: paramsList });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/meal-generation-params
 * Creer un jeu (MODERATOR)
 */
export const createParams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const body = req.body as CreateMealGenerationParamsInput;

    // Si isDefault, desactiver l'ancien default
    if (body.isDefault) {
      await prisma.mealGenerationParams.updateMany({
        where: { communityId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const params = await prisma.mealGenerationParams.create({
      data: {
        communityId,
        name: body.name,
        description: body.description,
        cooldownDays: body.cooldownDays,
        useIdeas: body.useIdeas,
        isDefault: body.isDefault,
      },
      include: paramsDetailInclude,
    });

    res.status(201).json(formatParamsDetail(params));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/communities/:communityId/meal-generation-params/:paramsId
 * Detail avec exclusions + regles + pins (memberOf)
 */
export const getParamsDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId } = req.params;

    const params = await prisma.mealGenerationParams.findUnique({
      where: { id: paramsId },
      include: paramsDetailInclude,
    });

    if (!params || params.communityId !== communityId || params.deletedAt !== null) {
      throw createHttpError(404, MEAL_GEN_001);
    }

    res.json(formatParamsDetail(params));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/communities/:communityId/meal-generation-params/:paramsId
 * Modifier (MODERATOR)
 */
export const updateParams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId } = req.params;
    const body = req.body as UpdateMealGenerationParamsInput;

    const params = await prisma.mealGenerationParams.findUnique({
      where: { id: paramsId },
    });

    if (!params || params.communityId !== communityId || params.deletedAt !== null) {
      throw createHttpError(404, MEAL_GEN_001);
    }

    // Si on set isDefault a true, desactiver l'ancien default
    if (body.isDefault === true && !params.isDefault) {
      await prisma.mealGenerationParams.updateMany({
        where: { communityId, isDefault: true, deletedAt: null, id: { not: paramsId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.mealGenerationParams.update({
      where: { id: paramsId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.cooldownDays !== undefined && { cooldownDays: body.cooldownDays }),
        ...(body.useIdeas !== undefined && { useIdeas: body.useIdeas }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      },
      include: paramsDetailInclude,
    });

    res.json(formatParamsDetail(updated));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/communities/:communityId/meal-generation-params/:paramsId
 * Soft delete (MODERATOR)
 */
export const deleteParams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId } = req.params;

    const params = await prisma.mealGenerationParams.findUnique({
      where: { id: paramsId },
    });

    if (!params || params.communityId !== communityId || params.deletedAt !== null) {
      throw createHttpError(404, MEAL_GEN_001);
    }

    await prisma.mealGenerationParams.update({
      where: { id: paramsId },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

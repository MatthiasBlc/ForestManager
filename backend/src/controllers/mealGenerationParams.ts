import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import {
  MEAL_GEN_001,
  MEAL_GEN_003,
  MEAL_GEN_004,
  MEAL_GEN_005,
  MEAL_GEN_006,
  MEAL_GEN_009,
  MEAL_GEN_010,
  MEAL_GEN_011,
  MEAL_GEN_012,
} from "../constants/errorCodes";
import {
  CreateMealGenerationParamsInput,
  UpdateMealGenerationParamsInput,
  SetExclusionsInput,
  CreateRuleInput,
  UpdateRuleInput,
  SetPinsInput,
} from "../schemas/mealGeneration.schema";
import { formatDeletedRelation } from "../util/responseFormatters";

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

function formatRule(rule: any) {
  return {
    ...rule,
    recipe: formatDeletedRelation(rule.recipe, ["id", "title"]),
  };
}

// Helper: format params detail
function formatParamsDetail(params: any) {
  return {
    ...params,
    rules: params.rules.map(formatRule),
  };
}

// Helper: find params and validate ownership
async function findParams(paramsId: string, communityId: string) {
  const params = await prisma.mealGenerationParams.findUnique({
    where: { id: paramsId },
  });
  if (!params || params.communityId !== communityId || params.deletedAt !== null) {
    throw createHttpError(404, MEAL_GEN_001);
  }
  return params;
}

// Helper: validate rule business logic
function validateRuleLogic(data: {
  tagId?: string | null;
  recipeId?: string | null;
  weight?: number;
  frequencyMin?: number | null;
  frequencyMax?: number | null;
  tagCooldownDays?: number | null;
}) {
  // tagId XOR recipeId
  const hasTag = !!data.tagId;
  const hasRecipe = !!data.recipeId;
  if ((!hasTag && !hasRecipe) || (hasTag && hasRecipe)) {
    throw createHttpError(400, MEAL_GEN_003);
  }

  // weight 0.0-2.0
  if (data.weight !== undefined && (data.weight < 0 || data.weight > 2)) {
    throw createHttpError(400, MEAL_GEN_004);
  }

  // frequency constraints only for tag rules
  if (hasRecipe && (data.frequencyMin != null || data.frequencyMax != null)) {
    throw createHttpError(400, MEAL_GEN_009);
  }

  // tagCooldownDays only for tag rules
  if (hasRecipe && data.tagCooldownDays != null) {
    throw createHttpError(400, MEAL_GEN_011);
  }

  // frequencyMin <= frequencyMax
  if (
    data.frequencyMin != null &&
    data.frequencyMax != null &&
    data.frequencyMin > data.frequencyMax
  ) {
    throw createHttpError(400, MEAL_GEN_010);
  }
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
    await findParams(paramsId, communityId);

    const params = await prisma.mealGenerationParams.findUnique({
      where: { id: paramsId },
      include: paramsDetailInclude,
    });

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

    const params = await findParams(paramsId, communityId);

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

    await findParams(paramsId, communityId);

    await prisma.mealGenerationParams.update({
      where: { id: paramsId },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// =============================================
// Exclusions
// =============================================

/**
 * PUT /api/communities/:communityId/meal-generation-params/:paramsId/exclusions
 * Set complet des exclusions (MODERATOR)
 */
export const setExclusions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId } = req.params;
    const body = req.body as SetExclusionsInput;

    await findParams(paramsId, communityId);

    // Transaction : supprimer toutes les exclusions puis recreer
    await prisma.$transaction([
      prisma.mealSlotExclusion.deleteMany({ where: { paramsId } }),
      ...body.exclusions.map((exc) =>
        prisma.mealSlotExclusion.create({
          data: { paramsId, day: exc.day, mealTime: exc.mealTime },
        })
      ),
    ]);

    // Retourner les exclusions a jour
    const exclusions = await prisma.mealSlotExclusion.findMany({
      where: { paramsId },
      select: { id: true, day: true, mealTime: true },
      orderBy: [{ day: "asc" }, { mealTime: "asc" }],
    });

    res.json({ data: exclusions });
  } catch (error) {
    next(error);
  }
};

// =============================================
// Rules
// =============================================

/**
 * GET /api/communities/:communityId/meal-generation-params/:paramsId/rules
 * Liste des regles (memberOf)
 */
export const listRules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId } = req.params;
    await findParams(paramsId, communityId);

    const rules = await prisma.mealGenerationRule.findMany({
      where: { paramsId },
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
    });

    res.json({ data: rules.map(formatRule) });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/meal-generation-params/:paramsId/rules
 * Ajouter une regle (MODERATOR)
 */
export const createRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId } = req.params;
    const body = req.body as CreateRuleInput;

    await findParams(paramsId, communityId);
    validateRuleLogic(body);

    // Validate tag/recipe exists in community
    if (body.tagId) {
      const tag = await prisma.tag.findUnique({ where: { id: body.tagId } });
      if (!tag || (tag.communityId !== null && tag.communityId !== communityId)) {
        throw createHttpError(404, "TAG_001: Tag not found");
      }
    }
    if (body.recipeId) {
      const recipe = await prisma.recipe.findFirst({
        where: { id: body.recipeId, communityId, deletedAt: null },
      });
      if (!recipe) {
        throw createHttpError(404, "MEAL_004: Recipe not found in this community");
      }
    }

    const rule = await prisma.mealGenerationRule.create({
      data: {
        paramsId,
        tagId: body.tagId || null,
        recipeId: body.recipeId || null,
        weight: body.weight,
        mealTimeConstraint: body.mealTimeConstraint || null,
        frequencyMin: body.frequencyMin ?? null,
        frequencyMax: body.frequencyMax ?? null,
        frequencyPer: body.frequencyPer || null,
        tagCooldownDays: body.tagCooldownDays ?? null,
      },
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
    });

    res.status(201).json(formatRule(rule));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/communities/:communityId/meal-generation-params/:paramsId/rules/:ruleId
 * Modifier une regle (MODERATOR)
 */
export const updateRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId, ruleId } = req.params;
    const body = req.body as UpdateRuleInput;

    await findParams(paramsId, communityId);

    const rule = await prisma.mealGenerationRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.paramsId !== paramsId) {
      throw createHttpError(404, MEAL_GEN_006);
    }

    // Validate business logic with merged data
    const merged = {
      tagId: rule.tagId,
      recipeId: rule.recipeId,
      weight: body.weight !== undefined ? body.weight : rule.weight,
      frequencyMin: body.frequencyMin !== undefined ? body.frequencyMin : rule.frequencyMin,
      frequencyMax: body.frequencyMax !== undefined ? body.frequencyMax : rule.frequencyMax,
      tagCooldownDays:
        body.tagCooldownDays !== undefined ? body.tagCooldownDays : rule.tagCooldownDays,
    };

    // Check frequency constraints on recipe rules
    if (merged.recipeId && (merged.frequencyMin != null || merged.frequencyMax != null)) {
      throw createHttpError(400, MEAL_GEN_009);
    }
    if (merged.recipeId && merged.tagCooldownDays != null) {
      throw createHttpError(400, MEAL_GEN_011);
    }
    if (
      merged.frequencyMin != null &&
      merged.frequencyMax != null &&
      merged.frequencyMin > merged.frequencyMax
    ) {
      throw createHttpError(400, MEAL_GEN_010);
    }
    if (body.weight !== undefined && (body.weight < 0 || body.weight > 2)) {
      throw createHttpError(400, MEAL_GEN_004);
    }

    const updated = await prisma.mealGenerationRule.update({
      where: { id: ruleId },
      data: {
        ...(body.weight !== undefined && { weight: body.weight }),
        ...(body.mealTimeConstraint !== undefined && {
          mealTimeConstraint: body.mealTimeConstraint,
        }),
        ...(body.frequencyMin !== undefined && { frequencyMin: body.frequencyMin }),
        ...(body.frequencyMax !== undefined && { frequencyMax: body.frequencyMax }),
        ...(body.frequencyPer !== undefined && { frequencyPer: body.frequencyPer }),
        ...(body.tagCooldownDays !== undefined && { tagCooldownDays: body.tagCooldownDays }),
      },
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
    });

    res.json(formatRule(updated));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/communities/:communityId/meal-generation-params/:paramsId/rules/:ruleId
 * Supprimer une regle (MODERATOR, hard delete)
 */
export const deleteRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId, ruleId } = req.params;

    await findParams(paramsId, communityId);

    const rule = await prisma.mealGenerationRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.paramsId !== paramsId) {
      throw createHttpError(404, MEAL_GEN_006);
    }

    await prisma.mealGenerationRule.delete({ where: { id: ruleId } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// =============================================
// Pins
// =============================================

/**
 * PUT /api/communities/:communityId/meal-generation-params/:paramsId/pins
 * Set complet des pins (MODERATOR)
 */
export const setPins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, paramsId } = req.params;
    const body = req.body as SetPinsInput;

    await findParams(paramsId, communityId);

    // Validate: pins cannot overlap with exclusions
    const exclusions = await prisma.mealSlotExclusion.findMany({
      where: { paramsId },
      select: { day: true, mealTime: true },
    });
    const excludedSet = new Set(exclusions.map((e) => `${e.day}:${e.mealTime}`));

    for (const pin of body.pins) {
      if (excludedSet.has(`${pin.day}:${pin.mealTime}`)) {
        throw createHttpError(400, MEAL_GEN_012);
      }
    }

    // Validate tags exist and belong to community (or are global)
    const tagIds = [...new Set(body.pins.map((p) => p.tagId))];
    if (tagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true, communityId: true },
      });
      const foundIds = new Set(tags.map((t) => t.id));
      for (const tagId of tagIds) {
        if (!foundIds.has(tagId)) {
          throw createHttpError(404, "TAG_001: Tag not found");
        }
      }
      for (const tag of tags) {
        if (tag.communityId !== null && tag.communityId !== communityId) {
          throw createHttpError(404, "TAG_001: Tag not found");
        }
      }
    }

    // Transaction : supprimer tous les pins puis recreer
    await prisma.$transaction([
      prisma.mealSlotPin.deleteMany({ where: { paramsId } }),
      ...body.pins.map((pin) =>
        prisma.mealSlotPin.create({
          data: { paramsId, day: pin.day, mealTime: pin.mealTime, tagId: pin.tagId },
        })
      ),
    ]);

    // Retourner les pins a jour
    const pins = await prisma.mealSlotPin.findMany({
      where: { paramsId },
      select: {
        id: true,
        day: true,
        mealTime: true,
        tagId: true,
        tag: { select: { id: true, name: true } },
      },
      orderBy: [{ day: "asc" }, { mealTime: "asc" }],
    });

    res.json({ data: pins });
  } catch (error) {
    next(error);
  }
};

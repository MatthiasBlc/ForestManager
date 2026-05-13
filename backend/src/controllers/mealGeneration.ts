import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { Prisma } from "@prisma/client";
import prisma from "../util/db";
import {
  MEAL_003,
  MEAL_GEN_002,
  MEAL_GEN_007,
  MEAL_GEN_008,
  MEAL_GEN_013,
} from "../constants/errorCodes";
import { GenerateInput, ReplaceSlotInput } from "../schemas/mealGeneration.schema";
import { generate, GenerationInput, SlotInfo } from "../services/mealGeneration";
import {
  loadGenerationParams,
  buildPool,
  buildPreviousSlots,
  slotsToSlotInfo,
} from "../services/mealGenerationService";
import { formatDeletedRelation } from "../util/responseFormatters";

// Slot include for queries (partage avec mealPlan controller)
const slotInclude = {
  recipe: {
    select: { id: true, title: true, imageKey: true, deletedAt: true },
  },
  updatedBy: {
    select: { id: true, username: true },
  },
};

function formatSlot(slot: Prisma.MealSlotGetPayload<{ include: typeof slotInclude }>) {
  return {
    ...slot,
    recipe: formatDeletedRelation(slot.recipe, ["id", "title", "imageKey"]),
  };
}

/**
 * POST /api/communities/:communityId/meal-plan/generate
 * Generer le planning (MODERATOR)
 */
export const generatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const body = req.body as GenerateInput;

    // 1. Verifier que le plan ACTIVE existe
    const plan = await prisma.mealPlan.findFirst({
      where: { communityId, status: "ACTIVE" },
      include: {
        slots: {
          orderBy: [{ date: "asc" }, { mealTime: "asc" }],
          include: slotInclude,
        },
      },
    });

    if (!plan) {
      throw createHttpError(404, MEAL_GEN_002);
    }

    // 2. Charger les params + exclusions + rules + pins
    const params = await loadGenerationParams(body.paramsId, communityId);

    // 3. Construire les inputs
    const [pool, previousSlots] = await Promise.all([
      buildPool(communityId, params.useIdeas),
      buildPreviousSlots(communityId, plan.id),
    ]);

    const input: GenerationInput = {
      params,
      exclusions: params.exclusions,
      rules: params.rules,
      pins: params.slotPins,
      slots: slotsToSlotInfo(plan.slots),
      pool,
      previousSlots,
      fillEmptyOnly: body.fillEmptyOnly,
    };

    // 4. Generer
    const result = generate(input);

    // 5. Appliquer les assignments en DB
    if (result.assignments.length > 0) {
      await prisma.$transaction(
        result.assignments.map((a) =>
          prisma.mealSlot.update({
            where: { id: a.slotId },
            data: {
              type: a.type,
              recipeId: a.recipeId,
              freeText: a.freeText ?? null,
              comment: a.comment ?? null,
              ...(a.type !== "EMPTY" ? { disabled: false } : {}),
            },
          })
        )
      );
    }

    // 6. Recharger le plan complet
    const updatedPlan = await prisma.mealPlan.findUnique({
      where: { id: plan.id },
      include: {
        slots: {
          orderBy: [{ date: "asc" }, { mealTime: "asc" }],
          include: slotInclude,
        },
      },
    });

    res.json({
      plan: { ...updatedPlan!, slots: updatedPlan!.slots.map(formatSlot) },
      report: result.report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/meal-plan/slots/:slotId/replace
 * Re-generer un seul slot (MODERATOR)
 */
export const replaceSlot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, slotId } = req.params;
    const body = req.body as ReplaceSlotInput;

    // 1. Trouver le slot
    const slot = await prisma.mealSlot.findUnique({
      where: { id: slotId },
      include: { plan: true },
    });

    if (!slot || slot.plan.communityId !== communityId) {
      throw createHttpError(404, MEAL_003);
    }

    if (slot.plan.status !== "ACTIVE") {
      throw createHttpError(400, MEAL_GEN_013);
    }

    if (slot.locked) {
      throw createHttpError(400, MEAL_GEN_008);
    }

    // 2. Charger les params
    const params = await loadGenerationParams(body.paramsId, communityId);

    // 3. Verifier que le slot n'est pas exclu dans ce jeu de params
    const slotDayOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
      new Date(slot.date).getUTCDay()
    ];
    const isExcluded = params.exclusions.some(
      (e) => e.day === slotDayOfWeek && e.mealTime === slot.mealTime
    );
    if (isExcluded) {
      throw createHttpError(400, MEAL_GEN_007);
    }

    // 4. Charger le plan complet pour contexte (cooldowns, frequences)
    const plan = await prisma.mealPlan.findUnique({
      where: { id: slot.planId },
      include: {
        slots: {
          orderBy: [{ date: "asc" }, { mealTime: "asc" }],
          include: {
            recipe: { select: { tags: { select: { tagId: true } } } },
          },
        },
      },
    });

    // 5. Construire pool en excluant la recette actuelle
    const [poolFull, previousSlots] = await Promise.all([
      buildPool(communityId, params.useIdeas),
      buildPreviousSlots(communityId, plan!.id),
    ]);

    const pool = slot.recipeId ? poolFull.filter((e) => e.recipeId !== slot.recipeId) : poolFull;

    // 6. Marquer tous les slots sauf le cible comme locked pour que generate() ne les touche pas
    const slotInfos: SlotInfo[] = plan!.slots.map((s) => ({
      id: s.id,
      date: s.date,
      mealTime: s.mealTime,
      type: s.type,
      disabled: s.disabled,
      locked: s.id !== slotId,
      recipeId: s.recipeId,
    }));

    const input: GenerationInput = {
      params,
      exclusions: params.exclusions,
      rules: params.rules,
      pins: params.slotPins,
      slots: slotInfos,
      pool,
      previousSlots,
      fillEmptyOnly: false,
    };

    // 7. Generer
    const result = generate(input);

    // 8. Trouver l'assignment pour notre slot
    const assignment = result.assignments.find((a) => a.slotId === slotId);

    if (assignment) {
      await prisma.mealSlot.update({
        where: { id: slotId },
        data: {
          type: assignment.type,
          recipeId: assignment.recipeId,
          freeText: assignment.freeText ?? null,
          comment: assignment.comment ?? null,
          ...(assignment.type !== "EMPTY" ? { disabled: false } : {}),
        },
      });
    }

    // 9. Retourner le slot mis a jour
    const updatedSlot = await prisma.mealSlot.findUnique({
      where: { id: slotId },
      include: slotInclude,
    });

    res.json({
      slot: formatSlot(updatedSlot!),
      report: result.report,
    });
  } catch (error) {
    next(error);
  }
};

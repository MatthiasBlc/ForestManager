import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import {
  MEAL_001,
  MEAL_003,
  MEAL_004,
  MEAL_007,
  MEAL_008,
  MEAL_009,
  MEAL_010,
  MEAL_011,
  MEAL_012,
  MEAL_013,
  MEAL_GEN_001,
  MEAL_GEN_002,
  MEAL_GEN_007,
  MEAL_GEN_008,
  MEAL_GEN_013,
} from "../constants/errorCodes";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import {
  CreateMealPlanInput,
  UpdateMealPlanInput,
  UpdateSlotInput,
  SwapSlotsInput,
  GenerateInput,
  ReplaceSlotInput,
} from "../schemas/mealPlan.schema";
import {
  generate,
  PoolEntry,
  SlotInfo,
  PreviousSlotInfo,
  GenerationInput,
} from "../services/mealGeneration";

// Helper: format slot recipe with isDeleted flag
function formatSlot(slot: any) {
  return {
    ...slot,
    recipe: slot.recipe
      ? {
          id: slot.recipe.id,
          title: slot.recipe.title,
          imageKey: slot.recipe.imageKey,
          isDeleted: slot.recipe.deletedAt !== null,
        }
      : null,
  };
}

// Slot include for queries
const slotInclude = {
  recipe: {
    select: { id: true, title: true, imageKey: true, deletedAt: true },
  },
  updatedBy: {
    select: { id: true, username: true },
  },
};

/**
 * GET /api/communities/:communityId/meal-plan
 * Retourne le plan ACTIVE avec ses slots, ou { plan: null } si aucun plan
 */
export const getActivePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;

    const [plan, defaultParamsCount] = await Promise.all([
      prisma.mealPlan.findFirst({
        where: { communityId, status: "ACTIVE" },
        include: {
          slots: {
            orderBy: [{ date: "asc" }, { mealTime: "asc" }],
            include: slotInclude,
          },
        },
      }),
      prisma.mealGenerationParams.count({
        where: { communityId, isDefault: true, deletedAt: null },
      }),
    ]);

    const hasDefaultGenerationParams = defaultParamsCount > 0;

    if (!plan) {
      return res.json({ plan: null, hasDefaultGenerationParams });
    }

    res.json({
      plan: { ...plan, slots: plan.slots.map(formatSlot) },
      hasDefaultGenerationParams,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/meal-plan
 * Creer un plan + slots (MODERATOR)
 */
export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const body = req.body as CreateMealPlanInput;

    const startDate = new Date(body.startDate + "T00:00:00.000Z");
    const endDate = new Date(body.endDate + "T00:00:00.000Z");

    // Validation: startDate <= endDate
    if (startDate > endDate) {
      throw createHttpError(400, MEAL_009);
    }

    // Validation: max 31 jours
    const diffDays =
      Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 31) {
      throw createHttpError(400, MEAL_008);
    }

    // Generer toutes les dates du planning
    const dates: Date[] = [];
    for (let d = 0; d < diffDays; d++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + d);
      dates.push(date);
    }

    // Validation: pas de chevauchement de slots (date, mealTime) avec un autre plan
    const existingSlots = await prisma.mealSlot.findMany({
      where: {
        plan: { communityId },
        date: { in: dates },
      },
      select: { date: true, mealTime: true },
    });

    // Exclure les slots du plan ACTIVE actuel (il sera archive)
    const activePlan = await prisma.mealPlan.findFirst({
      where: { communityId, status: "ACTIVE" },
      select: { id: true },
    });

    const conflictSlots = activePlan
      ? await prisma.mealSlot.findMany({
          where: {
            plan: { communityId },
            planId: { not: activePlan.id },
            date: { in: dates },
          },
          select: { date: true, mealTime: true },
        })
      : existingSlots;

    if (conflictSlots.length > 0) {
      throw createHttpError(409, MEAL_010);
    }

    // Recuperer le pattern disabled du plan precedent (si copyDisabledFromPrevious)
    // On cherche d'abord le plan ACTIVE (qui sera archive), puis les archives
    let previousDisabledPattern: Array<{ dayOfWeek: number; mealTime: string }> = [];
    if (body.copyDisabledFromPrevious) {
      const previousPlan = activePlan
        ? await prisma.mealPlan.findUnique({
            where: { id: activePlan.id },
            include: {
              slots: {
                where: { disabled: true },
                select: { date: true, mealTime: true },
              },
            },
          })
        : await prisma.mealPlan.findFirst({
            where: { communityId, status: "ARCHIVED" },
            orderBy: { startDate: "desc" },
            include: {
              slots: {
                where: { disabled: true },
                select: { date: true, mealTime: true },
              },
            },
          });
      if (previousPlan) {
        previousDisabledPattern = previousPlan.slots.map((s) => ({
          dayOfWeek: new Date(s.date).getUTCDay(),
          mealTime: s.mealTime,
        }));
      }
    }

    // Build disabled set
    const disabledSet = new Set<string>();

    // From explicit disabledSlots
    if (body.disabledSlots) {
      for (const ds of body.disabledSlots) {
        disabledSet.add(`${ds.date}_${ds.mealTime}`);
      }
    }

    // From previous pattern (day of week mapping)
    if (previousDisabledPattern.length > 0) {
      for (const date of dates) {
        const dayOfWeek = date.getUTCDay();
        for (const pattern of previousDisabledPattern) {
          if (pattern.dayOfWeek === dayOfWeek) {
            const dateStr = date.toISOString().split("T")[0];
            disabledSet.add(`${dateStr}_${pattern.mealTime}`);
          }
        }
      }
    }

    // Transaction: archive existing + create new plan + slots
    const plan = await prisma.$transaction(async (tx) => {
      // Archive existing active plan
      if (activePlan) {
        await tx.mealPlan.update({
          where: { id: activePlan.id },
          data: { status: "ARCHIVED" },
        });
      }

      // Create new plan
      const newPlan = await tx.mealPlan.create({
        data: {
          communityId,
          startDate,
          endDate,
          defaultServings: body.defaultServings,
          status: "ACTIVE",
        },
      });

      // Create slots
      const mealTimes = ["LUNCH", "DINNER"] as const;
      const slotsData = [];
      for (const date of dates) {
        const dateStr = date.toISOString().split("T")[0];
        for (const mt of mealTimes) {
          slotsData.push({
            planId: newPlan.id,
            date,
            mealTime: mt,
            servings: body.defaultServings,
            disabled: disabledSet.has(`${dateStr}_${mt}`),
          });
        }
      }

      await tx.mealSlot.createMany({ data: slotsData });

      // Return full plan with slots
      return tx.mealPlan.findUnique({
        where: { id: newPlan.id },
        include: {
          slots: {
            orderBy: [{ date: "asc" }, { mealTime: "asc" }],
            include: slotInclude,
          },
        },
      });
    });

    res.status(201).json({
      plan: { ...plan!, slots: plan!.slots.map(formatSlot) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/communities/:communityId/meal-plan
 * Supprimer le plan ACTIVE + cascade slots (MODERATOR)
 */
export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;

    const plan = await prisma.mealPlan.findFirst({
      where: { communityId, status: "ACTIVE" },
    });

    if (!plan) {
      throw createHttpError(404, MEAL_001);
    }

    // Hard delete (slots cascade)
    await prisma.mealPlan.delete({ where: { id: plan.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/communities/:communityId/meal-plan
 * Update defaultServings / editableByMembers (MODERATOR)
 */
export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const body = req.body as UpdateMealPlanInput;

    const plan = await prisma.mealPlan.findFirst({
      where: { communityId, status: "ACTIVE" },
    });

    if (!plan) {
      throw createHttpError(404, MEAL_001);
    }

    const updated = await prisma.mealPlan.update({
      where: { id: plan.id },
      data: {
        ...(body.defaultServings !== undefined && { defaultServings: body.defaultServings }),
        ...(body.editableByMembers !== undefined && { editableByMembers: body.editableByMembers }),
      },
      include: {
        slots: {
          orderBy: [{ date: "asc" }, { mealTime: "asc" }],
          include: slotInclude,
        },
      },
    });

    res.json({ plan: { ...updated, slots: updated.slots.map(formatSlot) } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/communities/:communityId/meal-plan/slots/:slotId
 * Update un slot (permission dynamique: MODERATOR ou membre si editableByMembers)
 */
export const updateSlot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, slotId } = req.params;
    const userId = req.session.userId!;
    const body = req.body as UpdateSlotInput;

    // Trouver le slot avec son plan
    const slot = await prisma.mealSlot.findUnique({
      where: { id: slotId },
      include: { plan: true },
    });

    if (!slot || slot.plan.communityId !== communityId) {
      throw createHttpError(404, MEAL_003);
    }

    if (slot.plan.status !== "ACTIVE") {
      throw createHttpError(400, MEAL_011);
    }

    // Permission dynamique
    const userCommunity = req.userCommunity!;
    if (userCommunity.role !== "MODERATOR" && !slot.plan.editableByMembers) {
      throw createHttpError(403, "COMMUNITY_002: Permission insufficient");
    }

    // Build update data
    const updateData: any = { updatedById: userId };

    if (body.type !== undefined) {
      updateData.type = body.type;

      if (body.type === "RECIPE") {
        if (!body.recipeId) {
          throw createHttpError(400, "VALIDATION_001: recipeId required for type RECIPE");
        }
        // Verifier que la recette existe dans la communaute
        const recipe = await prisma.recipe.findFirst({
          where: { id: body.recipeId, communityId, deletedAt: null },
        });
        if (!recipe) {
          throw createHttpError(404, MEAL_004);
        }
        updateData.recipeId = body.recipeId;
        updateData.freeText = null;
        // Auto-enable si disabled
        if (slot.disabled) {
          updateData.disabled = false;
        }
      } else if (body.type === "FREE_TEXT") {
        if (!body.freeText) {
          throw createHttpError(400, "VALIDATION_001: freeText required for type FREE_TEXT");
        }
        updateData.freeText = body.freeText;
        updateData.recipeId = null;
        // Auto-enable si disabled
        if (slot.disabled) {
          updateData.disabled = false;
        }
      } else if (body.type === "EMPTY") {
        updateData.recipeId = null;
        updateData.freeText = null;
        updateData.comment = null;
      }
    }

    if (body.comment !== undefined && body.type !== "EMPTY") {
      updateData.comment = body.comment;
    }

    if (body.freeText !== undefined && body.type === undefined) {
      // freeText sans changer le type — on ne met pas a jour si type n'est pas fourni
    }

    if (body.servings !== undefined) {
      updateData.servings = body.servings;
    }

    if (body.disabled !== undefined) {
      updateData.disabled = body.disabled;
    }

    if (body.locked !== undefined) {
      updateData.locked = body.locked;
    }

    const updated = await prisma.mealSlot.update({
      where: { id: slotId },
      data: updateData,
      include: slotInclude,
    });

    res.json(formatSlot(updated));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/meal-plan/slots/swap
 * Swap contenu de 2 slots (permission dynamique)
 */
export const swapSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const userId = req.session.userId!;
    const { slotIdA, slotIdB } = req.body as SwapSlotsInput;

    if (slotIdA === slotIdB) {
      throw createHttpError(400, MEAL_007);
    }

    // Trouver les deux slots
    const [slotA, slotB] = await Promise.all([
      prisma.mealSlot.findUnique({ where: { id: slotIdA }, include: { plan: true } }),
      prisma.mealSlot.findUnique({ where: { id: slotIdB }, include: { plan: true } }),
    ]);

    if (!slotA || slotA.plan.communityId !== communityId) {
      throw createHttpError(404, MEAL_003);
    }
    if (!slotB || slotB.plan.communityId !== communityId) {
      throw createHttpError(404, MEAL_003);
    }
    if (slotA.planId !== slotB.planId) {
      throw createHttpError(400, MEAL_003);
    }
    if (slotA.plan.status !== "ACTIVE") {
      throw createHttpError(400, MEAL_011);
    }

    // Permission dynamique
    const userCommunity = req.userCommunity!;
    if (userCommunity.role !== "MODERATOR" && !slotA.plan.editableByMembers) {
      throw createHttpError(403, "COMMUNITY_002: Permission insufficient");
    }

    // Refuser si l'un des slots est disabled
    if (slotA.disabled || slotB.disabled) {
      throw createHttpError(400, MEAL_013);
    }

    // Swap content: type, recipeId, freeText, comment, servings
    await prisma.$transaction([
      prisma.mealSlot.update({
        where: { id: slotIdA },
        data: {
          type: slotB.type,
          recipeId: slotB.recipeId,
          freeText: slotB.freeText,
          comment: slotB.comment,
          servings: slotB.servings,
          updatedById: userId,
        },
      }),
      prisma.mealSlot.update({
        where: { id: slotIdB },
        data: {
          type: slotA.type,
          recipeId: slotA.recipeId,
          freeText: slotA.freeText,
          comment: slotA.comment,
          servings: slotA.servings,
          updatedById: userId,
        },
      }),
    ]);

    // Return updated slots
    const [updatedA, updatedB] = await Promise.all([
      prisma.mealSlot.findUnique({ where: { id: slotIdA }, include: slotInclude }),
      prisma.mealSlot.findUnique({ where: { id: slotIdB }, include: slotInclude }),
    ]);

    res.json({ slotA: formatSlot(updatedA), slotB: formatSlot(updatedB) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/communities/:communityId/meal-plan/archives
 * Liste paginee des plans ARCHIVED (memberOf)
 */
export const getArchives = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;
    const { limit, offset } = parsePagination(req.query as any);

    const [archives, total] = await Promise.all([
      prisma.mealPlan.findMany({
        where: { communityId, status: "ARCHIVED" },
        orderBy: { startDate: "desc" },
        skip: offset,
        take: limit,
        include: {
          _count: { select: { slots: true } },
          slots: {
            where: { type: { not: "EMPTY" } },
            select: { id: true },
          },
        },
      }),
      prisma.mealPlan.count({ where: { communityId, status: "ARCHIVED" } }),
    ]);

    const data = archives.map((a) => ({
      id: a.id,
      startDate: a.startDate,
      endDate: a.endDate,
      defaultServings: a.defaultServings,
      createdAt: a.createdAt,
      totalSlots: a._count.slots,
      filledSlots: a.slots.length,
    }));

    res.json({
      data,
      pagination: buildPaginationMeta(total, limit, offset, data.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/communities/:communityId/meal-plan/archives/:planId
 * Detail d'un plan archive + slots (memberOf)
 */
export const getArchiveDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, planId } = req.params;

    const plan = await prisma.mealPlan.findUnique({
      where: { id: planId },
      include: {
        slots: {
          orderBy: [{ date: "asc" }, { mealTime: "asc" }],
          include: slotInclude,
        },
      },
    });

    if (!plan || plan.communityId !== communityId || plan.status !== "ARCHIVED") {
      throw createHttpError(404, MEAL_012);
    }

    res.json({ plan: { ...plan, slots: plan.slots.map(formatSlot) } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/communities/:communityId/meal-plan/archives/:planId
 * Supprimer une archive (MODERATOR, hard delete)
 */
export const deleteArchive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId, planId } = req.params;

    const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });

    if (!plan || plan.communityId !== communityId || plan.status !== "ARCHIVED") {
      throw createHttpError(404, MEAL_012);
    }

    await prisma.mealPlan.delete({ where: { id: planId } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// =============================================
// Helpers: build generation inputs from DB
// =============================================

async function loadGenerationParams(paramsId: string, communityId: string) {
  const params = await prisma.mealGenerationParams.findUnique({
    where: { id: paramsId },
    include: {
      exclusions: true,
      rules: { include: { tag: { select: { id: true, name: true } } } },
      slotPins: true,
    },
  });

  if (!params || params.communityId !== communityId || params.deletedAt) {
    throw createHttpError(404, MEAL_GEN_001);
  }

  return params;
}

async function buildPool(communityId: string, useIdeas: boolean): Promise<PoolEntry[]> {
  // Toutes les recettes de la communaute (non deleted)
  const recipes = await prisma.recipe.findMany({
    where: { communityId, deletedAt: null },
    include: { tags: { select: { tagId: true } } },
  });

  const pool: PoolEntry[] = recipes.map((r) => ({
    id: r.id,
    type: "RECIPE" as const,
    recipeId: r.id,
    tagIds: r.tags.map((t) => t.tagId),
  }));

  if (useIdeas) {
    const ideas = await prisma.mealIdea.findMany({
      where: { communityId, deletedAt: null },
      include: {
        recipe: {
          select: { id: true, tags: { select: { tagId: true } } },
        },
      },
    });

    for (const idea of ideas) {
      pool.push({
        id: idea.id,
        type: "IDEA" as const,
        recipeId: idea.recipe?.id ?? null,
        tagIds: idea.recipe?.tags.map((t) => t.tagId) ?? [],
        freeText: idea.name,
        comment: idea.comment,
      });
    }
  }

  return pool;
}

async function buildPreviousSlots(
  communityId: string,
  planId: string
): Promise<PreviousSlotInfo[]> {
  // Dernier plan archive pour cross-planning cooldown
  const lastArchive = await prisma.mealPlan.findFirst({
    where: { communityId, status: "ARCHIVED", id: { not: planId } },
    orderBy: { startDate: "desc" },
    include: {
      slots: {
        where: { type: { not: "EMPTY" }, recipeId: { not: null } },
        include: { recipe: { select: { tags: { select: { tagId: true } } } } },
      },
    },
  });

  if (!lastArchive) return [];

  return lastArchive.slots.map((s) => ({
    date: s.date,
    recipeId: s.recipeId,
    tagIds: s.recipe?.tags.map((t) => t.tagId) ?? [],
  }));
}

function slotsToSlotInfo(slots: any[]): SlotInfo[] {
  return slots.map((s) => ({
    id: s.id,
    date: s.date,
    mealTime: s.mealTime,
    type: s.type,
    disabled: s.disabled,
    locked: s.locked,
    recipeId: s.recipeId,
  }));
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
              // Re-enable disabled slots if they get content
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

    // Exclure la recette actuelle du pool
    const pool = slot.recipeId ? poolFull.filter((e) => e.recipeId !== slot.recipeId) : poolFull;

    // 6. Construire les SlotInfo avec les recettes actuelles pour cooldown/frequency context
    // Marquer tous les slots sauf le cible comme locked pour que generate() ne les touche pas
    const slotInfos: SlotInfo[] = plan!.slots.map((s) => ({
      id: s.id,
      date: s.date,
      mealTime: s.mealTime,
      type: s.type,
      disabled: s.disabled,
      locked: s.id !== slotId, // Tous locked sauf le cible
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
          // Auto-enable si disabled
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
      slot: formatSlot(updatedSlot),
      report: result.report,
    });
  } catch (error) {
    next(error);
  }
};

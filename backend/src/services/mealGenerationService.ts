/**
 * Meal Generation Service
 * Couche DB pour alimenter l'algorithme de generation (mealGeneration.ts)
 */

import createHttpError from "http-errors";
import prisma from "../util/db";
import { MEAL_GEN_001 } from "../constants/errorCodes";
import { PoolEntry, SlotInfo, PreviousSlotInfo } from "./mealGeneration";

/**
 * Charger un jeu de params avec ses relations (exclusions, rules, pins).
 * Leve 404 si introuvable, mauvaise communaute, ou soft-deleted.
 */
export async function loadGenerationParams(paramsId: string, communityId: string) {
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

/**
 * Construire le pool de recettes (+ idees si useIdeas) pour la generation.
 */
export async function buildPool(communityId: string, useIdeas: boolean): Promise<PoolEntry[]> {
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

/**
 * Charger les slots du dernier plan archive pour cross-planning cooldown.
 */
export async function buildPreviousSlots(
  communityId: string,
  currentPlanId: string
): Promise<PreviousSlotInfo[]> {
  const lastArchive = await prisma.mealPlan.findFirst({
    where: { communityId, status: "ARCHIVED", id: { not: currentPlanId } },
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

/**
 * Transformer les slots Prisma en SlotInfo pour l'algorithme.
 */
export function slotsToSlotInfo(slots: any[]): SlotInfo[] {
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

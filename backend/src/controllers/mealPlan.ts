import { Request, Response, NextFunction } from "express";
import prisma from "../util/db";

/**
 * GET /api/communities/:communityId/meal-plan
 * Retourne le plan ACTIVE avec ses slots, ou { plan: null } si aucun plan
 */
export const getActivePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { communityId } = req.params;

    const plan = await prisma.mealPlan.findFirst({
      where: {
        communityId,
        status: "ACTIVE",
      },
      include: {
        slots: {
          orderBy: [{ date: "asc" }, { mealTime: "asc" }],
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageKey: true,
                deletedAt: true,
              },
            },
            updatedBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!plan) {
      return res.json({ plan: null, hasDefaultGenerationParams: false });
    }

    // Formatter les slots pour ajouter isDeleted sur les recettes
    const formattedSlots = plan.slots.map((slot) => ({
      ...slot,
      recipe: slot.recipe
        ? {
            id: slot.recipe.id,
            title: slot.recipe.title,
            imageKey: slot.recipe.imageKey,
            isDeleted: slot.recipe.deletedAt !== null,
          }
        : null,
    }));

    res.json({
      plan: {
        ...plan,
        slots: formattedSlots,
      },
      hasDefaultGenerationParams: false,
    });
  } catch (error) {
    next(error);
  }
};

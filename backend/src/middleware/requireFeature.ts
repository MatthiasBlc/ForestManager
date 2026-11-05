import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import { MEAL_005 } from "../constants/errorCodes";

/**
 * Middleware generique pour verifier qu'une feature est activee pour la communaute.
 * Doit etre utilise apres memberOf (req.params.communityId doit exister).
 */
export const requireFeature = (featureCode: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const communityId = req.params.communityId;

    if (!communityId) {
      return next(createHttpError(400, "Community ID required"));
    }

    try {
      const communityFeature = await prisma.communityFeature.findFirst({
        where: {
          communityId,
          revokedAt: null,
          feature: {
            code: featureCode,
          },
        },
      });

      if (!communityFeature) {
        return next(createHttpError(403, MEAL_005));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

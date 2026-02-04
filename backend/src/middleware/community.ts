import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";

/**
 * Middleware pour verifier que l'utilisateur est membre de la communaute.
 * Attend communityId dans req.params.
 * Ajoute req.userCommunity avec les infos du membership.
 */
export const memberOf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.session.userId;
  const communityId = req.params.communityId;

  if (!userId) {
    return next(createHttpError(401, "AUTH_001: Not authenticated"));
  }

  if (!communityId) {
    return next(createHttpError(400, "Community ID required"));
  }

  try {
    const userCommunity = await prisma.userCommunity.findFirst({
      where: {
        userId,
        communityId,
        deletedAt: null,
        community: {
          deletedAt: null,
        },
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            description: true,
            visibility: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!userCommunity) {
      // Check if community exists
      const community = await prisma.community.findUnique({
        where: { id: communityId },
      });

      if (!community || community.deletedAt) {
        return next(createHttpError(404, "Community not found"));
      }

      return next(createHttpError(403, "COMMUNITY_001: Not a member"));
    }

    // Attach membership info to request for use in controllers
    req.userCommunity = userCommunity;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware pour verifier que l'utilisateur a le role requis (ou superieur).
 * Doit etre utilise apres memberOf.
 * MODERATOR est le role admin de communaute.
 */
export const requireCommunityRole = (requiredRole: "MEMBER" | "MODERATOR") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userCommunity = req.userCommunity;

    if (!userCommunity) {
      return next(
        createHttpError(500, "requireCommunityRole must be used after memberOf")
      );
    }

    // Role hierarchy: MODERATOR > MEMBER
    const roleHierarchy: Record<string, number> = {
      MEMBER: 1,
      MODERATOR: 2,
    };

    const userRoleLevel = roleHierarchy[userCommunity.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return next(
        createHttpError(403, "COMMUNITY_002: Permission insufficient")
      );
    }

    next();
  };
};

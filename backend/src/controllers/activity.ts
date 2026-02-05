import { RequestHandler } from "express";
import prisma from "../util/db";
import { assertIsDefine } from "../util/assertIsDefine";

// =====================================
// Types
// =====================================

interface GetActivityQuery {
  limit?: string;
  offset?: string;
}

// =====================================
// GET /api/communities/:communityId/activity
// Get activity feed for a community (member only)
// =====================================
export const getCommunityActivity: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const { limit: limitStr, offset: offsetStr } = req.query as GetActivityQuery;

  const limit = Math.min(Math.max(parseInt(limitStr || "20", 10), 1), 100);
  const offset = Math.max(parseInt(offsetStr || "0", 10), 0);

  try {
    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          communityId,
        },
        select: {
          id: true,
          type: true,
          metadata: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          recipe: {
            select: {
              id: true,
              title: true,
              deletedAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.activityLog.count({
        where: {
          communityId,
        },
      }),
    ]);

    const data = activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
      user: activity.user,
      recipe: activity.recipe
        ? {
            id: activity.recipe.id,
            title: activity.recipe.title,
            isDeleted: activity.recipe.deletedAt !== null,
          }
        : null,
    }));

    res.status(200).json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + activities.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// GET /api/users/me/activity
// Get personal activity feed
// =====================================
export const getMyActivity: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  const { limit: limitStr, offset: offsetStr } = req.query as GetActivityQuery;

  const limit = Math.min(Math.max(parseInt(limitStr || "20", 10), 1), 100);
  const offset = Math.max(parseInt(offsetStr || "0", 10), 0);

  try {
    assertIsDefine(userId);

    // Get user's recipe IDs to find activity on their recipes
    const userRecipes = await prisma.recipe.findMany({
      where: {
        creatorId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const userRecipeIds = userRecipes.map((r) => r.id);

    // Activity relevant to the user:
    // 1. User's own actions (userId = me)
    // 2. Proposals/variants on user's recipes (recipeId in userRecipeIds AND type in proposal/variant types)
    const whereClause = {
      OR: [
        // User's own actions
        { userId },
        // Activity on user's recipes (proposals, variants)
        {
          recipeId: { in: userRecipeIds },
          type: {
            in: [
              "VARIANT_PROPOSED" as const,
              "VARIANT_CREATED" as const,
              "PROPOSAL_ACCEPTED" as const,
              "PROPOSAL_REJECTED" as const,
            ],
          },
          // Exclude user's own activity on their recipes (already included above)
          NOT: { userId },
        },
      ],
    };

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        select: {
          id: true,
          type: true,
          metadata: true,
          createdAt: true,
          communityId: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          community: {
            select: {
              id: true,
              name: true,
              deletedAt: true,
            },
          },
          recipe: {
            select: {
              id: true,
              title: true,
              deletedAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.activityLog.count({
        where: whereClause,
      }),
    ]);

    const data = activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
      user: activity.user,
      community: activity.community
        ? {
            id: activity.community.id,
            name: activity.community.name,
            isDeleted: activity.community.deletedAt !== null,
          }
        : null,
      recipe: activity.recipe
        ? {
            id: activity.recipe.id,
            title: activity.recipe.title,
            isDeleted: activity.recipe.deletedAt !== null,
          }
        : null,
    }));

    res.status(200).json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + activities.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

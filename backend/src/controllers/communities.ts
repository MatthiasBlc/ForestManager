import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

// Validation constants
const VALIDATION = {
  NAME_MIN: 3,
  NAME_MAX: 100,
  DESCRIPTION_MAX: 1000,
};

export const getCommunities: RequestHandler = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    // Get user's memberships with community details
    const memberships = await prisma.userCommunity.findMany({
      where: {
        userId: authenticatedUserId,
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
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                members: {
                  where: { deletedAt: null },
                },
                recipes: {
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
      },
    });

    // Format response according to API spec
    const data = memberships.map((membership) => ({
      id: membership.community.id,
      name: membership.community.name,
      description: membership.community.description,
      role: membership.role,
      membersCount: membership.community._count.members,
      recipesCount: membership.community._count.recipes,
      joinedAt: membership.joinedAt,
    }));

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

/**
 * Get community details.
 * Requires memberOf middleware to have set req.userCommunity.
 */
export const getCommunity: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const userCommunity = req.userCommunity;

  try {
    // userCommunity is set by memberOf middleware
    if (!userCommunity) {
      throw createHttpError(500, "Middleware memberOf required");
    }

    const community = await prisma.community.findUnique({
      where: {
        id: communityId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: {
              where: { deletedAt: null },
            },
            recipes: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!community) {
      throw createHttpError(404, "Community not found");
    }

    // Format response according to API spec
    res.status(200).json({
      id: community.id,
      name: community.name,
      description: community.description,
      visibility: community.visibility,
      createdAt: community.createdAt,
      membersCount: community._count.members,
      recipesCount: community._count.recipes,
      currentUserRole: userCommunity.role,
    });
  } catch (error) {
    next(error);
  }
}

interface CreateCommunityBody {
  name?: string;
  description?: string;
}

export const createCommunity: RequestHandler<
  unknown,
  unknown,
  CreateCommunityBody,
  unknown
> = async (req, res, next) => {
  const { name, description } = req.body;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    // Validation
    if (!name) {
      throw createHttpError(400, "Community must have a name");
    }

    if (name.length < VALIDATION.NAME_MIN) {
      throw createHttpError(
        400,
        `Name must be at least ${VALIDATION.NAME_MIN} characters`
      );
    }

    if (name.length > VALIDATION.NAME_MAX) {
      throw createHttpError(
        400,
        `Name must be at most ${VALIDATION.NAME_MAX} characters`
      );
    }

    if (description && description.length > VALIDATION.DESCRIPTION_MAX) {
      throw createHttpError(
        400,
        `Description must be at most ${VALIDATION.DESCRIPTION_MAX} characters`
      );
    }

    // Get default features
    const defaultFeatures = await prisma.feature.findMany({
      where: { isDefault: true },
    });

    const newCommunity = await prisma.community.create({
      data: {
        name,
        description: description || null,
        members: {
          create: {
            userId: authenticatedUserId,
            role: "MODERATOR",
          },
        },
        // Auto-assign default features
        features: {
          create: defaultFeatures.map((f) => ({
            featureId: f.id,
            // grantedById: null = automatic attribution
          })),
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        createdAt: true,
      },
    });

    res.status(201).json(newCommunity);
  } catch (error) {
    next(error);
  }
};


interface UpdateCommunityParams {
  communityId: string;
}

interface UpdateCommunityBody {
  name?: string;
  description?: string;
}

/**
 * Update community details.
 * Requires memberOf and requireCommunityRole("MODERATOR") middlewares.
 */
export const updateCommunity: RequestHandler<
  UpdateCommunityParams,
  unknown,
  UpdateCommunityBody,
  unknown
> = async (req, res, next) => {
  const communityId = req.params.communityId;
  const { name, description } = req.body;
  const userCommunity = req.userCommunity;

  try {
    // userCommunity is set by memberOf middleware
    // Role check is done by requireCommunityRole middleware
    if (!userCommunity) {
      throw createHttpError(500, "Middleware memberOf required");
    }

    // At least one field must be provided
    if (name === undefined && description === undefined) {
      throw createHttpError(400, "No fields to update");
    }

    // Validate name if provided
    if (name !== undefined) {
      if (name.length < VALIDATION.NAME_MIN) {
        throw createHttpError(
          400,
          `Name must be at least ${VALIDATION.NAME_MIN} characters`
        );
      }

      if (name.length > VALIDATION.NAME_MAX) {
        throw createHttpError(
          400,
          `Name must be at most ${VALIDATION.NAME_MAX} characters`
        );
      }
    }

    // Validate description if provided
    if (description !== undefined && description.length > VALIDATION.DESCRIPTION_MAX) {
      throw createHttpError(
        400,
        `Description must be at most ${VALIDATION.DESCRIPTION_MAX} characters`
      );
    }

    // Build update data
    const updateData: { name?: string; description?: string | null } = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (description !== undefined) {
      updateData.description = description || null;
    }

    const updatedCommunity = await prisma.community.update({
      where: {
        id: communityId,
        deletedAt: null,
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: {
              where: { deletedAt: null },
            },
            recipes: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    res.status(200).json({
      id: updatedCommunity.id,
      name: updatedCommunity.name,
      description: updatedCommunity.description,
      visibility: updatedCommunity.visibility,
      createdAt: updatedCommunity.createdAt,
      updatedAt: updatedCommunity.updatedAt,
      membersCount: updatedCommunity._count.members,
      recipesCount: updatedCommunity._count.recipes,
      currentUserRole: userCommunity.role,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return next(createHttpError(404, "Community not found"));
      }
    }
    next(error);
  }
};

import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { buildImageUrl } from "../config/storage";
import { CreateCommunityInput, UpdateCommunityInput } from "../schemas/community.schema";

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
            imageKey: true,
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
      imageUrl: membership.community.imageKey ? buildImageUrl(membership.community.imageKey) : null,
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
        imageKey: true,
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
      imageUrl: community.imageKey ? buildImageUrl(community.imageKey) : null,
      visibility: community.visibility,
      createdAt: community.createdAt,
      membersCount: community._count.members,
      recipesCount: community._count.recipes,
      currentUserRole: userCommunity.role,
    });
  } catch (error) {
    next(error);
  }
};

export const createCommunity: RequestHandler<unknown, unknown, CreateCommunityInput, unknown> =
  async (req, res, next) => {
    const { name, description } = req.body;
    const authenticatedUserId = req.session.userId;

    try {
      assertIsDefine(authenticatedUserId);

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

interface UpdateCommunityParams extends Record<string, string> {
  communityId: string;
}

/**
 * Update community details.
 * Requires memberOf and requireCommunityRole("MODERATOR") middlewares.
 */
export const updateCommunity: RequestHandler<
  UpdateCommunityParams,
  unknown,
  UpdateCommunityInput,
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
        imageKey: true,
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
      imageUrl: updatedCommunity.imageKey ? buildImageUrl(updatedCommunity.imageKey) : null,
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

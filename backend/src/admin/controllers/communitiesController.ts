import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";

/**
 * GET /api/admin/communities
 * Liste toutes les communautes (incluant soft-deleted)
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { search, includeDeleted } = req.query;

    const communities = await prisma.community.findMany({
      where: {
        ...(search
          ? { name: { contains: String(search), mode: "insensitive" } }
          : {}),
        ...(includeDeleted !== "true" ? { deletedAt: null } : {}),
      },
      include: {
        _count: {
          select: {
            members: true,
            recipes: true,
          },
        },
        features: {
          where: { revokedAt: null },
          include: { feature: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      communities: communities.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        visibility: c.visibility,
        memberCount: c._count.members,
        recipeCount: c._count.recipes,
        features: c.features.map((cf) => cf.feature.code),
        createdAt: c.createdAt,
        deletedAt: c.deletedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/communities/:id
 * Detail d'une communaute avec membres et stats
 */
export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
        features: {
          include: {
            feature: true,
            grantedBy: { select: { id: true, username: true } },
          },
        },
        _count: {
          select: { recipes: true, invites: true },
        },
      },
    });

    if (!community) {
      throw createHttpError(404, "ADMIN_COM_001: Community not found");
    }

    res.status(200).json({
      community: {
        id: community.id,
        name: community.name,
        description: community.description,
        visibility: community.visibility,
        createdAt: community.createdAt,
        updatedAt: community.updatedAt,
        deletedAt: community.deletedAt,
        recipeCount: community._count.recipes,
        pendingInvites: community._count.invites,
        members: community.members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          email: m.user.email,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        features: community.features.map((cf) => ({
          id: cf.feature.id,
          code: cf.feature.code,
          name: cf.feature.name,
          grantedAt: cf.grantedAt,
          grantedBy: cf.grantedBy?.username || "system",
          revokedAt: cf.revokedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/communities/:id
 * Modifie une communaute (nom, description)
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const community = await prisma.community.findUnique({ where: { id } });
    if (!community) {
      throw createHttpError(404, "ADMIN_COM_001: Community not found");
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, "ADMIN_COM_002: Name is required");
    }

    const oldName = community.name;
    const updated = await prisma.community.update({
      where: { id },
      data: { name: name.trim() },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "COMMUNITY_RENAMED",
        targetType: "Community",
        targetId: id,
        metadata: { oldName, newName: name.trim() },
      },
    });

    res.status(200).json({ community: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/communities/:id
 * Soft delete une communaute
 */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const community = await prisma.community.findUnique({ where: { id } });
    if (!community) {
      throw createHttpError(404, "ADMIN_COM_001: Community not found");
    }

    if (community.deletedAt) {
      throw createHttpError(400, "ADMIN_COM_003: Community already deleted");
    }

    await prisma.community.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "COMMUNITY_DELETED",
        targetType: "Community",
        targetId: id,
        metadata: { name: community.name },
      },
    });

    res.status(200).json({ message: "Community deleted" });
  } catch (error) {
    next(error);
  }
};

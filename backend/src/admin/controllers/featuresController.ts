import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";

/**
 * GET /api/admin/features
 * Liste toutes les features avec count de communautes
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const features = await prisma.feature.findMany({
      include: {
        _count: {
          select: { communities: true },
        },
      },
      orderBy: { code: "asc" },
    });

    res.status(200).json({
      features: features.map((f) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        description: f.description,
        isDefault: f.isDefault,
        communityCount: f._count.communities,
        createdAt: f.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/features
 * Cree une nouvelle feature
 */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { code, name, description, isDefault } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      throw createHttpError(400, "ADMIN_FEAT_001: Code is required");
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, "ADMIN_FEAT_002: Name is required");
    }

    const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "_");

    const existing = await prisma.feature.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw createHttpError(409, "ADMIN_FEAT_003: Feature code already exists");
    }

    const feature = await prisma.feature.create({
      data: {
        code: normalizedCode,
        name: name.trim(),
        description: description?.trim() || null,
        isDefault: Boolean(isDefault),
      },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "FEATURE_CREATED",
        targetType: "Feature",
        targetId: feature.id,
        metadata: { code: normalizedCode, name: name.trim() },
      },
    });

    res.status(201).json({ feature });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/features/:id
 * Modifie une feature (name, description, isDefault)
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isDefault } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const feature = await prisma.feature.findUnique({ where: { id } });
    if (!feature) {
      throw createHttpError(404, "ADMIN_FEAT_004: Feature not found");
    }

    const updateData: { name?: string; description?: string | null; isDefault?: boolean } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw createHttpError(400, "ADMIN_FEAT_002: Name is required");
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (isDefault !== undefined) {
      updateData.isDefault = Boolean(isDefault);
    }

    const updated = await prisma.feature.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "FEATURE_UPDATED",
        targetType: "Feature",
        targetId: id,
        metadata: { code: feature.code, changes: updateData },
      },
    });

    res.status(200).json({ feature: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/communities/:communityId/features/:featureId
 * Attribue une feature a une communaute
 */
export const grant: RequestHandler = async (req, res, next) => {
  try {
    const { communityId, featureId } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const [community, feature] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId } }),
      prisma.feature.findUnique({ where: { id: featureId } }),
    ]);

    if (!community) {
      throw createHttpError(404, "ADMIN_COM_001: Community not found");
    }
    if (!feature) {
      throw createHttpError(404, "ADMIN_FEAT_004: Feature not found");
    }

    // Verifier si deja attribue (et non revoke)
    const existing = await prisma.communityFeature.findUnique({
      where: { communityId_featureId: { communityId, featureId } },
    });

    if (existing && !existing.revokedAt) {
      throw createHttpError(409, "ADMIN_FEAT_005: Feature already granted");
    }

    if (existing && existing.revokedAt) {
      // Reactiver la feature
      await prisma.communityFeature.update({
        where: { id: existing.id },
        data: { revokedAt: null, grantedAt: new Date(), grantedById: adminId },
      });
    } else {
      await prisma.communityFeature.create({
        data: { communityId, featureId, grantedById: adminId },
      });
    }

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "FEATURE_GRANTED",
        targetType: "Community",
        targetId: communityId,
        metadata: { featureCode: feature.code, communityName: community.name },
      },
    });

    res.status(200).json({
      message: `Feature "${feature.code}" granted to "${community.name}"`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/communities/:communityId/features/:featureId
 * Revoque une feature d'une communaute (soft revoke)
 */
export const revoke: RequestHandler = async (req, res, next) => {
  try {
    const { communityId, featureId } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const [community, feature] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId } }),
      prisma.feature.findUnique({ where: { id: featureId } }),
    ]);

    if (!community) {
      throw createHttpError(404, "ADMIN_COM_001: Community not found");
    }
    if (!feature) {
      throw createHttpError(404, "ADMIN_FEAT_004: Feature not found");
    }

    const existing = await prisma.communityFeature.findUnique({
      where: { communityId_featureId: { communityId, featureId } },
    });

    if (!existing || existing.revokedAt) {
      throw createHttpError(404, "ADMIN_FEAT_006: Feature not granted to this community");
    }

    await prisma.communityFeature.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "FEATURE_REVOKED",
        targetType: "Community",
        targetId: communityId,
        metadata: { featureCode: feature.code, communityName: community.name },
      },
    });

    res.status(200).json({
      message: `Feature "${feature.code}" revoked from "${community.name}"`,
    });
  } catch (error) {
    next(error);
  }
};

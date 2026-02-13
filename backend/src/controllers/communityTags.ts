import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import { assertIsDefine } from "../util/assertIsDefine";
import { parsePagination } from "../util/pagination";

/**
 * GET /api/communities/:communityId/tags
 * Liste les tags de la communaute (APPROVED + PENDING)
 * Accessible aux moderateurs uniquement
 */
export const getCommunityTags: RequestHandler = async (req, res, next) => {
  const { communityId } = req.params;
  const { search, status } = req.query as { search?: string; status?: string };
  const { limit, offset } = parsePagination(req.query as Record<string, string>);

  try {
    const where: Record<string, unknown> = {
      communityId,
      scope: "COMMUNITY",
    };

    if (search) {
      where.name = { contains: String(search), mode: "insensitive" };
    }

    if (status === "APPROVED" || status === "PENDING") {
      where.status = status;
    }

    const [tags, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        include: {
          _count: { select: { recipes: true } },
          createdBy: { select: { id: true, username: true } },
        },
        orderBy: { name: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.tag.count({ where }),
    ]);

    const data = tags.map((t) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      status: t.status,
      communityId: t.communityId,
      createdBy: t.createdBy,
      recipeCount: t._count.recipes,
      createdAt: t.createdAt,
    }));

    res.status(200).json({ data, total });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/tags
 * Cree un tag communaute (APPROVED directement, par moderateur)
 */
export const createCommunityTag: RequestHandler = async (req, res, next) => {
  const { communityId } = req.params;
  const { name } = req.body;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, "TAG_001: Tag name is required");
    }

    const normalized = name.trim().toLowerCase();

    if (normalized.length < 2 || normalized.length > 50) {
      throw createHttpError(400, "TAG_001: Tag name must be between 2 and 50 characters");
    }

    // Verifier qu'aucun tag GLOBAL n'a ce nom
    const existingGlobal = await prisma.tag.findFirst({
      where: { name: normalized, scope: "GLOBAL", communityId: null },
    });
    if (existingGlobal) {
      throw createHttpError(409, "TAG_002: A global tag with this name already exists");
    }

    // Verifier qu'aucun tag COMMUNITY n'a ce nom dans cette communaute
    const existingCommunity = await prisma.tag.findFirst({
      where: { name: normalized, communityId },
    });
    if (existingCommunity) {
      throw createHttpError(409, "TAG_002: A tag with this name already exists in this community");
    }

    // Verifier limite 100 tags par communaute
    const count = await prisma.tag.count({
      where: { communityId, scope: "COMMUNITY" },
    });
    if (count >= 100) {
      throw createHttpError(400, "TAG_003: Community tag limit reached (100)");
    }

    const tag = await prisma.tag.create({
      data: {
        name: normalized,
        scope: "COMMUNITY",
        status: "APPROVED",
        communityId,
        createdById: userId,
      },
    });

    // ActivityLog
    await prisma.activityLog.create({
      data: {
        type: "TAG_CREATED",
        userId,
        communityId,
        metadata: { tagId: tag.id, tagName: normalized },
      },
    });

    res.status(201).json({
      id: tag.id,
      name: tag.name,
      scope: tag.scope,
      status: tag.status,
      communityId: tag.communityId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/communities/:communityId/tags/:tagId
 * Renomme un tag communaute
 */
export const updateCommunityTag: RequestHandler = async (req, res, next) => {
  const { communityId, tagId } = req.params;
  const { name } = req.body;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);
    assertIsDefine(tagId);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, "TAG_001: Tag name is required");
    }

    const normalized = name.trim().toLowerCase();

    if (normalized.length < 2 || normalized.length > 50) {
      throw createHttpError(400, "TAG_001: Tag name must be between 2 and 50 characters");
    }

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw createHttpError(404, "TAG_001: Tag not found");
    }

    // Verifier que le tag appartient a cette communaute
    if (tag.communityId !== communityId || tag.scope !== "COMMUNITY") {
      throw createHttpError(403, "TAG_005: Cannot modify a tag that does not belong to this community");
    }

    if (normalized !== tag.name) {
      // Verifier unicite GLOBAL
      const existingGlobal = await prisma.tag.findFirst({
        where: { name: normalized, scope: "GLOBAL", communityId: null },
      });
      if (existingGlobal) {
        throw createHttpError(409, "TAG_002: A global tag with this name already exists");
      }

      // Verifier unicite dans la communaute
      const existingCommunity = await prisma.tag.findFirst({
        where: { name: normalized, communityId, id: { not: tagId } },
      });
      if (existingCommunity) {
        throw createHttpError(409, "TAG_002: A tag with this name already exists in this community");
      }
    }

    const oldName = tag.name;
    const updated = await prisma.tag.update({
      where: { id: tagId },
      data: { name: normalized },
    });

    await prisma.activityLog.create({
      data: {
        type: "TAG_UPDATED",
        userId,
        communityId,
        metadata: { tagId, oldName, newName: normalized },
      },
    });

    res.status(200).json({
      id: updated.id,
      name: updated.name,
      scope: updated.scope,
      status: updated.status,
      communityId: updated.communityId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/communities/:communityId/tags/:tagId
 * Supprime un tag communaute (hard delete, RecipeTag cascade)
 */
export const deleteCommunityTag: RequestHandler = async (req, res, next) => {
  const { communityId, tagId } = req.params;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);
    assertIsDefine(tagId);

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw createHttpError(404, "TAG_001: Tag not found");
    }

    if (tag.communityId !== communityId || tag.scope !== "COMMUNITY") {
      throw createHttpError(403, "TAG_005: Cannot modify a tag that does not belong to this community");
    }

    await prisma.tag.delete({ where: { id: tagId } });

    await prisma.activityLog.create({
      data: {
        type: "TAG_DELETED",
        userId,
        communityId,
        metadata: { tagId, tagName: tag.name },
      },
    });

    res.status(200).json({ message: "Tag deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/tags/:tagId/approve
 * Valide un tag PENDING → APPROVED
 */
export const approveCommunityTag: RequestHandler = async (req, res, next) => {
  const { communityId, tagId } = req.params;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);
    assertIsDefine(tagId);

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw createHttpError(404, "TAG_001: Tag not found");
    }

    if (tag.communityId !== communityId || tag.scope !== "COMMUNITY") {
      throw createHttpError(403, "TAG_005: Cannot modify a tag that does not belong to this community");
    }

    if (tag.status !== "PENDING") {
      throw createHttpError(400, "TAG_004: Tag is not pending");
    }

    const updated = await prisma.tag.update({
      where: { id: tagId },
      data: { status: "APPROVED" },
    });

    await prisma.activityLog.create({
      data: {
        type: "TAG_APPROVED",
        userId,
        communityId,
        metadata: { tagId, tagName: tag.name },
      },
    });

    res.status(200).json({
      id: updated.id,
      name: updated.name,
      scope: updated.scope,
      status: updated.status,
      communityId: updated.communityId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/tags/:tagId/reject
 * Rejette un tag PENDING → hard delete tag + cascade RecipeTags
 */
export const rejectCommunityTag: RequestHandler = async (req, res, next) => {
  const { communityId, tagId } = req.params;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);
    assertIsDefine(tagId);

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw createHttpError(404, "TAG_001: Tag not found");
    }

    if (tag.communityId !== communityId || tag.scope !== "COMMUNITY") {
      throw createHttpError(403, "TAG_005: Cannot modify a tag that does not belong to this community");
    }

    if (tag.status !== "PENDING") {
      throw createHttpError(400, "TAG_004: Tag is not pending");
    }

    // Hard delete (cascade supprime les RecipeTag)
    await prisma.tag.delete({ where: { id: tagId } });

    await prisma.activityLog.create({
      data: {
        type: "TAG_REJECTED",
        userId,
        communityId,
        metadata: { tagId, tagName: tag.name, createdById: tag.createdById },
      },
    });

    res.status(200).json({ message: "Tag rejected and removed" });
  } catch (error) {
    next(error);
  }
};

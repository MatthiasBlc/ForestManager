import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../../util/pagination";
import { validateTagName } from "../../util/validation";

/**
 * GET /api/admin/tags
 * Liste tous les tags avec count de recettes
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { search, scope } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, string>, 100);

    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: String(search), mode: "insensitive" };
    }

    if (scope === "GLOBAL") {
      where.scope = "GLOBAL";
    } else if (scope === "COMMUNITY") {
      where.scope = "COMMUNITY";
    }

    const [tags, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        include: {
          _count: { select: { recipes: true } },
          community: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.tag.count({ where }),
    ]);

    res.status(200).json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        scope: t.scope,
        status: t.status,
        communityId: t.communityId,
        community: t.community,
        recipeCount: t._count.recipes,
      })),
      pagination: buildPaginationMeta(total, limit, offset, tags.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/tags
 * Cree un nouveau tag
 */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { name } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const normalized = validateTagName(name, "ADMIN_TAG_001");

    const existing = await prisma.tag.findFirst({
      where: { name: normalized, communityId: null },
    });

    if (existing) {
      throw createHttpError(409, "ADMIN_TAG_002: Tag already exists");
    }

    const tag = await prisma.tag.create({
      data: { name: normalized },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "TAG_CREATED",
        targetType: "Tag",
        targetId: tag.id,
        metadata: { name: normalized },
      },
    });

    res.status(201).json({ tag });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/tags/:id
 * Renomme un tag
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const normalized = validateTagName(name, "ADMIN_TAG_001");

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw createHttpError(404, "ADMIN_TAG_003: Tag not found");
    }

    if (normalized !== tag.name) {
      // Verifier unicite dans le meme scope
      const existing = await prisma.tag.findFirst({
        where: { name: normalized, communityId: tag.communityId, id: { not: tag.id } },
      });
      if (existing) {
        throw createHttpError(409, "ADMIN_TAG_002: Tag already exists");
      }
      // Si c'est un tag global, verifier aussi qu'aucun tag communaute n'a ce nom
      // (pas necessaire car la contrainte unique est [name, communityId])
    }

    const oldName = tag.name;
    const updated = await prisma.tag.update({
      where: { id },
      data: { name: normalized },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "TAG_UPDATED",
        targetType: "Tag",
        targetId: id,
        metadata: { oldName, newName: normalized },
      },
    });

    res.status(200).json({ tag: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/tags/:id
 * Supprime un tag (hard delete, les RecipeTag sont cascade)
 */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw createHttpError(404, "ADMIN_TAG_003: Tag not found");
    }

    await prisma.tag.delete({ where: { id } });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "TAG_DELETED",
        targetType: "Tag",
        targetId: id,
        metadata: { name: tag.name },
      },
    });

    res.status(200).json({ message: "Tag deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/tags/:id/merge
 * Fusionne un tag source dans un tag cible
 * Toutes les recettes du source sont reassignees au target
 */
export const merge: RequestHandler = async (req, res, next) => {
  try {
    const { id: sourceId } = req.params;
    const { targetId } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!targetId) {
      throw createHttpError(400, "ADMIN_TAG_004: Target tag ID required");
    }

    if (sourceId === targetId) {
      throw createHttpError(400, "ADMIN_TAG_005: Cannot merge tag into itself");
    }

    const [source, target] = await Promise.all([
      prisma.tag.findUnique({ where: { id: sourceId } }),
      prisma.tag.findUnique({ where: { id: targetId } }),
    ]);

    if (!source) {
      throw createHttpError(404, "ADMIN_TAG_003: Source tag not found");
    }
    if (!target) {
      throw createHttpError(404, "ADMIN_TAG_006: Target tag not found");
    }

    // Transferer les recettes du source vers le target
    // D'abord supprimer les doublons potentiels
    await prisma.$transaction(async (tx) => {
      // Recuperer les recettes du source
      const sourceRecipes = await tx.recipeTag.findMany({
        where: { tagId: sourceId },
        select: { recipeId: true },
      });

      // Pour chaque recette, ajouter le target si pas deja present
      for (const { recipeId } of sourceRecipes) {
        await tx.recipeTag.upsert({
          where: { recipeId_tagId: { recipeId, tagId: targetId } },
          create: { recipeId, tagId: targetId },
          update: {},
        });
      }

      // Supprimer le source (cascade supprime les RecipeTag)
      await tx.tag.delete({ where: { id: sourceId } });
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "TAG_MERGED",
        targetType: "Tag",
        targetId,
        metadata: {
          sourceId,
          sourceName: source.name,
          targetName: target.name,
        },
      },
    });

    res.status(200).json({
      message: `Tag "${source.name}" merged into "${target.name}"`,
    });
  } catch (error) {
    next(error);
  }
};

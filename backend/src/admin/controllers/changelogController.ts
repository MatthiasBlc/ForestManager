import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../../util/pagination";
import { CHANGELOG_001, CHANGELOG_002 } from "../../constants/errorCodes";
import { AdminCreateChangelogInput, AdminUpdateChangelogInput } from "../schemas/changelog.schema";

/**
 * GET /api/admin/changelog
 * Liste paginee des entrees changelog (includeDeleted optionnel)
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, string>);
    const includeDeleted = req.query.includeDeleted === "true";

    const where = includeDeleted ? {} : { deletedAt: null };

    const [entries, total] = await Promise.all([
      prisma.changelogEntry.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.changelogEntry.count({ where }),
    ]);

    res.status(200).json({
      data: entries,
      pagination: buildPaginationMeta(total, limit, offset, entries.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/changelog
 * Creation manuelle d'une entree
 */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { version, title, content, publishedAt } = req.body as AdminCreateChangelogInput;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const existing = await prisma.changelogEntry.findUnique({ where: { version } });
    if (existing) {
      throw createHttpError(409, CHANGELOG_002);
    }

    const entry = await prisma.changelogEntry.create({
      data: {
        version,
        title,
        content,
        ...(publishedAt && { publishedAt }),
      },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "CHANGELOG_CREATED",
        targetType: "ChangelogEntry",
        targetId: entry.id,
        metadata: { version, title },
      },
    });

    res.status(201).json({ data: entry });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/changelog/:id
 * Modification d'une entree (title, content, version, publishedAt)
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { version, title, content, publishedAt } = req.body as AdminUpdateChangelogInput;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry || entry.deletedAt) {
      throw createHttpError(404, CHANGELOG_001);
    }

    if (version && version !== entry.version) {
      const existing = await prisma.changelogEntry.findUnique({ where: { version } });
      if (existing) {
        throw createHttpError(409, CHANGELOG_002);
      }
    }

    const updated = await prisma.changelogEntry.update({
      where: { id },
      data: {
        ...(version && { version }),
        ...(title && { title }),
        ...(content && { content }),
        ...(publishedAt && { publishedAt }),
      },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "CHANGELOG_UPDATED",
        targetType: "ChangelogEntry",
        targetId: id,
        metadata: {
          oldVersion: entry.version,
          ...(version && { newVersion: version }),
          ...(title && { newTitle: title }),
        },
      },
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/changelog/:id
 * Soft delete
 */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry) {
      throw createHttpError(404, CHANGELOG_001);
    }
    if (entry.deletedAt) {
      throw createHttpError(404, CHANGELOG_001);
    }

    await prisma.changelogEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "CHANGELOG_DELETED",
        targetType: "ChangelogEntry",
        targetId: id,
        metadata: { version: entry.version, title: entry.title },
      },
    });

    res.status(200).json({ message: "Changelog entry deleted" });
  } catch (error) {
    next(error);
  }
};

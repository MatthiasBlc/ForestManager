import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../util/db";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { CHANGELOG_001 } from "../constants/errorCodes";

/**
 * GET /api/changelog
 * Liste paginee des entrees changelog (actives uniquement)
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, string>);

    const where = { deletedAt: null };

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
 * GET /api/changelog/:id
 * Detail d'une entree (active uniquement)
 */
export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const entry = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!entry || entry.deletedAt) {
      throw createHttpError(404, CHANGELOG_001);
    }

    res.status(200).json({ data: entry });
  } catch (error) {
    next(error);
  }
};

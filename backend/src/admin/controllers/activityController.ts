import { RequestHandler } from "express";
import { AdminActionType, Prisma } from "@prisma/client";
import prisma from "../../util/db";
import { parsePagination, buildPaginationMeta } from "../../util/pagination";

interface GetActivityQuery {
  type?: string;
  adminId?: string;
  limit?: string;
  offset?: string;
}

/**
 * GET /api/admin/activity
 * Liste des activites admin avec pagination
 */
export const getAll: RequestHandler<unknown, unknown, unknown, GetActivityQuery> = async (req, res, next) => {
  try {
    const { type, adminId } = req.query;
    const { limit: take, offset: skip } = parsePagination(req.query, 50);

    const where: Prisma.AdminActivityLogWhereInput = {};

    if (type && typeof type === "string" && type in AdminActionType) {
      where.type = type as AdminActionType;
    }

    if (adminId && typeof adminId === "string") {
      where.adminId = adminId;
    }

    const [activities, total] = await Promise.all([
      prisma.adminActivityLog.findMany({
        where,
        include: {
          admin: {
            select: { id: true, username: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.adminActivityLog.count({ where }),
    ]);

    res.status(200).json({
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        targetType: a.targetType,
        targetId: a.targetId,
        metadata: a.metadata,
        createdAt: a.createdAt,
        admin: a.admin,
      })),
      pagination: buildPaginationMeta(total, take, skip, activities.length),
    });
  } catch (error) {
    next(error);
  }
};

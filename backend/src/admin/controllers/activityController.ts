import { RequestHandler } from "express";
import { AdminActionType, Prisma } from "@prisma/client";
import prisma from "../../util/db";

/**
 * GET /api/admin/activity
 * Liste des activites admin avec pagination
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { type, adminId, limit = "50", offset = "0" } = req.query;

    const take = Math.min(parseInt(String(limit), 10) || 50, 100);
    const skip = parseInt(String(offset), 10) || 0;

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
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

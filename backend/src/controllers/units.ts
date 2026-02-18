import { RequestHandler } from "express";
import prisma from "../util/db";
import { assertIsDefine } from "../util/assertIsDefine";

/**
 * GET /api/units
 * Liste toutes les unites groupees par categorie, triees par sortOrder
 */
export const getUnits: RequestHandler = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const units = await prisma.unit.findMany({
      select: {
        id: true,
        name: true,
        abbreviation: true,
        category: true,
        sortOrder: true,
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });

    // Grouper par categorie
    const grouped: Record<string, typeof units> = {};
    for (const unit of units) {
      if (!grouped[unit.category]) {
        grouped[unit.category] = [];
      }
      grouped[unit.category].push(unit);
    }

    res.status(200).json({ data: grouped });
  } catch (error) {
    next(error);
  }
};

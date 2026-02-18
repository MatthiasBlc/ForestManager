import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { Prisma } from "@prisma/client";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";

const VALID_CATEGORIES = ["WEIGHT", "VOLUME", "SPOON", "COUNT", "QUALITATIVE"];

/**
 * GET /api/admin/units
 * Liste toutes les unites avec usage count
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { search, category } = req.query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { abbreviation: { contains: String(search), mode: "insensitive" } },
      ];
    }

    if (category && VALID_CATEGORIES.includes(String(category))) {
      where.category = String(category);
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        _count: {
          select: {
            recipeIngredients: true,
            proposalIngredients: true,
            defaultIngredients: true,
          },
        },
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });

    res.status(200).json({
      units: units.map((u) => ({
        id: u.id,
        name: u.name,
        abbreviation: u.abbreviation,
        category: u.category,
        sortOrder: u.sortOrder,
        usageCount: u._count.recipeIngredients + u._count.proposalIngredients,
        defaultIngredientCount: u._count.defaultIngredients,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/units
 * Cree une nouvelle unite
 */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { name, abbreviation, category, sortOrder } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, "ADMIN_UNIT_001: Name is required");
    }

    if (!abbreviation || typeof abbreviation !== "string" || abbreviation.trim().length === 0) {
      throw createHttpError(400, "ADMIN_UNIT_002: Abbreviation is required");
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      throw createHttpError(400, "ADMIN_UNIT_003: Valid category is required (WEIGHT, VOLUME, SPOON, COUNT, QUALITATIVE)");
    }

    const normalizedName = name.trim().toLowerCase();
    const normalizedAbbr = abbreviation.trim().toLowerCase();

    // Verifier unicite nom
    const existingName = await prisma.unit.findUnique({ where: { name: normalizedName } });
    if (existingName) {
      throw createHttpError(409, "ADMIN_UNIT_004: Unit name already exists");
    }

    // Verifier unicite abbreviation
    const existingAbbr = await prisma.unit.findUnique({ where: { abbreviation: normalizedAbbr } });
    if (existingAbbr) {
      throw createHttpError(409, "ADMIN_UNIT_005: Abbreviation already exists");
    }

    const unit = await prisma.unit.create({
      data: {
        name: normalizedName,
        abbreviation: normalizedAbbr,
        category,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "UNIT_CREATED",
        targetType: "Unit",
        targetId: unit.id,
        metadata: { name: normalizedName, abbreviation: normalizedAbbr, category },
      },
    });

    res.status(201).json({ unit });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/units/:id
 * Modifie une unite
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, abbreviation, category, sortOrder } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const unit = await prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw createHttpError(404, "ADMIN_UNIT_006: Unit not found");
    }

    const data: Record<string, unknown> = {};
    const metadata: Record<string, string | number> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw createHttpError(400, "ADMIN_UNIT_001: Name is required");
      }
      const normalizedName = name.trim().toLowerCase();
      if (normalizedName !== unit.name) {
        const existing = await prisma.unit.findUnique({ where: { name: normalizedName } });
        if (existing) {
          throw createHttpError(409, "ADMIN_UNIT_004: Unit name already exists");
        }
        metadata.oldName = unit.name;
        metadata.newName = normalizedName;
        data.name = normalizedName;
      }
    }

    if (abbreviation !== undefined) {
      if (typeof abbreviation !== "string" || abbreviation.trim().length === 0) {
        throw createHttpError(400, "ADMIN_UNIT_002: Abbreviation is required");
      }
      const normalizedAbbr = abbreviation.trim().toLowerCase();
      if (normalizedAbbr !== unit.abbreviation) {
        const existing = await prisma.unit.findUnique({ where: { abbreviation: normalizedAbbr } });
        if (existing) {
          throw createHttpError(409, "ADMIN_UNIT_005: Abbreviation already exists");
        }
        metadata.oldAbbreviation = unit.abbreviation;
        metadata.newAbbreviation = normalizedAbbr;
        data.abbreviation = normalizedAbbr;
      }
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        throw createHttpError(400, "ADMIN_UNIT_003: Valid category is required (WEIGHT, VOLUME, SPOON, COUNT, QUALITATIVE)");
      }
      data.category = category;
    }

    if (typeof sortOrder === "number") {
      data.sortOrder = sortOrder;
    }

    if (Object.keys(data).length === 0) {
      return res.status(200).json({ unit });
    }

    const updated = await prisma.unit.update({
      where: { id },
      data,
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "UNIT_UPDATED",
        targetType: "Unit",
        targetId: id,
        metadata,
      },
    });

    res.status(200).json({ unit: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/units/:id
 * Supprime une unite (uniquement si non utilisee)
 */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            recipeIngredients: true,
            proposalIngredients: true,
            defaultIngredients: true,
          },
        },
      },
    });

    if (!unit) {
      throw createHttpError(404, "ADMIN_UNIT_006: Unit not found");
    }

    const totalUsage = unit._count.recipeIngredients + unit._count.proposalIngredients + unit._count.defaultIngredients;
    if (totalUsage > 0) {
      throw createHttpError(
        409,
        "ADMIN_UNIT_007: Cannot delete unit that is in use. Migrate recipes to another unit first."
      );
    }

    await prisma.unit.delete({ where: { id } });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "UNIT_DELETED",
        targetType: "Unit",
        targetId: id,
        metadata: { name: unit.name, abbreviation: unit.abbreviation },
      },
    });

    res.status(200).json({ message: "Unit deleted" });
  } catch (error) {
    next(error);
  }
};

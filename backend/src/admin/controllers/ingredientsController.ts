import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../../util/pagination";
import appEvents from "../../services/eventEmitter";
import { validateStringLength, MAX_NAME_LENGTH, MAX_REASON_LENGTH } from "../../util/validation";
import {
  ADMIN_ING_001,
  ADMIN_ING_002,
  ADMIN_ING_003,
  ADMIN_ING_004,
  ADMIN_ING_005,
  ADMIN_ING_006,
  ADMIN_ING_007,
  ADMIN_ING_008,
  ADMIN_ING_009,
} from "../../constants/errorCodes";

/**
 * GET /api/admin/ingredients
 * Liste tous les ingredients avec count de recettes
 * Filtre optionnel par ?search= et ?status=APPROVED|PENDING
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, string>, 100);

    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: String(search), mode: "insensitive" };
    }

    if (status === "APPROVED" || status === "PENDING") {
      where.status = status;
    }

    const [ingredients, total] = await Promise.all([
      prisma.ingredient.findMany({
        where,
        include: {
          _count: { select: { recipes: true, proposals: true } },
          createdBy: { select: { id: true, username: true } },
          defaultUnit: { select: { id: true, name: true, abbreviation: true } },
        },
        orderBy: { name: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.ingredient.count({ where }),
    ]);

    // Calculer l'unite populaire pour chaque ingredient
    const ingredientIds = ingredients.map((i) => i.id);
    const popularUnits = await getPopularUnitsForIngredients(ingredientIds);

    res.status(200).json({
      ingredients: ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        createdBy: i.createdBy,
        defaultUnit: i.defaultUnit,
        popularUnit: popularUnits[i.id] || null,
        recipeCount: i._count.recipes,
        proposalCount: i._count.proposals,
        createdAt: i.createdAt,
      })),
      pagination: buildPaginationMeta(total, limit, offset, ingredients.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calcule l'unite la plus utilisee pour chaque ingredient
 */
async function getPopularUnitsForIngredients(
  ingredientIds: string[]
): Promise<Record<string, { id: string; abbreviation: string; useCount: number }>> {
  if (ingredientIds.length === 0) return {};

  // Requete raw pour obtenir l'unite la plus utilisee par ingredient
  const results = await prisma.$queryRaw<
    Array<{
      ingredientId: string;
      unitId: string;
      abbreviation: string;
      useCount: bigint;
    }>
  >`
    SELECT DISTINCT ON (ri."ingredientId")
      ri."ingredientId",
      ri."unitId",
      u."abbreviation",
      COUNT(*) as "useCount"
    FROM "RecipeIngredient" ri
    JOIN "Unit" u ON u.id = ri."unitId"
    WHERE ri."ingredientId" = ANY(${ingredientIds})
      AND ri."unitId" IS NOT NULL
    GROUP BY ri."ingredientId", ri."unitId", u."abbreviation"
    ORDER BY ri."ingredientId", COUNT(*) DESC
  `;

  const map: Record<string, { id: string; abbreviation: string; useCount: number }> = {};
  for (const row of results) {
    map[row.ingredientId] = {
      id: row.unitId,
      abbreviation: row.abbreviation,
      useCount: Number(row.useCount),
    };
  }
  return map;
}

/**
 * POST /api/admin/ingredients
 * Cree un nouvel ingredient (APPROVED par defaut car admin)
 */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { name, defaultUnitId } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, ADMIN_ING_001);
    }
    validateStringLength(name.trim(), "name", 1, MAX_NAME_LENGTH);

    const normalized = name.trim().toLowerCase();

    const existing = await prisma.ingredient.findUnique({
      where: { name: normalized },
    });

    if (existing) {
      throw createHttpError(409, ADMIN_ING_002);
    }

    // Valider defaultUnitId si fourni
    if (defaultUnitId) {
      const unit = await prisma.unit.findUnique({ where: { id: defaultUnitId } });
      if (!unit) {
        throw createHttpError(400, ADMIN_ING_007);
      }
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name: normalized,
        status: "APPROVED",
        defaultUnitId: defaultUnitId || null,
      },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "INGREDIENT_CREATED",
        targetType: "Ingredient",
        targetId: ingredient.id,
        metadata: { name: normalized },
      },
    });

    res.status(201).json({ ingredient });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/ingredients/:id
 * Modifie un ingredient (nom, defaultUnitId)
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, defaultUnitId } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw createHttpError(404, ADMIN_ING_003);
    }

    const data: Record<string, unknown> = {};
    const metadata: Record<string, string> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        throw createHttpError(400, ADMIN_ING_001);
      }
      validateStringLength(name.trim(), "name", 1, MAX_NAME_LENGTH);

      const normalized = name.trim().toLowerCase();

      if (normalized !== ingredient.name) {
        const existing = await prisma.ingredient.findUnique({
          where: { name: normalized },
        });
        if (existing) {
          throw createHttpError(409, ADMIN_ING_002);
        }
        metadata.oldName = ingredient.name;
        metadata.newName = normalized;
        data.name = normalized;
      }
    }

    if (defaultUnitId !== undefined) {
      if (defaultUnitId === null) {
        data.defaultUnitId = null;
      } else {
        const unit = await prisma.unit.findUnique({ where: { id: defaultUnitId } });
        if (!unit) {
          throw createHttpError(400, ADMIN_ING_007);
        }
        data.defaultUnitId = defaultUnitId;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(200).json({ ingredient });
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data,
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "INGREDIENT_UPDATED",
        targetType: "Ingredient",
        targetId: id,
        metadata,
      },
    });

    res.status(200).json({ ingredient: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/ingredients/:id
 * Supprime un ingredient (hard delete, les RecipeIngredient sont cascade)
 */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw createHttpError(404, ADMIN_ING_003);
    }

    await prisma.ingredient.delete({ where: { id } });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "INGREDIENT_DELETED",
        targetType: "Ingredient",
        targetId: id,
        metadata: { name: ingredient.name },
      },
    });

    res.status(200).json({ message: "Ingredient deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/ingredients/:id/merge
 * Fusionne un ingredient source dans un ingredient cible
 * Gere RecipeIngredient ET ProposalIngredient
 */
export const merge: RequestHandler = async (req, res, next) => {
  try {
    const { id: sourceId } = req.params;
    const { targetId } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!targetId) {
      throw createHttpError(400, ADMIN_ING_004);
    }

    if (sourceId === targetId) {
      throw createHttpError(400, ADMIN_ING_005);
    }

    const [source, target] = await Promise.all([
      prisma.ingredient.findUnique({ where: { id: sourceId } }),
      prisma.ingredient.findUnique({ where: { id: targetId } }),
    ]);

    if (!source) {
      throw createHttpError(404, ADMIN_ING_003);
    }
    if (!target) {
      throw createHttpError(404, ADMIN_ING_006);
    }

    await prisma.$transaction(async (tx) => {
      // Transferer RecipeIngredient
      const sourceRecipes = await tx.recipeIngredient.findMany({
        where: { ingredientId: sourceId },
        select: { recipeId: true, quantity: true, unitId: true, order: true },
      });

      for (const { recipeId, quantity, unitId, order } of sourceRecipes) {
        const existing = await tx.recipeIngredient.findUnique({
          where: { recipeId_ingredientId: { recipeId, ingredientId: targetId } },
        });

        if (!existing) {
          await tx.recipeIngredient.create({
            data: { recipeId, ingredientId: targetId, quantity, unitId, order },
          });
        }
      }

      // Transferer ProposalIngredient
      const sourceProposals = await tx.proposalIngredient.findMany({
        where: { ingredientId: sourceId },
        select: { proposalId: true, quantity: true, unitId: true, order: true },
      });

      for (const { proposalId, quantity, unitId, order } of sourceProposals) {
        const existing = await tx.proposalIngredient.findUnique({
          where: { proposalId_ingredientId: { proposalId, ingredientId: targetId } },
        });

        if (!existing) {
          await tx.proposalIngredient.create({
            data: { proposalId, ingredientId: targetId, quantity, unitId, order },
          });
        }
      }

      // Supprimer le source (cascade supprime RecipeIngredient + ProposalIngredient)
      await tx.ingredient.delete({ where: { id: sourceId } });
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "INGREDIENT_MERGED",
        targetType: "Ingredient",
        targetId,
        metadata: {
          sourceId,
          sourceName: source.name,
          targetName: target.name,
        },
      },
    });

    // Notification WebSocket au createur de l'ingredient source
    if (source.createdById) {
      appEvents.emitActivity({
        type: "INGREDIENT_MERGED",
        userId: adminId,
        communityId: null,
        targetUserIds: [source.createdById],
        metadata: {
          ingredientName: source.name,
          targetName: target.name,
        },
      });
    }

    res.status(200).json({
      message: `Ingredient "${source.name}" merged into "${target.name}"`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/ingredients/:id/approve
 * Approuve un ingredient PENDING (optionnel: renommer)
 */
export const approve: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw createHttpError(404, ADMIN_ING_003);
    }

    if (ingredient.status !== "PENDING") {
      throw createHttpError(400, ADMIN_ING_008);
    }

    const data: Record<string, unknown> = { status: "APPROVED" };
    const metadata: Record<string, string> = { name: ingredient.name };

    if (newName && typeof newName === "string" && newName.trim().length > 0) {
      const normalized = newName.trim().toLowerCase();
      if (normalized !== ingredient.name) {
        const existing = await prisma.ingredient.findUnique({ where: { name: normalized } });
        if (existing) {
          throw createHttpError(409, ADMIN_ING_002);
        }
        data.name = normalized;
        metadata.oldName = ingredient.name;
        metadata.newName = normalized;
      }
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data,
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "INGREDIENT_APPROVED",
        targetType: "Ingredient",
        targetId: id,
        metadata,
      },
    });

    // Notification WebSocket au createur (si un user a cree cet ingredient)
    if (ingredient.createdById) {
      const isRenamed = metadata.newName !== undefined;
      appEvents.emitActivity({
        type: isRenamed ? "INGREDIENT_MODIFIED" : "INGREDIENT_APPROVED",
        userId: adminId,
        communityId: null,
        targetUserIds: [ingredient.createdById],
        metadata: isRenamed
          ? { ingredientName: ingredient.name, newName: metadata.newName }
          : { ingredientName: ingredient.name },
      });
    }

    res.status(200).json({ ingredient: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/ingredients/:id/reject
 * Rejette un ingredient PENDING (hard delete, raison obligatoire)
 */
export const reject: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      throw createHttpError(400, ADMIN_ING_009);
    }
    validateStringLength(reason.trim(), "reason", 1, MAX_REASON_LENGTH);

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw createHttpError(404, ADMIN_ING_003);
    }

    if (ingredient.status !== "PENDING") {
      throw createHttpError(400, ADMIN_ING_008);
    }

    // Hard delete (cascade supprime RecipeIngredient + ProposalIngredient)
    await prisma.ingredient.delete({ where: { id } });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "INGREDIENT_REJECTED",
        targetType: "Ingredient",
        targetId: id,
        metadata: {
          name: ingredient.name,
          reason: reason.trim(),
          createdById: ingredient.createdById,
        },
      },
    });

    // Notification WebSocket au createur (si un user a cree cet ingredient)
    if (ingredient.createdById) {
      appEvents.emitActivity({
        type: "INGREDIENT_REJECTED",
        userId: adminId,
        communityId: null,
        targetUserIds: [ingredient.createdById],
        metadata: {
          ingredientName: ingredient.name,
          reason: reason.trim(),
        },
      });
    }

    res.status(200).json({ message: "Ingredient rejected and deleted" });
  } catch (error) {
    next(error);
  }
};

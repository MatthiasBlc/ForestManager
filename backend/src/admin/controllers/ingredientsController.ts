import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";

/**
 * GET /api/admin/ingredients
 * Liste tous les ingredients avec count de recettes
 */
export const getAll: RequestHandler = async (req, res, next) => {
  try {
    const { search } = req.query;

    const ingredients = await prisma.ingredient.findMany({
      where: search
        ? { name: { contains: String(search), mode: "insensitive" } }
        : undefined,
      include: {
        _count: { select: { recipes: true } },
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      ingredients: ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        recipeCount: i._count.recipes,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/ingredients
 * Cree un nouvel ingredient
 */
export const create: RequestHandler = async (req, res, next) => {
  try {
    const { name } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, "ADMIN_ING_001: Name is required");
    }

    const normalized = name.trim().toLowerCase();

    const existing = await prisma.ingredient.findUnique({
      where: { name: normalized },
    });

    if (existing) {
      throw createHttpError(409, "ADMIN_ING_002: Ingredient already exists");
    }

    const ingredient = await prisma.ingredient.create({
      data: { name: normalized },
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
 * Renomme un ingredient
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createHttpError(400, "ADMIN_ING_001: Name is required");
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw createHttpError(404, "ADMIN_ING_003: Ingredient not found");
    }

    const normalized = name.trim().toLowerCase();

    if (normalized !== ingredient.name) {
      const existing = await prisma.ingredient.findUnique({
        where: { name: normalized },
      });
      if (existing) {
        throw createHttpError(409, "ADMIN_ING_002: Ingredient already exists");
      }
    }

    const oldName = ingredient.name;
    const updated = await prisma.ingredient.update({
      where: { id },
      data: { name: normalized },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "INGREDIENT_UPDATED",
        targetType: "Ingredient",
        targetId: id,
        metadata: { oldName, newName: normalized },
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
      throw createHttpError(404, "ADMIN_ING_003: Ingredient not found");
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
 */
export const merge: RequestHandler = async (req, res, next) => {
  try {
    const { id: sourceId } = req.params;
    const { targetId } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    if (!targetId) {
      throw createHttpError(400, "ADMIN_ING_004: Target ingredient ID required");
    }

    if (sourceId === targetId) {
      throw createHttpError(400, "ADMIN_ING_005: Cannot merge ingredient into itself");
    }

    const [source, target] = await Promise.all([
      prisma.ingredient.findUnique({ where: { id: sourceId } }),
      prisma.ingredient.findUnique({ where: { id: targetId } }),
    ]);

    if (!source) {
      throw createHttpError(404, "ADMIN_ING_003: Source ingredient not found");
    }
    if (!target) {
      throw createHttpError(404, "ADMIN_ING_006: Target ingredient not found");
    }

    await prisma.$transaction(async (tx) => {
      // Recuperer les recettes du source
      const sourceRecipes = await tx.recipeIngredient.findMany({
        where: { ingredientId: sourceId },
        select: { recipeId: true, quantity: true, order: true },
      });

      // Pour chaque recette, ajouter le target si pas deja present
      for (const { recipeId, quantity, order } of sourceRecipes) {
        const existing = await tx.recipeIngredient.findUnique({
          where: { recipeId_ingredientId: { recipeId, ingredientId: targetId } },
        });

        if (!existing) {
          await tx.recipeIngredient.create({
            data: { recipeId, ingredientId: targetId, quantity, order },
          });
        }
      }

      // Supprimer le source (cascade supprime les RecipeIngredient)
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

    res.status(200).json({
      message: `Ingredient "${source.name}" merged into "${target.name}"`,
    });
  } catch (error) {
    next(error);
  }
};

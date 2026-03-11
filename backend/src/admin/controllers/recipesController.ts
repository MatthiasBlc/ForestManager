import { RequestHandler } from "express";
import createHttpError from "http-errors";
import prisma from "../../util/db";
import { assertIsDefine } from "../../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../../util/pagination";
import { RECIPE_DETAIL_INCLUDE } from "../../util/prismaSelects";
import {
  assertString,
  assertOptionalNumber,
  validateStringLength,
  validateServings,
  validateTime,
  MAX_TITLE_LENGTH,
} from "../../util/validation";

/**
 * GET /api/admin/tags/:id/recipes
 * Liste les recettes associees a un tag
 */
export const getTagRecipes: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeDeleted } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, string>, 50);

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw createHttpError(404, "ADMIN_REC_001: Tag not found");
    }

    const deletedFilter = includeDeleted === "true" ? {} : { deletedAt: null };

    const [recipeTags, total] = await Promise.all([
      prisma.recipeTag.findMany({
        where: {
          tagId: id,
          recipe: deletedFilter,
        },
        include: {
          recipe: {
            select: {
              id: true,
              title: true,
              createdAt: true,
              deletedAt: true,
              creator: { select: { id: true, username: true } },
              community: { select: { id: true, name: true } },
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { recipe: { createdAt: "desc" } },
      }),
      prisma.recipeTag.count({
        where: {
          tagId: id,
          recipe: deletedFilter,
        },
      }),
    ]);

    res.status(200).json({
      recipes: recipeTags.map((rt) => rt.recipe),
      pagination: buildPaginationMeta(total, limit, offset, recipeTags.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/recipes/:recipeId
 * Detail complet d'une recette
 */
export const getDetail: RequestHandler = async (req, res, next) => {
  try {
    const { recipeId } = req.params;

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ...RECIPE_DETAIL_INCLUDE,
        community: { select: { id: true, name: true } },
      },
    });

    if (!recipe) {
      throw createHttpError(404, "ADMIN_REC_002: Recipe not found");
    }

    res.status(200).json({ recipe });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/recipes/:recipeId
 * Modification des champs scalaires d'une recette
 */
export const update: RequestHandler = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const { title, servings, prepTime, cookTime, restTime } = req.body;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      throw createHttpError(404, "ADMIN_REC_002: Recipe not found");
    }

    // Validation
    if (title !== undefined) {
      assertString(title, "title");
      validateStringLength(title.trim(), "title", 1, MAX_TITLE_LENGTH);
    }
    if (servings !== undefined && !validateServings(servings)) {
      throw createHttpError(400, "RECIPE_006: Servings must be an integer between 1 and 100");
    }
    assertOptionalNumber(prepTime, "prepTime");
    if (prepTime !== undefined && !validateTime(prepTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid prep time (integer 0-10000)");
    }
    assertOptionalNumber(cookTime, "cookTime");
    if (cookTime !== undefined && !validateTime(cookTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid cook time (integer 0-10000)");
    }
    assertOptionalNumber(restTime, "restTime");
    if (restTime !== undefined && !validateTime(restTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid rest time (integer 0-10000)");
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (servings !== undefined) data.servings = servings;
    if (prepTime !== undefined) data.prepTime = prepTime;
    if (cookTime !== undefined) data.cookTime = cookTime;
    if (restTime !== undefined) data.restTime = restTime;

    const updated = await prisma.recipe.update({
      where: { id: recipeId },
      data,
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "RECIPE_UPDATED",
        targetType: "Recipe",
        targetId: recipeId,
        metadata: {
          changes: data as Record<string, string | number | null>,
          oldTitle: recipe.title,
        },
      },
    });

    res.status(200).json({ recipe: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/recipes/:recipeId
 * Soft delete d'une recette
 */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const adminId = req.session.adminId;
    assertIsDefine(adminId);

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      throw createHttpError(404, "ADMIN_REC_002: Recipe not found");
    }

    if (recipe.deletedAt) {
      throw createHttpError(400, "ADMIN_REC_003: Recipe already deleted");
    }

    await prisma.recipe.update({
      where: { id: recipeId },
      data: { deletedAt: new Date() },
    });

    await prisma.adminActivityLog.create({
      data: {
        adminId,
        type: "RECIPE_DELETED",
        targetType: "Recipe",
        targetId: recipeId,
        metadata: { title: recipe.title },
      },
    });

    res.status(200).json({ message: "Recipe deleted" });
  } catch (error) {
    next(error);
  }
};

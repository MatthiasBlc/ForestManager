import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { isValidHttpUrl } from "../util/validation";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { RECIPE_TAGS_SELECT } from "../util/prismaSelects";
import { requireRecipeAccess, requireRecipeOwnership } from "../services/membershipService";
import { formatTags, formatIngredients } from "../util/responseFormatters";
import { createRecipe as createRecipeService, updateRecipe as updateRecipeService } from "../services/recipeService";

interface GetRecipesQuery {
  limit?: string;
  offset?: string;
  tags?: string;
  ingredients?: string;
  search?: string;
}

export const getRecipes: RequestHandler<unknown, unknown, unknown, GetRecipesQuery> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { limit, offset } = parsePagination(req.query);
  const tagsFilter = req.query.tags?.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) || [];
  const ingredientsFilter = req.query.ingredients?.split(",").map((i) => i.trim().toLowerCase()).filter(Boolean) || [];
  const searchFilter = req.query.search?.trim() || "";

  try {
    assertIsDefine(authenticatedUserId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      creatorId: authenticatedUserId,
      communityId: null,
      deletedAt: null,
    };

    if (searchFilter) {
      whereClause.title = {
        contains: searchFilter,
        mode: "insensitive",
      };
    }

    const andConditions = [];

    if (tagsFilter.length > 0) {
      andConditions.push(...tagsFilter.map((tagName) => ({
        tags: {
          some: {
            tag: {
              name: tagName,
            },
          },
        },
      })));
    }

    if (ingredientsFilter.length > 0) {
      andConditions.push(...ingredientsFilter.map((ingredientName) => ({
        ingredients: {
          some: {
            ingredient: {
              name: ingredientName,
            },
          },
        },
      })));
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
          tags: RECIPE_TAGS_SELECT,
        },
        orderBy: {
          updatedAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.recipe.count({ where: whereClause }),
    ]);

    const data = recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      tags: formatTags(recipe.tags),
    }));

    res.status(200).json({
      data,
      pagination: buildPaginationMeta(total, limit, offset, recipes.length),
    });
  } catch (error) {
    next(error);
  }
};

export const getRecipe: RequestHandler = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findUnique({
      where: {
        id: recipeId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        creatorId: true,
        communityId: true,
        originRecipeId: true,
        isVariant: true,
        sharedFromCommunityId: true,
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
        community: {
          select: {
            id: true,
            name: true,
          },
        },
        sharedFromCommunity: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        ingredients: {
          select: {
            id: true,
            quantity: true,
            order: true,
            ingredient: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    await requireRecipeAccess(authenticatedUserId, recipe);

    const responseData = {
      id: recipe.id,
      title: recipe.title,
      content: recipe.content,
      imageUrl: recipe.imageUrl,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      creatorId: recipe.creatorId,
      creator: recipe.creator,
      communityId: recipe.communityId,
      community: recipe.community,
      originRecipeId: recipe.originRecipeId,
      isVariant: recipe.isVariant,
      sharedFromCommunityId: recipe.sharedFromCommunityId,
      sharedFromCommunity: recipe.sharedFromCommunity,
      tags: formatTags(recipe.tags),
      ingredients: formatIngredients(recipe.ingredients),
    };

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

interface IngredientInput {
  name: string;
  quantity?: string;
}

interface CreateRecipeBody {
  title?: string;
  content?: string;
  imageUrl?: string;
  tags?: string[];
  ingredients?: IngredientInput[];
}

export const createRecipe: RequestHandler<unknown, unknown, CreateRecipeBody, unknown> = async (req, res, next) => {
  const { title, content, imageUrl, tags = [], ingredients = [] } = req.body;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    if (!title?.trim()) {
      throw createHttpError(400, "RECIPE_003: Title required");
    }

    if (!content?.trim()) {
      throw createHttpError(400, "RECIPE_004: Content required");
    }

    if (!isValidHttpUrl(imageUrl)) {
      throw createHttpError(400, "RECIPE_005: Invalid image URL");
    }

    const newRecipe = await createRecipeService(authenticatedUserId, {
      title, content, imageUrl, tags, ingredients,
    });

    if (!newRecipe) {
      throw createHttpError(500, "Failed to create recipe");
    }

    const responseData = {
      id: newRecipe.id,
      title: newRecipe.title,
      content: newRecipe.content,
      imageUrl: newRecipe.imageUrl,
      createdAt: newRecipe.createdAt,
      updatedAt: newRecipe.updatedAt,
      creatorId: newRecipe.creatorId,
      tags: formatTags(newRecipe.tags),
      ingredients: formatIngredients(newRecipe.ingredients),
    };

    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  }
};

interface UpdateRecipeParams {
  recipeId: string;
}

interface UpdateRecipeBody {
  title?: string;
  content?: string;
  imageUrl?: string;
  tags?: string[];
  ingredients?: IngredientInput[];
}

export const updateRecipe: RequestHandler<UpdateRecipeParams, unknown, UpdateRecipeBody, unknown> = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const { title, content, imageUrl, tags, ingredients } = req.body;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    if (title !== undefined && !title?.trim()) {
      throw createHttpError(400, "RECIPE_003: Title required");
    }

    if (content !== undefined && !content?.trim()) {
      throw createHttpError(400, "RECIPE_004: Content required");
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, deletedAt: null },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    await requireRecipeOwnership(authenticatedUserId, recipe);

    if (imageUrl !== undefined && !isValidHttpUrl(imageUrl)) {
      throw createHttpError(400, "RECIPE_005: Invalid image URL");
    }

    const updatedRecipe = await updateRecipeService(recipeId, {
      title, content, imageUrl, tags, ingredients,
    }, recipe);

    if (!updatedRecipe) {
      throw createHttpError(500, "Failed to update recipe");
    }

    const responseData = {
      id: updatedRecipe.id,
      title: updatedRecipe.title,
      content: updatedRecipe.content,
      imageUrl: updatedRecipe.imageUrl,
      createdAt: updatedRecipe.createdAt,
      updatedAt: updatedRecipe.updatedAt,
      creatorId: updatedRecipe.creatorId,
      tags: formatTags(updatedRecipe.tags),
      ingredients: formatIngredients(updatedRecipe.ingredients),
    };

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

export const deleteRecipe: RequestHandler = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, deletedAt: null },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    await requireRecipeOwnership(authenticatedUserId, recipe);

    await prisma.recipe.update({
      where: { id: recipeId },
      data: { deletedAt: new Date() },
    });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

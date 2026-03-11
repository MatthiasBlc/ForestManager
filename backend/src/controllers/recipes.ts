import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { Prisma } from "@prisma/client";
import {
  validateServings,
  validateTime,
  validateSteps,
  StepInput,
  assertString,
  assertArray,
  validateQuantity,
  validateStringLength,
  MAX_TITLE_LENGTH,
  MAX_TAGS_PER_RECIPE,
  MAX_FILTER_ITEMS,
  MAX_SEARCH_LENGTH,
} from "../util/validation";
import { buildImageUrl } from "../config/storage";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import {
  RECIPE_TAGS_SELECT,
  RECIPE_STEPS_SELECT,
  RECIPE_INGREDIENTS_SELECT,
} from "../util/prismaSelects";
import { requireRecipeAccess, requireRecipeOwnership } from "../services/membershipService";
import {
  VALIDATION_001,
  RECIPE_001,
  RECIPE_003,
  RECIPE_006,
  RECIPE_007,
  RECIPE_008,
  RECIPE_009,
  TAG_003,
} from "../constants/errorCodes";
import { formatTags, formatIngredients, formatSteps } from "../util/responseFormatters";
import {
  createRecipe as createRecipeService,
  updateRecipe as updateRecipeService,
} from "../services/recipeService";
import appEvents from "../services/eventEmitter";
import { getModeratorIdsForTagNotification } from "../services/notificationService";

interface GetRecipesQuery {
  limit?: string;
  offset?: string;
  tags?: string;
  ingredients?: string;
  search?: string;
}

export const getRecipes: RequestHandler<unknown, unknown, unknown, GetRecipesQuery> = async (
  req,
  res,
  next
) => {
  const authenticatedUserId = req.session.userId;
  const { limit, offset } = parsePagination(req.query);
  const tagsFilter =
    req.query.tags
      ?.split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean) || [];
  const ingredientsFilter =
    req.query.ingredients
      ?.split(",")
      .map((i) => i.trim().toLowerCase())
      .filter(Boolean) || [];
  const searchFilter = req.query.search?.trim() || "";

  try {
    assertIsDefine(authenticatedUserId);

    if (tagsFilter.length > MAX_FILTER_ITEMS) {
      throw createHttpError(400, VALIDATION_001(`Too many tag filters (max ${MAX_FILTER_ITEMS})`));
    }
    if (ingredientsFilter.length > MAX_FILTER_ITEMS) {
      throw createHttpError(
        400,
        VALIDATION_001(`Too many ingredient filters (max ${MAX_FILTER_ITEMS})`)
      );
    }
    if (searchFilter.length > MAX_SEARCH_LENGTH) {
      throw createHttpError(
        400,
        VALIDATION_001(`Search query too long (max ${MAX_SEARCH_LENGTH} chars)`)
      );
    }

    const whereClause: Prisma.RecipeWhereInput = {
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
      andConditions.push(
        ...tagsFilter.map((tagName) => ({
          tags: {
            some: {
              tag: {
                name: tagName,
              },
            },
          },
        }))
      );
    }

    if (ingredientsFilter.length > 0) {
      andConditions.push(
        ...ingredientsFilter.map((ingredientName) => ({
          ingredients: {
            some: {
              ingredient: {
                name: ingredientName,
              },
            },
          },
        }))
      );
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
          servings: true,
          prepTime: true,
          cookTime: true,
          restTime: true,
          imageKey: true,
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
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      restTime: recipe.restTime,
      imageUrl: recipe.imageKey ? buildImageUrl(recipe.imageKey) : null,
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
        servings: true,
        prepTime: true,
        cookTime: true,
        restTime: true,
        imageKey: true,
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
        steps: RECIPE_STEPS_SELECT,
        tags: RECIPE_TAGS_SELECT,
        ingredients: RECIPE_INGREDIENTS_SELECT,
      },
    });

    if (!recipe) {
      throw createHttpError(404, RECIPE_001);
    }

    await requireRecipeAccess(authenticatedUserId, recipe);

    const responseData = {
      id: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      restTime: recipe.restTime,
      imageUrl: recipe.imageKey ? buildImageUrl(recipe.imageKey) : null,
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
      steps: formatSteps(recipe.steps),
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
  quantity?: number;
  unitId?: string;
}

interface CreateRecipeBody {
  title?: string;
  servings?: number;
  prepTime?: number | null;
  cookTime?: number | null;
  restTime?: number | null;
  steps?: StepInput[];
  tags?: string[];
  ingredients?: IngredientInput[];
}

export const createRecipe: RequestHandler<unknown, unknown, CreateRecipeBody, unknown> = async (
  req,
  res,
  next
) => {
  const {
    title,
    servings,
    prepTime,
    cookTime,
    restTime,
    steps,
    tags = [],
    ingredients = [],
  } = req.body;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    if (!title) {
      throw createHttpError(400, RECIPE_003);
    }
    assertString(title, "title");
    if (!title.trim()) {
      throw createHttpError(400, RECIPE_003);
    }
    validateStringLength(title.trim(), "title", 1, MAX_TITLE_LENGTH);

    if (!validateServings(servings)) {
      throw createHttpError(400, RECIPE_006);
    }

    if (!validateSteps(steps)) {
      throw createHttpError(400, RECIPE_007);
    }

    if (!validateTime(prepTime)) {
      throw createHttpError(400, RECIPE_008);
    }

    if (!validateTime(cookTime)) {
      throw createHttpError(400, RECIPE_008);
    }

    if (!validateTime(restTime)) {
      throw createHttpError(400, RECIPE_008);
    }

    // Tags validation
    assertArray(tags, "tags");
    if (tags.length > MAX_TAGS_PER_RECIPE) {
      throw createHttpError(400, TAG_003);
    }

    // Ingredients validation
    assertArray(ingredients, "ingredients");
    for (const ing of ingredients) {
      assertString(ing.name, "ingredient name");
      validateQuantity(ing.quantity, "ingredient quantity");
    }

    const newRecipe = await createRecipeService(authenticatedUserId, {
      title,
      servings,
      prepTime,
      cookTime,
      restTime,
      steps,
      tags,
      ingredients,
    });

    if (!newRecipe) {
      throw createHttpError(500, "Failed to create recipe");
    }

    const responseData = {
      id: newRecipe.id,
      title: newRecipe.title,
      servings: newRecipe.servings,
      prepTime: newRecipe.prepTime,
      cookTime: newRecipe.cookTime,
      restTime: newRecipe.restTime,
      imageUrl: newRecipe.imageKey ? buildImageUrl(newRecipe.imageKey) : null,
      createdAt: newRecipe.createdAt,
      updatedAt: newRecipe.updatedAt,
      creatorId: newRecipe.creatorId,
      steps: formatSteps(newRecipe.steps),
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
  servings?: number;
  prepTime?: number | null;
  cookTime?: number | null;
  restTime?: number | null;
  steps?: StepInput[];
  tags?: string[];
  ingredients?: IngredientInput[];
}

export const updateRecipe: RequestHandler<
  UpdateRecipeParams,
  unknown,
  UpdateRecipeBody,
  unknown
> = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const { title, servings, prepTime, cookTime, restTime, steps, tags, ingredients } = req.body;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    if (title !== undefined) {
      assertString(title, "title");
      if (!title.trim()) {
        throw createHttpError(400, RECIPE_003);
      }
      validateStringLength(title.trim(), "title", 1, MAX_TITLE_LENGTH);
    }

    if (servings !== undefined && !validateServings(servings)) {
      throw createHttpError(400, RECIPE_006);
    }

    if (steps !== undefined && !validateSteps(steps)) {
      throw createHttpError(400, RECIPE_007);
    }

    if (prepTime !== undefined && !validateTime(prepTime)) {
      throw createHttpError(400, RECIPE_008);
    }

    if (cookTime !== undefined && !validateTime(cookTime)) {
      throw createHttpError(400, RECIPE_008);
    }

    if (restTime !== undefined && !validateTime(restTime)) {
      throw createHttpError(400, RECIPE_008);
    }

    if (tags !== undefined) {
      assertArray(tags, "tags");
      if (tags.length > MAX_TAGS_PER_RECIPE) {
        throw createHttpError(400, RECIPE_009(MAX_TAGS_PER_RECIPE));
      }
    }

    if (ingredients !== undefined) {
      assertArray(ingredients, "ingredients");
      for (const ing of ingredients) {
        assertString(ing.name, "ingredient name");
        validateQuantity(ing.quantity, "ingredient quantity");
      }
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, deletedAt: null },
    });

    if (!recipe) {
      throw createHttpError(404, RECIPE_001);
    }

    await requireRecipeOwnership(authenticatedUserId, recipe);

    const { result: updatedRecipe, pendingTagIds } = await updateRecipeService(
      recipeId,
      {
        title,
        servings,
        prepTime,
        cookTime,
        restTime,
        steps,
        tags,
        ingredients,
      },
      recipe,
      authenticatedUserId
    );

    if (!updatedRecipe) {
      throw createHttpError(500, "Failed to update recipe");
    }

    // Notifier les moderateurs si des tags PENDING ont ete crees
    if (pendingTagIds.length > 0 && recipe.communityId) {
      const moderatorIds = await getModeratorIdsForTagNotification(recipe.communityId);
      if (moderatorIds.length > 0) {
        appEvents.emitActivity({
          type: "tag:pending",
          userId: authenticatedUserId,
          communityId: recipe.communityId,
          recipeId,
          targetUserIds: moderatorIds,
          metadata: { pendingTagIds },
        });
      }
    }

    const responseData = {
      id: updatedRecipe.id,
      title: updatedRecipe.title,
      servings: updatedRecipe.servings,
      prepTime: updatedRecipe.prepTime,
      cookTime: updatedRecipe.cookTime,
      restTime: updatedRecipe.restTime,
      imageUrl: updatedRecipe.imageKey ? buildImageUrl(updatedRecipe.imageKey) : null,
      createdAt: updatedRecipe.createdAt,
      updatedAt: updatedRecipe.updatedAt,
      creatorId: updatedRecipe.creatorId,
      steps: formatSteps(updatedRecipe.steps),
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
      throw createHttpError(404, RECIPE_001);
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

import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { Prisma } from "@prisma/client";
import { isValidHttpUrl, validateServings, validateTime, validateSteps, StepInput } from "../util/validation";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { RECIPE_TAGS_SELECT } from "../util/prismaSelects";
import { formatTags, formatIngredients, formatSteps } from "../util/responseFormatters";
import { createCommunityRecipe as createCommunityRecipeService } from "../services/communityRecipeService";
import appEvents from "../services/eventEmitter";
import { getModeratorIdsForTagNotification } from "../services/notificationService";

interface IngredientInput {
  name: string;
  quantity?: number;
  unitId?: string;
}

interface CreateCommunityRecipeBody {
  title?: string;
  servings?: number;
  prepTime?: number | null;
  cookTime?: number | null;
  restTime?: number | null;
  steps?: StepInput[];
  imageUrl?: string;
  tags?: string[];
  ingredients?: IngredientInput[];
}

export const createCommunityRecipe: RequestHandler<
  { communityId: string },
  unknown,
  CreateCommunityRecipeBody,
  unknown
> = async (req, res, next) => {
  const { title, servings, prepTime, cookTime, restTime, steps, imageUrl, tags = [], ingredients = [] } = req.body;
  const authenticatedUserId = req.session.userId;
  const communityId = req.params.communityId;

  try {
    assertIsDefine(authenticatedUserId);

    if (!title?.trim()) {
      throw createHttpError(400, "RECIPE_003: Title required");
    }

    if (!validateServings(servings)) {
      throw createHttpError(400, "RECIPE_006: Servings must be an integer between 1 and 100");
    }

    if (!validateSteps(steps)) {
      throw createHttpError(400, "RECIPE_007: At least one step required, each instruction non-empty (max 5000 chars)");
    }

    if (!validateTime(prepTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid prep time (integer 0-10000)");
    }

    if (!validateTime(cookTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid cook time (integer 0-10000)");
    }

    if (!validateTime(restTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid rest time (integer 0-10000)");
    }

    if (!isValidHttpUrl(imageUrl)) {
      throw createHttpError(400, "RECIPE_005: Invalid image URL");
    }

    const result = await createCommunityRecipeService(authenticatedUserId, communityId, {
      title, servings, prepTime, cookTime, restTime, steps, imageUrl, tags, ingredients,
    });

    if (!result.personal || !result.community) {
      throw createHttpError(500, "Failed to create community recipe");
    }

    const formatRecipe = (recipe: NonNullable<typeof result.personal>) => ({
      id: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      restTime: recipe.restTime,
      imageUrl: recipe.imageUrl,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      creatorId: recipe.creatorId,
      communityId: recipe.communityId,
      originRecipeId: recipe.originRecipeId,
      steps: formatSteps(recipe.steps),
      tags: formatTags(recipe.tags),
      ingredients: formatIngredients(recipe.ingredients),
    });

    appEvents.emitActivity({
      type: "RECIPE_CREATED",
      userId: authenticatedUserId,
      communityId,
      recipeId: result.community.id,
    });

    // Notifier les moderateurs si des tags PENDING ont ete crees
    if (result.pendingTagIds.length > 0) {
      const moderatorIds = await getModeratorIdsForTagNotification(communityId);
      if (moderatorIds.length > 0) {
        appEvents.emitActivity({
          type: "tag:pending",
          userId: authenticatedUserId,
          communityId,
          recipeId: result.community.id,
          targetUserIds: moderatorIds,
          metadata: { pendingTagIds: result.pendingTagIds },
        });
      }
    }

    res.status(201).json({
      personal: formatRecipe(result.personal),
      community: formatRecipe(result.community),
    });
  } catch (error) {
    next(error);
  }
};

interface GetCommunityRecipesQuery {
  limit?: string;
  offset?: string;
  tags?: string;
  ingredients?: string;
  search?: string;
}

export const getCommunityRecipes: RequestHandler<
  { communityId: string },
  unknown,
  unknown,
  GetCommunityRecipesQuery
> = async (req, res, next) => {
  const communityId = req.params.communityId;
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
    const whereClause: Prisma.RecipeWhereInput = {
      communityId,
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
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
          creatorId: true,
          sharedFromCommunityId: true,
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
          sharedFromCommunity: {
            select: {
              id: true,
              name: true,
            },
          },
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
      imageUrl: recipe.imageUrl,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      creatorId: recipe.creatorId,
      creator: recipe.creator,
      sharedFromCommunityId: recipe.sharedFromCommunityId,
      sharedFromCommunity: recipe.sharedFromCommunity,
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

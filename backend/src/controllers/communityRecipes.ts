import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";

interface IngredientInput {
  name: string;
  quantity?: string;
}

interface CreateCommunityRecipeBody {
  title?: string;
  content?: string;
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
  const { title, content, imageUrl, tags = [], ingredients = [] } = req.body;
  const authenticatedUserId = req.session.userId;
  const communityId = req.params.communityId;

  try {
    assertIsDefine(authenticatedUserId);

    if (!title?.trim()) {
      throw createHttpError(400, "RECIPE_003: Title required");
    }

    if (!content?.trim()) {
      throw createHttpError(400, "RECIPE_004: Content required");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Creer la recette personnelle (communityId: null)
      const personalRecipe = await tx.recipe.create({
        data: {
          title: title.trim(),
          content: content.trim(),
          imageUrl: imageUrl?.trim() || null,
          creatorId: authenticatedUserId,
          communityId: null,
        },
      });

      // 2. Creer la copie communautaire liee a la recette perso
      const communityRecipe = await tx.recipe.create({
        data: {
          title: title.trim(),
          content: content.trim(),
          imageUrl: imageUrl?.trim() || null,
          creatorId: authenticatedUserId,
          communityId,
          originRecipeId: personalRecipe.id,
        },
      });

      // 3. Gerer tags/ingredients sur les DEUX recettes
      if (tags.length > 0) {
        const normalizedTags = [
          ...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
        ];

        for (const tagName of normalizedTags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
          });

          await tx.recipeTag.createMany({
            data: [
              { recipeId: personalRecipe.id, tagId: tag.id },
              { recipeId: communityRecipe.id, tagId: tag.id },
            ],
          });
        }
      }

      if (ingredients.length > 0) {
        for (let i = 0; i < ingredients.length; i++) {
          const ing = ingredients[i];
          const ingredientName = ing.name.trim().toLowerCase();

          if (!ingredientName) continue;

          const ingredient = await tx.ingredient.upsert({
            where: { name: ingredientName },
            create: { name: ingredientName },
            update: {},
          });

          await tx.recipeIngredient.createMany({
            data: [
              {
                recipeId: personalRecipe.id,
                ingredientId: ingredient.id,
                quantity: ing.quantity?.trim() || null,
                order: i,
              },
              {
                recipeId: communityRecipe.id,
                ingredientId: ingredient.id,
                quantity: ing.quantity?.trim() || null,
                order: i,
              },
            ],
          });
        }
      }

      // 4. Creer ActivityLog
      await tx.activityLog.create({
        data: {
          type: "RECIPE_CREATED",
          userId: authenticatedUserId,
          communityId,
          recipeId: communityRecipe.id,
        },
      });

      // Fetch les deux recettes avec leurs relations
      const recipeSelect = {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        creatorId: true,
        communityId: true,
        originRecipeId: true,
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
            order: "asc" as const,
          },
        },
      };

      const [personal, community] = await Promise.all([
        tx.recipe.findUnique({
          where: { id: personalRecipe.id },
          select: recipeSelect,
        }),
        tx.recipe.findUnique({
          where: { id: communityRecipe.id },
          select: recipeSelect,
        }),
      ]);

      return { personal, community };
    });

    if (!result.personal || !result.community) {
      throw createHttpError(500, "Failed to create community recipe");
    }

    const formatRecipe = (recipe: NonNullable<typeof result.personal>) => ({
      id: recipe.id,
      title: recipe.title,
      content: recipe.content,
      imageUrl: recipe.imageUrl,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      creatorId: recipe.creatorId,
      communityId: recipe.communityId,
      originRecipeId: recipe.originRecipeId,
      tags: recipe.tags.map((rt) => rt.tag),
      ingredients: recipe.ingredients.map((ri) => ({
        id: ri.id,
        name: ri.ingredient.name,
        ingredientId: ri.ingredient.id,
        quantity: ri.quantity,
        order: ri.order,
      })),
    });

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
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || "20", 10), 1),
    100
  );
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
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
      creatorId: recipe.creatorId,
      creator: recipe.creator,
      sharedFromCommunityId: recipe.sharedFromCommunityId,
      sharedFromCommunity: recipe.sharedFromCommunity,
      tags: recipe.tags.map((rt) => rt.tag),
    }));

    res.status(200).json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + recipes.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

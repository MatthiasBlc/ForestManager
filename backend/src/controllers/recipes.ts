import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";

interface GetRecipesQuery {
  limit?: string;
  offset?: string;
  tags?: string;
  ingredients?: string;
  search?: string;
}

export const getRecipes: RequestHandler<unknown, unknown, unknown, GetRecipesQuery> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
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

    // Verification d'acces selon le type de recette
    if (recipe.communityId === null) {
      // Recette personnelle : seul le createur peut y acceder
      if (recipe.creatorId !== authenticatedUserId) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }
    } else {
      // Recette communautaire : l'utilisateur doit etre membre de la communaute
      const membership = await prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: recipe.communityId,
          deletedAt: null,
        },
      });

      if (!membership) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }
    }

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
      tags: recipe.tags.map((rt) => rt.tag),
      ingredients: recipe.ingredients.map((ri) => ({
        id: ri.id,
        name: ri.ingredient.name,
        ingredientId: ri.ingredient.id,
        quantity: ri.quantity,
        order: ri.order,
      })),
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

    const newRecipe = await prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          title: title.trim(),
          content: content.trim(),
          imageUrl: imageUrl?.trim() || null,
          creatorId: authenticatedUserId,
        },
      });

      if (tags.length > 0) {
        const normalizedTags = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];

        for (const tagName of normalizedTags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
          });

          await tx.recipeTag.create({
            data: {
              recipeId: recipe.id,
              tagId: tag.id,
            },
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

          await tx.recipeIngredient.create({
            data: {
              recipeId: recipe.id,
              ingredientId: ingredient.id,
              quantity: ing.quantity?.trim() || null,
              order: i,
            },
          });
        }
      }

      return tx.recipe.findUnique({
        where: { id: recipe.id },
        select: {
          id: true,
          title: true,
          content: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
          creatorId: true,
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
      tags: newRecipe.tags.map((rt) => rt.tag),
      ingredients: newRecipe.ingredients.map((ri) => ({
        id: ri.id,
        name: ri.ingredient.name,
        ingredientId: ri.ingredient.id,
        quantity: ri.quantity,
        order: ri.order,
      })),
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

    if (recipe.communityId === null) {
      // Recette personnelle : seul le createur peut modifier
      if (recipe.creatorId !== authenticatedUserId) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }
    } else {
      // Recette communautaire : createur + membre de la communaute
      if (recipe.creatorId !== authenticatedUserId) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }

      const membership = await prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: recipe.communityId,
          deletedAt: null,
        },
      });

      if (!membership) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }
    }

    const updatedRecipe = await prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(content !== undefined && { content: content.trim() }),
          ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() || null }),
        },
      });

      if (tags !== undefined) {
        await tx.recipeTag.deleteMany({
          where: { recipeId },
        });

        const normalizedTags = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];

        for (const tagName of normalizedTags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
          });

          await tx.recipeTag.create({
            data: {
              recipeId,
              tagId: tag.id,
            },
          });
        }
      }

      if (ingredients !== undefined) {
        await tx.recipeIngredient.deleteMany({
          where: { recipeId },
        });

        for (let i = 0; i < ingredients.length; i++) {
          const ing = ingredients[i];
          const ingredientName = ing.name.trim().toLowerCase();

          if (!ingredientName) continue;

          const ingredient = await tx.ingredient.upsert({
            where: { name: ingredientName },
            create: { name: ingredientName },
            update: {},
          });

          await tx.recipeIngredient.create({
            data: {
              recipeId,
              ingredientId: ingredient.id,
              quantity: ing.quantity?.trim() || null,
              order: i,
            },
          });
        }
      }

      // --- Synchronisation bidirectionnelle (titre, contenu, imageUrl, ingredients) ---
      // Tags sont LOCAUX : pas synchronises
      // Forks (sharedFromCommunityId != null) et variantes (isVariant = true) exclus

      const syncData: Record<string, unknown> = {};
      if (title !== undefined) syncData.title = title.trim();
      if (content !== undefined) syncData.content = content.trim();
      if (imageUrl !== undefined) syncData.imageUrl = imageUrl?.trim() || null;

      const hasSyncableFields = Object.keys(syncData).length > 0 || ingredients !== undefined;

      if (hasSyncableFields) {
        // Trouver les recettes liees a synchroniser
        let linkedRecipeIds: string[] = [];

        if (recipe.communityId === null) {
          // Recette personnelle : synchroniser toutes les copies communautaires
          const copies = await tx.recipe.findMany({
            where: {
              originRecipeId: recipeId,
              communityId: { not: null },
              deletedAt: null,
              isVariant: false,
              sharedFromCommunityId: null,
            },
            select: { id: true },
          });
          linkedRecipeIds = copies.map((c) => c.id);
        } else if (recipe.originRecipeId && !recipe.sharedFromCommunityId && !recipe.isVariant) {
          // Recette communautaire (pas un fork, pas une variante) : synchroniser la recette perso + autres copies
          linkedRecipeIds.push(recipe.originRecipeId);

          const otherCopies = await tx.recipe.findMany({
            where: {
              originRecipeId: recipe.originRecipeId,
              id: { not: recipeId },
              deletedAt: null,
              isVariant: false,
              sharedFromCommunityId: null,
            },
            select: { id: true },
          });
          linkedRecipeIds.push(...otherCopies.map((c) => c.id));
        }

        if (linkedRecipeIds.length > 0) {
          // Mettre a jour titre, contenu, imageUrl
          if (Object.keys(syncData).length > 0) {
            await tx.recipe.updateMany({
              where: { id: { in: linkedRecipeIds } },
              data: syncData,
            });
          }

          // Synchroniser les ingredients
          if (ingredients !== undefined) {
            for (const linkedId of linkedRecipeIds) {
              await tx.recipeIngredient.deleteMany({
                where: { recipeId: linkedId },
              });

              for (let i = 0; i < ingredients.length; i++) {
                const ing = ingredients[i];
                const ingredientName = ing.name.trim().toLowerCase();
                if (!ingredientName) continue;

                const ingredient = await tx.ingredient.upsert({
                  where: { name: ingredientName },
                  create: { name: ingredientName },
                  update: {},
                });

                await tx.recipeIngredient.create({
                  data: {
                    recipeId: linkedId,
                    ingredientId: ingredient.id,
                    quantity: ing.quantity?.trim() || null,
                    order: i,
                  },
                });
              }
            }
          }
        }
      }

      return tx.recipe.findUnique({
        where: { id: recipeId },
        select: {
          id: true,
          title: true,
          content: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
          creatorId: true,
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
    });

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
      tags: updatedRecipe.tags.map((rt) => rt.tag),
      ingredients: updatedRecipe.ingredients.map((ri) => ({
        id: ri.id,
        name: ri.ingredient.name,
        ingredientId: ri.ingredient.id,
        quantity: ri.quantity,
        order: ri.order,
      })),
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

    if (recipe.communityId === null) {
      // Recette personnelle : seul le createur peut supprimer
      if (recipe.creatorId !== authenticatedUserId) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }
    } else {
      // Recette communautaire : createur + membre de la communaute
      if (recipe.creatorId !== authenticatedUserId) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }

      const membership = await prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: recipe.communityId,
          deletedAt: null,
        },
      });

      if (!membership) {
        throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
      }
    }

    await prisma.recipe.update({
      where: { id: recipeId },
      data: { deletedAt: new Date() },
    });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

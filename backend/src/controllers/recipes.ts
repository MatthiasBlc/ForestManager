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

interface GetVariantsQuery {
  limit?: string;
  offset?: string;
}

/**
 * GET /api/recipes/:recipeId/variants
 * Liste les variantes d'une recette (isVariant = true, meme communaute)
 * Tri: par MAX(createdAt, updatedAt) DESC
 */
export const getVariants: RequestHandler<
  { recipeId: string },
  unknown,
  unknown,
  GetVariantsQuery
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

  try {
    assertIsDefine(authenticatedUserId);

    // Recuperer la recette parent
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        deletedAt: null,
      },
      select: {
        id: true,
        communityId: true,
        creatorId: true,
      },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    // Verification d'acces selon le type de recette
    if (recipe.communityId === null) {
      // Recette personnelle : seul le createur peut voir les variantes
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
        throw createHttpError(403, "COMMUNITY_001: Not a member");
      }
    }

    // Construire la clause where pour les variantes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      originRecipeId: recipeId,
      isVariant: true,
      deletedAt: null,
    };

    // Si c'est une recette communautaire, ne retourner que les variantes de la meme communaute
    if (recipe.communityId !== null) {
      whereClause.communityId = recipe.communityId;
    }

    // Recuperer les variantes
    const variants = await prisma.recipe.findMany({
      where: whereClause,
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
        creator: {
          select: {
            id: true,
            username: true,
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
    });

    // Trier par MAX(createdAt, updatedAt) DESC
    const sortedVariants = variants.sort((a, b) => {
      const maxA = a.updatedAt > a.createdAt ? a.updatedAt : a.createdAt;
      const maxB = b.updatedAt > b.createdAt ? b.updatedAt : b.createdAt;
      return maxB.getTime() - maxA.getTime();
    });

    // Appliquer pagination
    const total = sortedVariants.length;
    const paginatedVariants = sortedVariants.slice(offset, offset + limit);

    const data = paginatedVariants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      content: variant.content,
      imageUrl: variant.imageUrl,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      creatorId: variant.creatorId,
      creator: variant.creator,
      communityId: variant.communityId,
      originRecipeId: variant.originRecipeId,
      isVariant: variant.isVariant,
      tags: variant.tags.map((rt) => rt.tag),
    }));

    res.status(200).json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + paginatedVariants.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

interface ShareRecipeBody {
  targetCommunityId: string;
}

/**
 * POST /api/recipes/:recipeId/share
 * Partager (fork) une recette vers une autre communaute
 * Regles:
 * - Recette source doit etre communautaire
 * - User doit etre membre des deux communautes
 * - User doit etre MODERATOR dans une des deux OU createur de la recette
 */
export const shareRecipe: RequestHandler<
  { recipeId: string },
  unknown,
  ShareRecipeBody,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;
  const { targetCommunityId } = req.body;

  try {
    assertIsDefine(authenticatedUserId);

    if (!targetCommunityId?.trim()) {
      throw createHttpError(400, "SHARE_001: Target community ID required");
    }

    // 1. Recuperer la recette source avec ses relations
    const sourceRecipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        communityId: true,
        creatorId: true,
        tags: {
          select: {
            tagId: true,
          },
        },
        ingredients: {
          select: {
            ingredientId: true,
            quantity: true,
            order: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!sourceRecipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    // 2. Verifier que c'est une recette communautaire
    if (sourceRecipe.communityId === null) {
      throw createHttpError(400, "SHARE_002: Cannot share personal recipes");
    }

    // 3. Verifier que la communaute cible n'est pas la meme que la source
    if (sourceRecipe.communityId === targetCommunityId) {
      throw createHttpError(400, "SHARE_003: Cannot share to same community");
    }

    // 4. Verifier que la communaute cible existe
    const targetCommunity = await prisma.community.findFirst({
      where: {
        id: targetCommunityId,
        deletedAt: null,
      },
    });

    if (!targetCommunity) {
      throw createHttpError(404, "COMMUNITY_002: Target community not found");
    }

    // 5. Verifier membership dans les deux communautes
    const [sourceMembership, targetMembership] = await Promise.all([
      prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: sourceRecipe.communityId,
          deletedAt: null,
        },
      }),
      prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: targetCommunityId,
          deletedAt: null,
        },
      }),
    ]);

    if (!sourceMembership) {
      throw createHttpError(403, "COMMUNITY_001: Not a member of source community");
    }

    if (!targetMembership) {
      throw createHttpError(403, "SHARE_004: Not a member of target community");
    }

    // 6. Verifier permission: MODERATOR dans une des deux OU createur de la recette
    const isRecipeCreator = sourceRecipe.creatorId === authenticatedUserId;
    const isModeratorInSource = sourceMembership.role === "MODERATOR";
    const isModeratorInTarget = targetMembership.role === "MODERATOR";

    if (!isRecipeCreator && !isModeratorInSource && !isModeratorInTarget) {
      throw createHttpError(
        403,
        "SHARE_005: Must be recipe creator or moderator in one of the communities"
      );
    }

    // 7. Verifier qu'il n'existe pas deja un partage vers cette communaute
    const existingShare = await prisma.recipe.findFirst({
      where: {
        originRecipeId: sourceRecipe.id,
        communityId: targetCommunityId,
        deletedAt: null,
      },
    });

    if (existingShare) {
      throw createHttpError(400, "SHARE_006: Recipe already shared with this community");
    }

    // 8. Creer le fork dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Creer la nouvelle recette (fork)
      const forkedRecipe = await tx.recipe.create({
        data: {
          title: sourceRecipe.title,
          content: sourceRecipe.content,
          imageUrl: sourceRecipe.imageUrl,
          creatorId: authenticatedUserId,
          communityId: targetCommunityId,
          originRecipeId: sourceRecipe.id,
          sharedFromCommunityId: sourceRecipe.communityId,
          isVariant: false,
        },
      });

      // Copier les tags
      if (sourceRecipe.tags.length > 0) {
        await tx.recipeTag.createMany({
          data: sourceRecipe.tags.map((rt) => ({
            recipeId: forkedRecipe.id,
            tagId: rt.tagId,
          })),
        });
      }

      // Copier les ingredients
      if (sourceRecipe.ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: sourceRecipe.ingredients.map((ri) => ({
            recipeId: forkedRecipe.id,
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            order: ri.order,
          })),
        });
      }

      // Mettre a jour les analytics de la recette source (et de la chaine)
      // Remonter la chaine des originRecipeId pour incrementer tous les ancetres
      const recipesToUpdate: string[] = [sourceRecipe.id];
      let currentRecipeId: string | null = sourceRecipe.id;

      // Remonter la chaine des ancetres
      while (currentRecipeId) {
        const parentRecipe: { originRecipeId: string | null } | null =
          await tx.recipe.findFirst({
            where: { id: currentRecipeId },
            select: { originRecipeId: true },
          });

        if (parentRecipe?.originRecipeId) {
          recipesToUpdate.push(parentRecipe.originRecipeId);
          currentRecipeId = parentRecipe.originRecipeId;
        } else {
          currentRecipeId = null;
        }
      }

      // Incrementer shares et forks pour tous les ancetres
      for (const ancestorId of recipesToUpdate) {
        await tx.recipeAnalytics.upsert({
          where: { recipeId: ancestorId },
          create: {
            recipeId: ancestorId,
            shares: 1,
            forks: 1,
          },
          update: {
            shares: { increment: 1 },
            forks: { increment: 1 },
          },
        });
      }

      // Creer ActivityLog dans la communaute source
      await tx.activityLog.create({
        data: {
          type: "RECIPE_SHARED",
          userId: authenticatedUserId,
          communityId: sourceRecipe.communityId,
          recipeId: sourceRecipe.id,
          metadata: {
            targetCommunityId,
            targetCommunityName: targetCommunity.name,
            forkedRecipeId: forkedRecipe.id,
          },
        },
      });

      // Creer ActivityLog dans la communaute cible
      await tx.activityLog.create({
        data: {
          type: "RECIPE_SHARED",
          userId: authenticatedUserId,
          communityId: targetCommunityId,
          recipeId: forkedRecipe.id,
          metadata: {
            fromCommunityId: sourceRecipe.communityId,
            originRecipeId: sourceRecipe.id,
          },
        },
      });

      // Recuperer la recette forkee avec toutes ses relations
      return tx.recipe.findUnique({
        where: { id: forkedRecipe.id },
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
          sharedFromCommunityId: true,
          isVariant: true,
          community: {
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
    });

    if (!result) {
      throw createHttpError(500, "Failed to share recipe");
    }

    const responseData = {
      id: result.id,
      title: result.title,
      content: result.content,
      imageUrl: result.imageUrl,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      creatorId: result.creatorId,
      communityId: result.communityId,
      community: result.community,
      originRecipeId: result.originRecipeId,
      sharedFromCommunityId: result.sharedFromCommunityId,
      isVariant: result.isVariant,
      tags: result.tags.map((rt) => rt.tag),
      ingredients: result.ingredients.map((ri) => ({
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

interface PublishToCommunityBody {
  communityIds: string[];
}

/**
 * POST /api/recipes/:recipeId/publish
 * Publier une recette personnelle vers une ou plusieurs communautes
 */
export const publishToCommunities: RequestHandler<
  { recipeId: string },
  unknown,
  PublishToCommunityBody,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;
  const { communityIds } = req.body;

  try {
    assertIsDefine(authenticatedUserId);

    if (!communityIds || !Array.isArray(communityIds) || communityIds.length === 0) {
      throw createHttpError(400, "PUBLISH_001: At least one community ID required");
    }

    // Recuperer la recette source
    const sourceRecipe = await prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        creatorId: true,
        communityId: true,
        tags: { select: { tagId: true } },
        ingredients: {
          select: { ingredientId: true, quantity: true, order: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceRecipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    if (sourceRecipe.communityId !== null) {
      throw createHttpError(400, "PUBLISH_002: Can only publish personal recipes");
    }

    if (sourceRecipe.creatorId !== authenticatedUserId) {
      throw createHttpError(403, "RECIPE_002: Cannot access this recipe");
    }

    // Verifier membership dans chaque communaute cible
    const memberships = await prisma.userCommunity.findMany({
      where: {
        userId: authenticatedUserId,
        communityId: { in: communityIds },
        deletedAt: null,
      },
    });

    const memberCommunityIds = new Set(memberships.map((m) => m.communityId));
    for (const cid of communityIds) {
      if (!memberCommunityIds.has(cid)) {
        throw createHttpError(403, `PUBLISH_003: Not a member of community ${cid}`);
      }
    }

    // Filtrer les communautes ou la recette est deja partagee
    const existingCopies = await prisma.recipe.findMany({
      where: {
        originRecipeId: recipeId,
        communityId: { in: communityIds },
        deletedAt: null,
      },
      select: { communityId: true },
    });
    const alreadySharedCommunityIds = new Set(existingCopies.map((r) => r.communityId));
    const newCommunityIds = communityIds.filter((cid) => !alreadySharedCommunityIds.has(cid));

    if (newCommunityIds.length === 0) {
      res.status(200).json({ data: [], message: "Recipe already shared to all selected communities" });
      return;
    }

    const createdRecipes = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const communityId of newCommunityIds) {
        const communityRecipe = await tx.recipe.create({
          data: {
            title: sourceRecipe.title,
            content: sourceRecipe.content,
            imageUrl: sourceRecipe.imageUrl,
            creatorId: authenticatedUserId,
            communityId,
            originRecipeId: sourceRecipe.id,
          },
        });

        // Copier tags
        if (sourceRecipe.tags.length > 0) {
          await tx.recipeTag.createMany({
            data: sourceRecipe.tags.map((rt) => ({
              recipeId: communityRecipe.id,
              tagId: rt.tagId,
            })),
          });
        }

        // Copier ingredients
        if (sourceRecipe.ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: sourceRecipe.ingredients.map((ri) => ({
              recipeId: communityRecipe.id,
              ingredientId: ri.ingredientId,
              quantity: ri.quantity,
              order: ri.order,
            })),
          });
        }

        // ActivityLog
        await tx.activityLog.create({
          data: {
            type: "RECIPE_CREATED",
            userId: authenticatedUserId,
            communityId,
            recipeId: communityRecipe.id,
          },
        });

        results.push(communityRecipe);
      }

      // Fetch les recettes creees avec relations
      return Promise.all(
        results.map((r) =>
          tx.recipe.findUnique({
            where: { id: r.id },
            select: {
              id: true,
              title: true,
              communityId: true,
              community: { select: { id: true, name: true } },
              createdAt: true,
            },
          })
        )
      );
    });

    res.status(201).json({ data: createdRecipes.filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recipes/:recipeId/communities
 * Retourne les communautes ou une recette (ou ses copies/forks) existe
 * Remonte toute la chaine originRecipeId pour couvrir les forks de forks
 */
export const getRecipeCommunities: RequestHandler<
  { recipeId: string },
  unknown,
  unknown,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    // Remonter la chaine originRecipeId jusqu'a la racine
    let rootId = recipe.id;
    let current = recipe;
    while (current.originRecipeId) {
      const parent = await prisma.recipe.findFirst({
        where: { id: current.originRecipeId, deletedAt: null },
      });
      if (!parent) break;
      rootId = parent.id;
      current = parent;
    }

    // Collecter tous les IDs de la famille (racine + toutes les copies/forks recursifs)
    const allIds = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = await prisma.recipe.findMany({
        where: { originRecipeId: parentId, deletedAt: null },
        select: { id: true },
      });
      for (const child of children) {
        if (!allIds.has(child.id)) {
          allIds.add(child.id);
          queue.push(child.id);
        }
      }
    }

    // Trouver toutes les communautes de la famille
    const copies = await prisma.recipe.findMany({
      where: {
        id: { in: Array.from(allIds) },
        deletedAt: null,
        communityId: { not: null },
      },
      select: {
        communityId: true,
        community: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Deduplication par communityId
    const seen = new Set<string>();
    const communities = copies
      .filter((c) => c.community && !seen.has(c.community.id) && seen.add(c.community.id))
      .map((c) => c.community!);

    res.status(200).json({ data: communities });
  } catch (error) {
    next(error);
  }
};

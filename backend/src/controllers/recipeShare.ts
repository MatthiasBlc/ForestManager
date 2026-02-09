import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";

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

import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { formatTags, formatIngredients, formatSteps } from "../util/responseFormatters";
import { buildImageUrl } from "../config/storage";
import { forkRecipe, publishRecipe, getRecipeFamilyCommunities } from "../services/shareService";
import { requireRecipeAccess } from "../services/membershipService";
import appEvents from "../services/eventEmitter";
import { getModeratorIdsForTagNotification } from "../services/notificationService";
import {
  SHARE_002,
  SHARE_003,
  SHARE_004,
  SHARE_005,
  SHARE_006,
  RECIPE_001,
  RECIPE_002,
  COMMUNITY_001,
  COMMUNITY_002,
  PUBLISH_002,
  PUBLISH_003,
} from "../constants/errorCodes";
import { ShareRecipeInput, PublishToCommunityInput } from "../schemas/recipeShare.schema";

/**
 * POST /api/recipes/:recipeId/share
 * Partager (fork) une recette vers une autre communaute
 */
export const shareRecipe: RequestHandler<{ recipeId: string }, unknown, ShareRecipeInput, unknown> =
  async (req, res, next) => {
    const authenticatedUserId = req.session.userId;
    const { recipeId } = req.params;
    const { targetCommunityId } = req.body;

    try {
      assertIsDefine(authenticatedUserId);

      // 1. Recuperer la recette source avec ses relations
      const sourceRecipe = await prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: {
        id: true,
        title: true,
        servings: true,
        prepTime: true,
        cookTime: true,
        restTime: true,
        imageKey: true,
        communityId: true,
        creatorId: true,
        tags: {
          select: {
            tagId: true,
            tag: { select: { id: true, name: true, scope: true, communityId: true } },
          },
        },
        ingredients: {
          select: { ingredientId: true, quantity: true, unitId: true, order: true },
          orderBy: { order: "asc" },
        },
        steps: {
          select: { order: true, instruction: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceRecipe) {
      throw createHttpError(404, RECIPE_001);
    }

    if (sourceRecipe.communityId === null) {
      throw createHttpError(400, SHARE_002);
    }

    if (sourceRecipe.communityId === targetCommunityId) {
      throw createHttpError(400, SHARE_003);
    }

    // Verifier que la communaute cible existe
    const targetCommunity = await prisma.community.findFirst({
      where: { id: targetCommunityId, deletedAt: null },
    });

    if (!targetCommunity) {
      throw createHttpError(404, COMMUNITY_002);
    }

    // Verifier membership dans les deux communautes
    const [sourceMembership, targetMembership] = await Promise.all([
      prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: sourceRecipe.communityId,
          deletedAt: null,
        },
      }),
      prisma.userCommunity.findFirst({
        where: { userId: authenticatedUserId, communityId: targetCommunityId, deletedAt: null },
      }),
    ]);

    if (!sourceMembership) {
      throw createHttpError(403, COMMUNITY_001);
    }

    if (!targetMembership) {
      throw createHttpError(403, SHARE_004);
    }

    // Verifier permission: MODERATOR dans une des deux OU createur de la recette
    const isRecipeCreator = sourceRecipe.creatorId === authenticatedUserId;
    const isModeratorInSource = sourceMembership.role === "MODERATOR";
    const isModeratorInTarget = targetMembership.role === "MODERATOR";

    if (!isRecipeCreator && !isModeratorInSource && !isModeratorInTarget) {
      throw createHttpError(403, SHARE_005);
    }

    // Verifier qu'il n'existe pas deja un partage vers cette communaute
    const existingShare = await prisma.recipe.findFirst({
      where: { originRecipeId: sourceRecipe.id, communityId: targetCommunityId, deletedAt: null },
    });

    if (existingShare) {
      throw createHttpError(400, SHARE_006);
    }

    const { recipe: forkResult, pendingTagIds } = await forkRecipe(
      authenticatedUserId,
      { ...sourceRecipe, communityId: sourceRecipe.communityId },
      targetCommunityId,
      targetCommunity.name
    );

    if (!forkResult) {
      throw createHttpError(500, "Failed to share recipe");
    }

    const responseData = {
      id: forkResult.id,
      title: forkResult.title,
      servings: forkResult.servings,
      prepTime: forkResult.prepTime,
      cookTime: forkResult.cookTime,
      restTime: forkResult.restTime,
      imageUrl: forkResult.imageKey ? buildImageUrl(forkResult.imageKey) : null,
      createdAt: forkResult.createdAt,
      updatedAt: forkResult.updatedAt,
      creatorId: forkResult.creatorId,
      communityId: forkResult.communityId,
      community: forkResult.community,
      originRecipeId: forkResult.originRecipeId,
      sharedFromCommunityId: forkResult.sharedFromCommunityId,
      isVariant: forkResult.isVariant,
      steps: formatSteps(forkResult.steps),
      tags: formatTags(forkResult.tags),
      ingredients: formatIngredients(forkResult.ingredients),
    };

    // Emit to both source and target communities
    appEvents.emitActivity({
      type: "RECIPE_SHARED",
      userId: authenticatedUserId,
      communityId: sourceRecipe.communityId,
      recipeId,
    });
    appEvents.emitActivity({
      type: "RECIPE_SHARED",
      userId: authenticatedUserId,
      communityId: targetCommunityId,
      recipeId: forkResult.id,
    });

    // Notifier les moderateurs si des tags PENDING ont ete crees
    if (pendingTagIds.length > 0) {
      const moderatorIds = await getModeratorIdsForTagNotification(targetCommunityId);
      if (moderatorIds.length > 0) {
        appEvents.emitActivity({
          type: "tag:pending",
          userId: authenticatedUserId,
          communityId: targetCommunityId,
          recipeId: forkResult.id,
          targetUserIds: moderatorIds,
          metadata: { pendingTagIds },
        });
      }
    }

    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/recipes/:recipeId/publish
 * Publier une recette personnelle vers une ou plusieurs communautes
 */
export const publishToCommunities: RequestHandler<
  { recipeId: string },
  unknown,
  PublishToCommunityInput,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;
  const { communityIds } = req.body;

  try {
    assertIsDefine(authenticatedUserId);

    const sourceRecipe = await prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: {
        id: true,
        title: true,
        servings: true,
        prepTime: true,
        cookTime: true,
        restTime: true,
        imageKey: true,
        creatorId: true,
        communityId: true,
        tags: {
          select: {
            tagId: true,
            tag: { select: { id: true, name: true, scope: true, communityId: true } },
          },
        },
        ingredients: {
          select: { ingredientId: true, quantity: true, unitId: true, order: true },
          orderBy: { order: "asc" },
        },
        steps: {
          select: { order: true, instruction: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceRecipe) {
      throw createHttpError(404, RECIPE_001);
    }

    if (sourceRecipe.communityId !== null) {
      throw createHttpError(400, PUBLISH_002);
    }

    if (sourceRecipe.creatorId !== authenticatedUserId) {
      throw createHttpError(403, RECIPE_002);
    }

    // Verifier membership
    const memberships = await prisma.userCommunity.findMany({
      where: { userId: authenticatedUserId, communityId: { in: communityIds }, deletedAt: null },
    });

    const memberCommunityIds = new Set(memberships.map((m) => m.communityId));
    for (const cid of communityIds) {
      if (!memberCommunityIds.has(cid)) {
        throw createHttpError(403, PUBLISH_003(cid));
      }
    }

    // Filtrer les communautes deja partagees
    const existingCopies = await prisma.recipe.findMany({
      where: { originRecipeId: recipeId, communityId: { in: communityIds }, deletedAt: null },
      select: { communityId: true },
    });
    const alreadySharedCommunityIds = new Set(existingCopies.map((r) => r.communityId));
    const newCommunityIds = communityIds.filter((cid) => !alreadySharedCommunityIds.has(cid));

    if (newCommunityIds.length === 0) {
      res
        .status(200)
        .json({ data: [], message: "Recipe already shared to all selected communities" });
      return;
    }

    const { recipes: createdRecipes, pendingTagIds } = await publishRecipe(
      authenticatedUserId,
      sourceRecipe,
      newCommunityIds
    );

    // Notifier les moderateurs si des tags PENDING ont ete crees
    if (pendingTagIds.length > 0) {
      for (const cid of newCommunityIds) {
        const moderatorIds = await getModeratorIdsForTagNotification(cid);
        if (moderatorIds.length > 0) {
          appEvents.emitActivity({
            type: "tag:pending",
            userId: authenticatedUserId,
            communityId: cid,
            recipeId: recipeId,
            targetUserIds: moderatorIds,
            metadata: { pendingTagIds },
          });
        }
      }
    }

    res.status(201).json({ data: createdRecipes.filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recipes/:recipeId/communities
 * Retourne les communautes ou une recette (ou ses copies/forks) existe
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

    // Verifier que l'utilisateur a acces a la recette
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: { creatorId: true, communityId: true },
    });

    if (!recipe) {
      throw createHttpError(404, RECIPE_001);
    }

    await requireRecipeAccess(authenticatedUserId, recipe);

    const communities = await getRecipeFamilyCommunities(recipeId);

    if (communities === null) {
      throw createHttpError(404, RECIPE_001);
    }

    res.status(200).json({ data: communities });
  } catch (error) {
    next(error);
  }
};

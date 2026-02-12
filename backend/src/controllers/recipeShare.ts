import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { formatTags, formatIngredients } from "../util/responseFormatters";
import {
  forkRecipe,
  publishRecipe,
  getRecipeFamilyCommunities,
} from "../services/shareService";
import appEvents from "../services/eventEmitter";

interface ShareRecipeBody {
  targetCommunityId: string;
}

/**
 * POST /api/recipes/:recipeId/share
 * Partager (fork) une recette vers une autre communaute
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
      where: { id: recipeId, deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        communityId: true,
        creatorId: true,
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

    if (sourceRecipe.communityId === null) {
      throw createHttpError(400, "SHARE_002: Cannot share personal recipes");
    }

    if (sourceRecipe.communityId === targetCommunityId) {
      throw createHttpError(400, "SHARE_003: Cannot share to same community");
    }

    // Verifier que la communaute cible existe
    const targetCommunity = await prisma.community.findFirst({
      where: { id: targetCommunityId, deletedAt: null },
    });

    if (!targetCommunity) {
      throw createHttpError(404, "COMMUNITY_002: Target community not found");
    }

    // Verifier membership dans les deux communautes
    const [sourceMembership, targetMembership] = await Promise.all([
      prisma.userCommunity.findFirst({
        where: { userId: authenticatedUserId, communityId: sourceRecipe.communityId, deletedAt: null },
      }),
      prisma.userCommunity.findFirst({
        where: { userId: authenticatedUserId, communityId: targetCommunityId, deletedAt: null },
      }),
    ]);

    if (!sourceMembership) {
      throw createHttpError(403, "COMMUNITY_001: Not a member of source community");
    }

    if (!targetMembership) {
      throw createHttpError(403, "SHARE_004: Not a member of target community");
    }

    // Verifier permission: MODERATOR dans une des deux OU createur de la recette
    const isRecipeCreator = sourceRecipe.creatorId === authenticatedUserId;
    const isModeratorInSource = sourceMembership.role === "MODERATOR";
    const isModeratorInTarget = targetMembership.role === "MODERATOR";

    if (!isRecipeCreator && !isModeratorInSource && !isModeratorInTarget) {
      throw createHttpError(
        403,
        "SHARE_005: Must be recipe creator or moderator in one of the communities"
      );
    }

    // Verifier qu'il n'existe pas deja un partage vers cette communaute
    const existingShare = await prisma.recipe.findFirst({
      where: { originRecipeId: sourceRecipe.id, communityId: targetCommunityId, deletedAt: null },
    });

    if (existingShare) {
      throw createHttpError(400, "SHARE_006: Recipe already shared with this community");
    }

    const result = await forkRecipe(
      authenticatedUserId,
      { ...sourceRecipe, communityId: sourceRecipe.communityId },
      targetCommunityId,
      targetCommunity.name
    );

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
      tags: formatTags(result.tags),
      ingredients: formatIngredients(result.ingredients),
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
      recipeId: result.id,
    });

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

    // Verifier membership
    const memberships = await prisma.userCommunity.findMany({
      where: { userId: authenticatedUserId, communityId: { in: communityIds }, deletedAt: null },
    });

    const memberCommunityIds = new Set(memberships.map((m) => m.communityId));
    for (const cid of communityIds) {
      if (!memberCommunityIds.has(cid)) {
        throw createHttpError(403, `PUBLISH_003: Not a member of community ${cid}`);
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
      res.status(200).json({ data: [], message: "Recipe already shared to all selected communities" });
      return;
    }

    const createdRecipes = await publishRecipe(authenticatedUserId, sourceRecipe, newCommunityIds);

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

    const communities = await getRecipeFamilyCommunities(recipeId);

    if (communities === null) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    res.status(200).json({ data: communities });
  } catch (error) {
    next(error);
  }
};

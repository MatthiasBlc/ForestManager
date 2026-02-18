import { RequestHandler } from "express";
import prisma from "../util/db";
import { Prisma } from "@prisma/client";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { requireMembership } from "../services/membershipService";
import {
  createTagSuggestion as createTagSuggestionService,
  acceptTagSuggestion as acceptTagSuggestionService,
  rejectTagSuggestion as rejectTagSuggestionService,
} from "../services/tagSuggestionService";
import appEvents from "../services/eventEmitter";
import { getModeratorIdsForTagNotification } from "../services/notificationService";

const MAX_TAGS_PER_RECIPE = 10;

interface CreateTagSuggestionBody {
  tagName?: string;
}

/**
 * POST /api/recipes/:recipeId/tag-suggestions
 * Suggerer un tag sur une recette communautaire d'autrui
 */
export const createTagSuggestion: RequestHandler<
  { recipeId: string },
  unknown,
  CreateTagSuggestionBody,
  unknown
> = async (req, res, next) => {
  const { tagName } = req.body;
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    // Validation tagName
    if (!tagName || typeof tagName !== "string" || tagName.trim().length === 0) {
      throw createHttpError(400, "TAG_001: Tag name is required");
    }

    const normalized = tagName.trim().toLowerCase();
    if (normalized.length < 2 || normalized.length > 50) {
      throw createHttpError(400, "TAG_001: Tag name must be between 2 and 50 characters");
    }

    // Recuperer la recette
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: {
        id: true,
        communityId: true,
        creatorId: true,
        _count: { select: { tags: true } },
      },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    // Doit etre une recette communautaire
    if (!recipe.communityId) {
      throw createHttpError(400, "TAG_007: Cannot suggest tags on personal recipes");
    }

    // Verifier membership
    await requireMembership(authenticatedUserId, recipe.communityId);

    // Bloquer auto-suggestion
    if (recipe.creatorId === authenticatedUserId) {
      throw createHttpError(400, "TAG_007: Cannot suggest tags on your own recipe");
    }

    // Verifier doublon
    const existing = await prisma.tagSuggestion.findUnique({
      where: {
        recipeId_tagName_suggestedById: {
          recipeId,
          tagName: normalized,
          suggestedById: authenticatedUserId,
        },
      },
    });
    if (existing) {
      throw createHttpError(409, "TAG_006: You already suggested this tag on this recipe");
    }

    // Verifier max tags sur la recette
    if (recipe._count.tags >= MAX_TAGS_PER_RECIPE) {
      throw createHttpError(400, "TAG_003: Maximum 10 tags per recipe");
    }

    // Creer la suggestion
    const suggestion = await prisma.$transaction(async (tx) => {
      return createTagSuggestionService(tx, recipeId, normalized, authenticatedUserId);
    });

    // Notifier le owner
    appEvents.emitActivity({
      type: "TAG_SUGGESTION_CREATED",
      userId: authenticatedUserId,
      communityId: recipe.communityId,
      recipeId,
      targetUserIds: [recipe.creatorId],
      metadata: { suggestionId: suggestion.id, tagName: normalized },
    });

    res.status(201).json(suggestion);
  } catch (error) {
    next(error);
  }
};

interface GetTagSuggestionsQuery {
  status?: string;
  limit?: string;
  offset?: string;
}

/**
 * GET /api/recipes/:recipeId/tag-suggestions
 * Lister les suggestions de tags sur une recette
 */
export const getTagSuggestions: RequestHandler<
  { recipeId: string },
  unknown,
  unknown,
  GetTagSuggestionsQuery
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;
  const statusFilter = req.query.status?.toUpperCase();
  const { limit, offset } = parsePagination(req.query);

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      select: { id: true, communityId: true },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    if (!recipe.communityId) {
      throw createHttpError(400, "TAG_007: No tag suggestions on personal recipes");
    }

    await requireMembership(authenticatedUserId, recipe.communityId);

    const whereClause: Prisma.TagSuggestionWhereInput = { recipeId };

    const validStatuses = ["PENDING_OWNER", "PENDING_MODERATOR", "APPROVED", "REJECTED"];
    if (statusFilter && validStatuses.includes(statusFilter)) {
      whereClause.status = statusFilter as any;
    }

    const [suggestions, total] = await Promise.all([
      prisma.tagSuggestion.findMany({
        where: whereClause,
        select: {
          id: true,
          recipeId: true,
          tagName: true,
          status: true,
          createdAt: true,
          decidedAt: true,
          suggestedBy: {
            select: { id: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.tagSuggestion.count({ where: whereClause }),
    ]);

    res.status(200).json({
      data: suggestions,
      pagination: buildPaginationMeta(total, limit, offset, suggestions.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tag-suggestions/:id/accept
 * Le proprietaire de la recette accepte la suggestion
 */
export const acceptTagSuggestion: RequestHandler<
  { id: string },
  unknown,
  unknown,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { id } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    const suggestion = await prisma.tagSuggestion.findUnique({
      where: { id },
      include: {
        recipe: {
          select: { id: true, communityId: true, creatorId: true, deletedAt: true },
        },
      },
    });

    if (!suggestion) {
      throw createHttpError(404, "TAG_007: Tag suggestion not found");
    }

    // Recette orpheline -> auto-reject
    if (!suggestion.recipe.creatorId || suggestion.recipe.deletedAt) {
      await prisma.tagSuggestion.update({
        where: { id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      throw createHttpError(400, "TAG_007: Recipe is no longer available");
    }

    // Verifier que c'est le owner
    if (suggestion.recipe.creatorId !== authenticatedUserId) {
      throw createHttpError(403, "RECIPE_002: Only the recipe owner can accept suggestions");
    }

    // Verifier statut
    if (suggestion.status !== "PENDING_OWNER") {
      throw createHttpError(400, "TAG_007: Suggestion already decided");
    }

    const result = await acceptTagSuggestionService(id, suggestion, authenticatedUserId);

    appEvents.emitActivity({
      type: "TAG_SUGGESTION_ACCEPTED",
      userId: authenticatedUserId,
      communityId: suggestion.recipe.communityId,
      recipeId: suggestion.recipeId,
      targetUserIds: [suggestion.suggestedById],
      metadata: { suggestionId: id, tagName: suggestion.tagName },
    });

    // Si la suggestion est passee en PENDING_MODERATOR, notifier les moderateurs
    if (result.status === "PENDING_MODERATOR" && suggestion.recipe.communityId) {
      const moderatorIds = await getModeratorIdsForTagNotification(
        suggestion.recipe.communityId
      );
      if (moderatorIds.length > 0) {
        appEvents.emitActivity({
          type: "tag-suggestion:pending-mod",
          userId: authenticatedUserId,
          communityId: suggestion.recipe.communityId,
          recipeId: suggestion.recipeId,
          targetUserIds: moderatorIds,
          metadata: { suggestionId: id, tagName: suggestion.tagName },
        });
      }
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tag-suggestions/:id/reject
 * Le proprietaire de la recette rejette la suggestion
 */
export const rejectTagSuggestion: RequestHandler<
  { id: string },
  unknown,
  unknown,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { id } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    const suggestion = await prisma.tagSuggestion.findUnique({
      where: { id },
      include: {
        recipe: {
          select: { id: true, communityId: true, creatorId: true, deletedAt: true },
        },
      },
    });

    if (!suggestion) {
      throw createHttpError(404, "TAG_007: Tag suggestion not found");
    }

    // Recette orpheline -> auto-reject
    if (!suggestion.recipe.creatorId || suggestion.recipe.deletedAt) {
      await prisma.tagSuggestion.update({
        where: { id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      throw createHttpError(400, "TAG_007: Recipe is no longer available");
    }

    // Verifier que c'est le owner
    if (suggestion.recipe.creatorId !== authenticatedUserId) {
      throw createHttpError(403, "RECIPE_002: Only the recipe owner can reject suggestions");
    }

    // Verifier statut
    if (suggestion.status !== "PENDING_OWNER") {
      throw createHttpError(400, "TAG_007: Suggestion already decided");
    }

    const result = await rejectTagSuggestionService(
      id,
      authenticatedUserId,
      suggestion.recipe.communityId,
      suggestion.recipeId
    );

    appEvents.emitActivity({
      type: "TAG_SUGGESTION_REJECTED",
      userId: authenticatedUserId,
      communityId: suggestion.recipe.communityId,
      recipeId: suggestion.recipeId,
      targetUserIds: [suggestion.suggestedById],
      metadata: { suggestionId: id, tagName: suggestion.tagName },
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

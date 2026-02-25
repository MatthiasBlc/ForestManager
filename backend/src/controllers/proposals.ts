import { RequestHandler } from "express";
import prisma from "../util/db";
import { Prisma } from "@prisma/client";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { requireMembership } from "../services/membershipService";
import { acceptProposal as acceptProposalService, rejectProposal as rejectProposalService } from "../services/proposalService";
import appEvents from "../services/eventEmitter";
import { IngredientInput, upsertProposalIngredients, upsertProposalSteps } from "../services/recipeService";
import { PROPOSAL_INGREDIENTS_SELECT, PROPOSAL_STEPS_SELECT } from "../util/prismaSelects";
import { validateServings, validateTime, validateSteps, StepInput } from "../util/validation";

interface CreateProposalBody {
  proposedTitle?: string;
  proposedServings?: number | null;
  proposedPrepTime?: number | null;
  proposedCookTime?: number | null;
  proposedRestTime?: number | null;
  proposedSteps?: StepInput[];
  proposedIngredients?: IngredientInput[];
}

const PROPOSAL_RESPONSE_SELECT = {
  id: true,
  proposedTitle: true,
  proposedServings: true,
  proposedPrepTime: true,
  proposedCookTime: true,
  proposedRestTime: true,
  status: true,
  createdAt: true,
  decidedAt: true,
  recipeId: true,
  proposerId: true,
  proposer: {
    select: {
      id: true,
      username: true,
    },
  },
  proposedSteps: PROPOSAL_STEPS_SELECT,
  proposedIngredients: PROPOSAL_INGREDIENTS_SELECT,
};

/**
 * POST /api/recipes/:recipeId/proposals
 * Creer une proposition de modification sur une recette communautaire
 */
export const createProposal: RequestHandler<
  { recipeId: string },
  unknown,
  CreateProposalBody,
  unknown
> = async (req, res, next) => {
  const { proposedTitle, proposedServings, proposedPrepTime, proposedCookTime, proposedRestTime, proposedSteps, proposedIngredients } = req.body;
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    // Validation des champs requis
    if (!proposedTitle?.trim()) {
      throw createHttpError(400, "RECIPE_003: Title required");
    }

    if (!validateSteps(proposedSteps)) {
      throw createHttpError(400, "RECIPE_007: At least one step required, each instruction non-empty (max 5000 chars)");
    }

    if (proposedServings !== undefined && proposedServings !== null && !validateServings(proposedServings)) {
      throw createHttpError(400, "RECIPE_006: Servings must be an integer between 1 and 100");
    }

    if (proposedPrepTime !== undefined && !validateTime(proposedPrepTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid prep time (integer 0-10000)");
    }

    if (proposedCookTime !== undefined && !validateTime(proposedCookTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid cook time (integer 0-10000)");
    }

    if (proposedRestTime !== undefined && !validateTime(proposedRestTime)) {
      throw createHttpError(400, "RECIPE_008: Invalid rest time (integer 0-10000)");
    }

    // Validation du nombre d'ingredients
    if (proposedIngredients && proposedIngredients.length > 50) {
      throw createHttpError(400, "INGREDIENT_003: Too many ingredients (max 50)");
    }

    // Recuperer la recette avec sa communaute
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

    // Verifier que c'est une recette communautaire
    if (!recipe.communityId) {
      throw createHttpError(
        400,
        "PROPOSAL_001: Cannot propose on personal recipe"
      );
    }

    await requireMembership(authenticatedUserId, recipe.communityId!);

    // Verifier que l'utilisateur ne propose pas sur sa propre recette
    if (recipe.creatorId === authenticatedUserId) {
      throw createHttpError(
        400,
        "PROPOSAL_001: Cannot propose on your own recipe"
      );
    }

    // Creer la proposition
    const proposal = await prisma.$transaction(async (tx) => {
      const newProposal = await tx.recipeUpdateProposal.create({
        data: {
          proposedTitle: proposedTitle.trim(),
          proposedServings: proposedServings ?? null,
          proposedPrepTime: proposedPrepTime ?? null,
          proposedCookTime: proposedCookTime ?? null,
          proposedRestTime: proposedRestTime ?? null,
          recipeId,
          proposerId: authenticatedUserId,
        },
        select: { id: true },
      });

      // Stocker les steps proposes
      await upsertProposalSteps(tx, newProposal.id, proposedSteps);

      // Stocker les ingredients proposes
      if (proposedIngredients && proposedIngredients.length > 0) {
        await upsertProposalIngredients(tx, newProposal.id, proposedIngredients, authenticatedUserId);
      }

      // Creer ActivityLog
      await tx.activityLog.create({
        data: {
          type: "VARIANT_PROPOSED",
          userId: authenticatedUserId,
          communityId: recipe.communityId,
          recipeId,
          metadata: { proposalId: newProposal.id },
        },
      });

      const created = await tx.recipeUpdateProposal.findUnique({
        where: { id: newProposal.id },
        select: PROPOSAL_RESPONSE_SELECT,
      });
      // Ne peut pas etre null : on vient de le creer
      return created!;
    });

    appEvents.emitActivity({
      type: "VARIANT_PROPOSED",
      userId: authenticatedUserId,
      communityId: recipe.communityId,
      recipeId,
      targetUserIds: [recipe.creatorId],
      metadata: { proposalId: proposal.id },
    });

    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
};

interface GetProposalsQuery {
  status?: string;
  limit?: string;
  offset?: string;
}

/**
 * GET /api/recipes/:recipeId/proposals
 * Lister les propositions d'une recette
 */
export const getProposals: RequestHandler<
  { recipeId: string },
  unknown,
  unknown,
  GetProposalsQuery
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;
  const statusFilter = req.query.status?.toUpperCase();
  const { limit, offset } = parsePagination(req.query);

  try {
    assertIsDefine(authenticatedUserId);

    // Recuperer la recette
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        deletedAt: null,
      },
      select: {
        id: true,
        communityId: true,
      },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    // Verifier que c'est une recette communautaire
    if (!recipe.communityId) {
      throw createHttpError(
        400,
        "PROPOSAL_001: Cannot list proposals on personal recipe"
      );
    }

    await requireMembership(authenticatedUserId, recipe.communityId!);

    // Construire la clause where
    const whereClause: Prisma.RecipeUpdateProposalWhereInput = {
      recipeId,
      deletedAt: null,
    };

    if (statusFilter && ["PENDING", "ACCEPTED", "REJECTED"].includes(statusFilter)) {
      whereClause.status = statusFilter as "PENDING" | "ACCEPTED" | "REJECTED";
    }

    // Recuperer les propositions
    const [proposals, total] = await Promise.all([
      prisma.recipeUpdateProposal.findMany({
        where: whereClause,
        select: PROPOSAL_RESPONSE_SELECT,
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.recipeUpdateProposal.count({ where: whereClause }),
    ]);

    res.status(200).json({
      data: proposals,
      pagination: buildPaginationMeta(total, limit, offset, proposals.length),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/proposals/:proposalId
 * Recuperer le detail d'une proposition
 */
export const getProposal: RequestHandler<
  { proposalId: string },
  unknown,
  unknown,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { proposalId } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    // Recuperer la proposition avec la recette
    const proposal = await prisma.recipeUpdateProposal.findFirst({
      where: {
        id: proposalId,
        deletedAt: null,
      },
      select: {
        ...PROPOSAL_RESPONSE_SELECT,
        recipe: {
          select: {
            id: true,
            title: true,
            communityId: true,
            creatorId: true,
          },
        },
      },
    });

    if (!proposal) {
      throw createHttpError(404, "PROPOSAL_004: Proposal not found");
    }

    if (proposal.recipe.communityId) {
      await requireMembership(authenticatedUserId, proposal.recipe.communityId);
    }

    res.status(200).json(proposal);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/proposals/:proposalId/accept
 * Accepter une proposition (createur de la recette uniquement)
 */
export const acceptProposal: RequestHandler<
  { proposalId: string },
  unknown,
  unknown,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { proposalId } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    // Recuperer la proposition avec la recette
    const proposal = await prisma.recipeUpdateProposal.findFirst({
      where: {
        id: proposalId,
        deletedAt: null,
      },
      select: {
        id: true,
        proposedTitle: true,
        proposedServings: true,
        proposedPrepTime: true,
        proposedCookTime: true,
        proposedRestTime: true,
        status: true,
        createdAt: true,
        recipeId: true,
        proposerId: true,
        proposedSteps: PROPOSAL_STEPS_SELECT,
        recipe: {
          select: {
            id: true,
            title: true,
            servings: true,
            prepTime: true,
            cookTime: true,
            restTime: true,
            imageUrl: true,
            communityId: true,
            creatorId: true,
            originRecipeId: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!proposal) {
      throw createHttpError(404, "PROPOSAL_004: Proposal not found");
    }

    // Verifier que c'est une recette communautaire
    if (!proposal.recipe.communityId) {
      throw createHttpError(400, "PROPOSAL_001: Cannot accept proposal on personal recipe");
    }

    // Verifier que l'utilisateur est le createur de la recette
    if (proposal.recipe.creatorId !== authenticatedUserId) {
      throw createHttpError(
        403,
        "RECIPE_002: Only the recipe creator can accept proposals"
      );
    }

    // Verifier que la proposition est en status PENDING
    if (proposal.status !== "PENDING") {
      throw createHttpError(400, "PROPOSAL_002: Proposal already decided");
    }

    // Verifier que la recette n'a pas ete modifiee depuis la creation de la proposition
    if (proposal.recipe.updatedAt > proposal.createdAt) {
      throw createHttpError(
        409,
        "PROPOSAL_003: Recipe has been modified since proposal was created"
      );
    }

    const result = await acceptProposalService(proposalId, proposal, authenticatedUserId);

    appEvents.emitActivity({
      type: "PROPOSAL_ACCEPTED",
      userId: authenticatedUserId,
      communityId: proposal.recipe.communityId,
      recipeId: proposal.recipeId,
      targetUserIds: [proposal.proposerId],
      metadata: { proposalId },
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/proposals/:proposalId/reject
 * Refuser une proposition et creer une variante (createur de la recette uniquement)
 */
export const rejectProposal: RequestHandler<
  { proposalId: string },
  unknown,
  unknown,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;
  const { proposalId } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    // Recuperer la proposition avec la recette
    const proposal = await prisma.recipeUpdateProposal.findFirst({
      where: {
        id: proposalId,
        deletedAt: null,
      },
      select: {
        id: true,
        proposedTitle: true,
        proposedServings: true,
        proposedPrepTime: true,
        proposedCookTime: true,
        proposedRestTime: true,
        status: true,
        recipeId: true,
        proposerId: true,
        proposedSteps: PROPOSAL_STEPS_SELECT,
        recipe: {
          select: {
            id: true,
            title: true,
            servings: true,
            prepTime: true,
            cookTime: true,
            restTime: true,
            imageUrl: true,
            communityId: true,
            creatorId: true,
          },
        },
      },
    });

    if (!proposal) {
      throw createHttpError(404, "PROPOSAL_004: Proposal not found");
    }

    // Verifier que c'est une recette communautaire
    if (!proposal.recipe.communityId) {
      throw createHttpError(400, "PROPOSAL_001: Cannot reject proposal on personal recipe");
    }

    // Verifier que l'utilisateur est le createur de la recette
    if (proposal.recipe.creatorId !== authenticatedUserId) {
      throw createHttpError(
        403,
        "RECIPE_002: Only the recipe creator can reject proposals"
      );
    }

    // Verifier que la proposition est en status PENDING
    if (proposal.status !== "PENDING") {
      throw createHttpError(400, "PROPOSAL_002: Proposal already decided");
    }

    const result = await rejectProposalService(proposalId, proposal);

    appEvents.emitActivity({
      type: "PROPOSAL_REJECTED",
      userId: authenticatedUserId,
      communityId: proposal.recipe.communityId,
      recipeId: proposal.recipeId,
      targetUserIds: [proposal.proposerId],
      metadata: { proposalId },
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

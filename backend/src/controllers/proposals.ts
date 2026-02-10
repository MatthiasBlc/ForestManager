import { RequestHandler } from "express";
import prisma from "../util/db";
import { Prisma } from "@prisma/client";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { parsePagination, buildPaginationMeta } from "../util/pagination";
import { requireMembership } from "../services/membershipService";
import { acceptProposal as acceptProposalService, rejectProposal as rejectProposalService } from "../services/proposalService";

interface CreateProposalBody {
  proposedTitle?: string;
  proposedContent?: string;
}

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
  const { proposedTitle, proposedContent } = req.body;
  const authenticatedUserId = req.session.userId;
  const { recipeId } = req.params;

  try {
    assertIsDefine(authenticatedUserId);

    // Validation des champs requis
    if (!proposedTitle?.trim()) {
      throw createHttpError(400, "RECIPE_003: Title required");
    }
    if (!proposedContent?.trim()) {
      throw createHttpError(400, "RECIPE_004: Content required");
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
          proposedContent: proposedContent.trim(),
          recipeId,
          proposerId: authenticatedUserId,
        },
        select: {
          id: true,
          proposedTitle: true,
          proposedContent: true,
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
        },
      });

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

      return newProposal;
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
      whereClause.status = statusFilter;
    }

    // Recuperer les propositions
    const [proposals, total] = await Promise.all([
      prisma.recipeUpdateProposal.findMany({
        where: whereClause,
        select: {
          id: true,
          proposedTitle: true,
          proposedContent: true,
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
        },
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
        id: true,
        proposedTitle: true,
        proposedContent: true,
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
        proposedContent: true,
        status: true,
        createdAt: true,
        recipeId: true,
        proposerId: true,
        recipe: {
          select: {
            id: true,
            title: true,
            content: true,
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
        proposedContent: true,
        status: true,
        recipeId: true,
        proposerId: true,
        recipe: {
          select: {
            id: true,
            title: true,
            content: true,
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

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

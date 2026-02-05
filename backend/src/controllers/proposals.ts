import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";

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

    // Verifier que l'utilisateur est membre de la communaute
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
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || "20", 10), 1),
    100
  );
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

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

    // Verifier que l'utilisateur est membre de la communaute
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

    // Construire la clause where
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
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
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + proposals.length < total,
      },
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
      throw createHttpError(404, "Proposal not found");
    }

    // Verifier que l'utilisateur est membre de la communaute
    if (proposal.recipe.communityId) {
      const membership = await prisma.userCommunity.findFirst({
        where: {
          userId: authenticatedUserId,
          communityId: proposal.recipe.communityId,
          deletedAt: null,
        },
      });

      if (!membership) {
        throw createHttpError(403, "COMMUNITY_001: Not a member");
      }
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
      throw createHttpError(404, "Proposal not found");
    }

    // Verifier que c'est une recette communautaire
    if (!proposal.recipe.communityId) {
      throw createHttpError(400, "Cannot accept proposal on personal recipe");
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

    // Transaction: accepter la proposition et propager les modifications
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Mettre a jour la recette communautaire
      await tx.recipe.update({
        where: { id: proposal.recipe.id },
        data: {
          title: proposal.proposedTitle,
          content: proposal.proposedContent,
          updatedAt: now,
        },
      });

      // 2. Si la recette a un originRecipeId (lien vers la perso), propager
      let personalRecipeId: string | null = null;
      if (proposal.recipe.originRecipeId) {
        // Trouver la recette personnelle (originRecipe avec communityId = null)
        const originRecipe = await tx.recipe.findFirst({
          where: {
            id: proposal.recipe.originRecipeId,
            communityId: null,
            deletedAt: null,
          },
        });

        if (originRecipe) {
          personalRecipeId = originRecipe.id;

          // Mettre a jour la recette personnelle
          await tx.recipe.update({
            where: { id: personalRecipeId },
            data: {
              title: proposal.proposedTitle,
              content: proposal.proposedContent,
              updatedAt: now,
            },
          });

          // 3. Propager aux autres copies communautaires
          const otherCommunityRecipes = await tx.recipe.findMany({
            where: {
              originRecipeId: personalRecipeId,
              deletedAt: null,
              id: { not: proposal.recipe.id }, // Exclure la recette deja mise a jour
            },
            select: {
              id: true,
              communityId: true,
            },
          });

          for (const otherRecipe of otherCommunityRecipes) {
            await tx.recipe.update({
              where: { id: otherRecipe.id },
              data: {
                title: proposal.proposedTitle,
                content: proposal.proposedContent,
                updatedAt: now,
              },
            });

            // Creer ActivityLog RECIPE_UPDATED pour chaque communaute
            if (otherRecipe.communityId) {
              await tx.activityLog.create({
                data: {
                  type: "RECIPE_UPDATED",
                  userId: authenticatedUserId,
                  communityId: otherRecipe.communityId,
                  recipeId: otherRecipe.id,
                  metadata: { propagatedFromProposalId: proposalId },
                },
              });
            }
          }
        }
      }

      // 4. Mettre a jour la proposition
      const updatedProposal = await tx.recipeUpdateProposal.update({
        where: { id: proposalId },
        data: {
          status: "ACCEPTED",
          decidedAt: now,
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

      // 5. Creer ActivityLog PROPOSAL_ACCEPTED
      await tx.activityLog.create({
        data: {
          type: "PROPOSAL_ACCEPTED",
          userId: authenticatedUserId,
          communityId: proposal.recipe.communityId,
          recipeId: proposal.recipe.id,
          metadata: { proposalId },
        },
      });

      return updatedProposal;
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
      throw createHttpError(404, "Proposal not found");
    }

    // Verifier que c'est une recette communautaire
    if (!proposal.recipe.communityId) {
      throw createHttpError(400, "Cannot reject proposal on personal recipe");
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

    // Transaction: refuser la proposition et creer une variante
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Creer une variante pour le proposeur
      const variant = await tx.recipe.create({
        data: {
          title: proposal.proposedTitle,
          content: proposal.proposedContent,
          imageUrl: proposal.recipe.imageUrl,
          isVariant: true,
          creatorId: proposal.proposerId, // Le proposeur devient createur de la variante
          communityId: proposal.recipe.communityId,
          originRecipeId: proposal.recipe.id, // Lien vers la recette cible
        },
        select: {
          id: true,
          title: true,
          content: true,
          imageUrl: true,
          isVariant: true,
          creatorId: true,
          communityId: true,
          originRecipeId: true,
          createdAt: true,
        },
      });

      // 2. Mettre a jour la proposition
      const updatedProposal = await tx.recipeUpdateProposal.update({
        where: { id: proposalId },
        data: {
          status: "REJECTED",
          decidedAt: now,
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

      // 3. Creer ActivityLog VARIANT_CREATED
      await tx.activityLog.create({
        data: {
          type: "VARIANT_CREATED",
          userId: proposal.proposerId,
          communityId: proposal.recipe.communityId,
          recipeId: variant.id,
          metadata: {
            proposalId,
            originRecipeId: proposal.recipe.id,
          },
        },
      });

      return { proposal: updatedProposal, variant };
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

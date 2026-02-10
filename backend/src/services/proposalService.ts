import prisma from "../util/db";

const PROPOSAL_SELECT = {
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
};

interface ProposalWithRecipe {
  id: string;
  proposedTitle: string;
  proposedContent: string;
  status: string;
  createdAt: Date;
  recipeId: string;
  proposerId: string;
  recipe: {
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    communityId: string | null;
    creatorId: string;
    originRecipeId: string | null;
    updatedAt: Date;
  };
}

/**
 * Accepte une proposition : met a jour la recette + propage aux copies liees.
 */
export async function acceptProposal(
  proposalId: string,
  proposal: ProposalWithRecipe,
  authenticatedUserId: string
) {
  return prisma.$transaction(async (tx) => {
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
    if (proposal.recipe.originRecipeId) {
      const originRecipe = await tx.recipe.findFirst({
        where: {
          id: proposal.recipe.originRecipeId,
          communityId: null,
          deletedAt: null,
        },
      });

      if (originRecipe) {
        // Mettre a jour la recette personnelle
        await tx.recipe.update({
          where: { id: originRecipe.id },
          data: {
            title: proposal.proposedTitle,
            content: proposal.proposedContent,
            updatedAt: now,
          },
        });

        // 3. Propager aux autres copies communautaires
        const otherCommunityRecipes = await tx.recipe.findMany({
          where: {
            originRecipeId: originRecipe.id,
            deletedAt: null,
            id: { not: proposal.recipe.id },
          },
          select: { id: true, communityId: true },
        });

        if (otherCommunityRecipes.length > 0) {
          await tx.recipe.updateMany({
            where: { id: { in: otherCommunityRecipes.map((r) => r.id) } },
            data: {
              title: proposal.proposedTitle,
              content: proposal.proposedContent,
              updatedAt: now,
            },
          });

          // Creer ActivityLog RECIPE_UPDATED pour chaque communaute
          const activityLogs = otherCommunityRecipes
            .filter((r) => r.communityId)
            .map((r) => ({
              type: "RECIPE_UPDATED",
              userId: authenticatedUserId,
              communityId: r.communityId!,
              recipeId: r.id,
              metadata: { propagatedFromProposalId: proposalId },
            }));

          if (activityLogs.length > 0) {
            await tx.activityLog.createMany({ data: activityLogs });
          }
        }
      }
    }

    // 4. Mettre a jour la proposition
    const updatedProposal = await tx.recipeUpdateProposal.update({
      where: { id: proposalId },
      data: { status: "ACCEPTED", decidedAt: now },
      select: PROPOSAL_SELECT,
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
}

interface ProposalForReject {
  id: string;
  proposedTitle: string;
  proposedContent: string;
  proposerId: string;
  recipe: {
    id: string;
    imageUrl: string | null;
    communityId: string | null;
  };
}

/**
 * Refuse une proposition et cree une variante pour le proposeur.
 */
export async function rejectProposal(
  proposalId: string,
  proposal: ProposalForReject
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Creer une variante pour le proposeur
    const variant = await tx.recipe.create({
      data: {
        title: proposal.proposedTitle,
        content: proposal.proposedContent,
        imageUrl: proposal.recipe.imageUrl,
        isVariant: true,
        creatorId: proposal.proposerId,
        communityId: proposal.recipe.communityId,
        originRecipeId: proposal.recipe.id,
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
      data: { status: "REJECTED", decidedAt: now },
      select: PROPOSAL_SELECT,
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
}

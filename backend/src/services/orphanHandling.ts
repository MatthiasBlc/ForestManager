import prisma from "../util/db";
import { PrismaClient } from "@prisma/client";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Service pour gerer les recettes orphelines.
 * Une recette devient orpheline quand son createur quitte ou est kick de la communaute.
 * Les propositions PENDING sont auto-refusees et des variantes sont creees.
 */

interface OrphanHandlingResult {
  processedRecipes: number;
  autoRejectedProposals: number;
  createdVariants: number;
}

/**
 * Gere les recettes orphelines quand un membre quitte ou est kick d'une communaute.
 * Auto-refuse toutes les propositions PENDING et cree des variantes pour les proposeurs.
 *
 * @param userId - ID du membre qui quitte/est kick
 * @param communityId - ID de la communaute
 * @param tx - Transaction Prisma (optionnelle, pour etre appelee dans une transaction existante)
 */
export async function handleOrphanedRecipes(
  userId: string,
  communityId: string,
  tx?: TransactionClient
): Promise<OrphanHandlingResult> {
  const client = tx || prisma;

  // Trouver toutes les recettes du membre dans cette communaute
  const recipes = await client.recipe.findMany({
    where: {
      creatorId: userId,
      communityId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      proposals: {
        where: {
          status: "PENDING",
          deletedAt: null,
        },
        select: {
          id: true,
          proposedTitle: true,
          proposedContent: true,
          proposerId: true,
        },
      },
    },
  });

  // Collecter toutes les propositions et preparer les variants
  const allProposalIds: string[] = [];
  const variantDataList: {
    proposal: typeof recipes[0]["proposals"][0];
    recipeId: string;
    imageUrl: string | null;
  }[] = [];

  for (const recipe of recipes) {
    for (const proposal of recipe.proposals) {
      allProposalIds.push(proposal.id);
      variantDataList.push({
        proposal,
        recipeId: recipe.id,
        imageUrl: recipe.imageUrl,
      });
    }
  }

  if (allProposalIds.length === 0) {
    return { processedRecipes: recipes.length, autoRejectedProposals: 0, createdVariants: 0 };
  }

  const now = new Date();

  // Batch: rejeter toutes les propositions en une seule requete
  await client.recipeUpdateProposal.updateMany({
    where: { id: { in: allProposalIds } },
    data: { status: "REJECTED", decidedAt: now },
  });

  // Creer les variantes (besoin des IDs retournes, donc boucle necessaire)
  const activityLogData: {
    type: string;
    userId: string;
    communityId: string;
    recipeId: string;
    metadata: Record<string, unknown>;
  }[] = [];

  for (const { proposal, recipeId, imageUrl } of variantDataList) {
    const variant = await client.recipe.create({
      data: {
        title: proposal.proposedTitle,
        content: proposal.proposedContent,
        imageUrl,
        isVariant: true,
        creatorId: proposal.proposerId,
        communityId,
        originRecipeId: recipeId,
      },
    });

    activityLogData.push({
      type: "VARIANT_CREATED",
      userId: proposal.proposerId,
      communityId,
      recipeId: variant.id,
      metadata: {
        proposalId: proposal.id,
        originRecipeId: recipeId,
        reason: "ORPHAN_AUTO_REJECT",
      },
    });
  }

  // Batch: creer tous les activity logs en une seule requete
  await client.activityLog.createMany({ data: activityLogData });

  return {
    processedRecipes: recipes.length,
    autoRejectedProposals: allProposalIds.length,
    createdVariants: variantDataList.length,
  };
}


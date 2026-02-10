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

  let autoRejectedProposals = 0;
  let createdVariants = 0;

  const now = new Date();

  for (const recipe of recipes) {
    for (const proposal of recipe.proposals) {
      // Creer une variante pour le proposeur
      const variant = await client.recipe.create({
        data: {
          title: proposal.proposedTitle,
          content: proposal.proposedContent,
          imageUrl: recipe.imageUrl,
          isVariant: true,
          creatorId: proposal.proposerId,
          communityId,
          originRecipeId: recipe.id,
        },
      });
      createdVariants++;

      // Mettre a jour la proposition comme REJECTED
      await client.recipeUpdateProposal.update({
        where: { id: proposal.id },
        data: {
          status: "REJECTED",
          decidedAt: now,
        },
      });
      autoRejectedProposals++;

      // Creer ActivityLog VARIANT_CREATED
      await client.activityLog.create({
        data: {
          type: "VARIANT_CREATED",
          userId: proposal.proposerId,
          communityId,
          recipeId: variant.id,
          metadata: {
            proposalId: proposal.id,
            originRecipeId: recipe.id,
            reason: "ORPHAN_AUTO_REJECT",
          },
        },
      });
    }
  }

  return {
    processedRecipes: recipes.length,
    autoRejectedProposals,
    createdVariants,
  };
}


import prisma from "../util/db";
import { Prisma, PrismaClient, ActivityType } from "@prisma/client";

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
      servings: true,
      prepTime: true,
      cookTime: true,
      restTime: true,
      imageUrl: true,
      proposals: {
        where: {
          status: "PENDING",
          deletedAt: null,
        },
        select: {
          id: true,
          proposedTitle: true,
          proposedServings: true,
          proposedPrepTime: true,
          proposedCookTime: true,
          proposedRestTime: true,
          proposerId: true,
          proposedSteps: {
            select: { order: true, instruction: true },
            orderBy: { order: "asc" as const },
          },
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
    recipe: typeof recipes[0];
  }[] = [];

  for (const recipe of recipes) {
    for (const proposal of recipe.proposals) {
      allProposalIds.push(proposal.id);
      variantDataList.push({
        proposal,
        recipeId: recipe.id,
        imageUrl: recipe.imageUrl,
        recipe,
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
    type: ActivityType;
    userId: string;
    communityId: string;
    recipeId: string;
    metadata: Prisma.InputJsonValue;
  }[] = [];

  for (const { proposal, recipeId, imageUrl, recipe } of variantDataList) {
    const variant = await client.recipe.create({
      data: {
        title: proposal.proposedTitle,
        servings: proposal.proposedServings ?? recipe.servings,
        prepTime: proposal.proposedPrepTime !== null ? proposal.proposedPrepTime : recipe.prepTime,
        cookTime: proposal.proposedCookTime !== null ? proposal.proposedCookTime : recipe.cookTime,
        restTime: proposal.proposedRestTime !== null ? proposal.proposedRestTime : recipe.restTime,
        imageUrl,
        isVariant: true,
        creatorId: proposal.proposerId,
        communityId,
        originRecipeId: recipeId,
      },
    });

    // Copier les steps proposes dans la variante
    if (proposal.proposedSteps.length > 0) {
      for (const ps of proposal.proposedSteps) {
        await client.recipeStep.create({
          data: {
            recipeId: variant.id,
            order: ps.order,
            instruction: ps.instruction,
          },
        });
      }
    }

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


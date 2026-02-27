import { ActivityType } from "@prisma/client";
import prisma from "../util/db";
import { PROPOSAL_INGREDIENTS_SELECT, PROPOSAL_STEPS_SELECT } from "../util/prismaSelects";

const PROPOSAL_SELECT = {
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

interface ProposalWithRecipe {
  id: string;
  proposedTitle: string;
  proposedServings: number | null;
  proposedPrepTime: number | null;
  proposedCookTime: number | null;
  proposedRestTime: number | null;
  status: string;
  createdAt: Date;
  recipeId: string;
  proposerId: string;
  proposedSteps: { order: number; instruction: string }[];
  recipe: {
    id: string;
    title: string;
    servings: number;
    prepTime: number | null;
    cookTime: number | null;
    restTime: number | null;
    imageUrl: string | null;
    communityId: string | null;
    creatorId: string;
    originRecipeId: string | null;
    updatedAt: Date;
  };
}

type TxClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Copie les ProposalIngredients vers les RecipeIngredients d'une recette cible.
 * Supprime d'abord les RecipeIngredients existants.
 */
async function applyProposalIngredients(
  tx: TxClient,
  recipeId: string,
  proposalIngredients: Array<{ ingredientId: string; quantity: number | null; unitId: string | null; order: number }>
) {
  await tx.recipeIngredient.deleteMany({ where: { recipeId } });
  for (const pi of proposalIngredients) {
    await tx.recipeIngredient.create({
      data: {
        recipeId,
        ingredientId: pi.ingredientId,
        quantity: pi.quantity,
        unitId: pi.unitId,
        order: pi.order,
      },
    });
  }
}

/**
 * Copie les ProposalSteps vers les RecipeSteps d'une recette cible.
 * Supprime d'abord les RecipeSteps existants.
 */
async function applyProposalSteps(
  tx: TxClient,
  recipeId: string,
  proposalSteps: Array<{ order: number; instruction: string }>
) {
  await tx.recipeStep.deleteMany({ where: { recipeId } });
  for (const ps of proposalSteps) {
    await tx.recipeStep.create({
      data: {
        recipeId,
        order: ps.order,
        instruction: ps.instruction,
      },
    });
  }
}

/**
 * Accepte une proposition : met a jour la recette + propage aux copies liees.
 * Si des ProposalIngredients existent, remplace les RecipeIngredients.
 */
export async function acceptProposal(
  proposalId: string,
  proposal: ProposalWithRecipe,
  authenticatedUserId: string
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // Recuperer les ingredients proposes
    const proposalIngredients = await tx.proposalIngredient.findMany({
      where: { proposalId },
      select: {
        ingredientId: true,
        quantity: true,
        unitId: true,
        order: true,
      },
      orderBy: { order: "asc" },
    });

    const hasProposedIngredients = proposalIngredients.length > 0;
    const hasProposedSteps = proposal.proposedSteps.length > 0;

    // Build scalar update data
    const recipeUpdateData: Record<string, unknown> = {
      title: proposal.proposedTitle,
      updatedAt: now,
    };
    if (proposal.proposedServings !== null) recipeUpdateData.servings = proposal.proposedServings;
    if (proposal.proposedPrepTime !== null) recipeUpdateData.prepTime = proposal.proposedPrepTime;
    if (proposal.proposedCookTime !== null) recipeUpdateData.cookTime = proposal.proposedCookTime;
    if (proposal.proposedRestTime !== null) recipeUpdateData.restTime = proposal.proposedRestTime;

    // 1. Mettre a jour la recette communautaire
    await tx.recipe.update({
      where: { id: proposal.recipe.id },
      data: recipeUpdateData,
    });

    if (hasProposedSteps) {
      await applyProposalSteps(tx, proposal.recipe.id, proposal.proposedSteps);
    }

    // Remplacer les ingredients sur la recette communautaire
    if (hasProposedIngredients) {
      await applyProposalIngredients(tx, proposal.recipe.id, proposalIngredients);
    }

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
          data: recipeUpdateData,
        });

        if (hasProposedSteps) {
          await applyProposalSteps(tx, originRecipe.id, proposal.proposedSteps);
        }

        if (hasProposedIngredients) {
          await applyProposalIngredients(tx, originRecipe.id, proposalIngredients);
        }

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
            data: recipeUpdateData,
          });

          if (hasProposedSteps) {
            for (const linked of otherCommunityRecipes) {
              await applyProposalSteps(tx, linked.id, proposal.proposedSteps);
            }
          }

          if (hasProposedIngredients) {
            for (const linked of otherCommunityRecipes) {
              await applyProposalIngredients(tx, linked.id, proposalIngredients);
            }
          }

          // Creer ActivityLog RECIPE_UPDATED pour chaque communaute
          const activityLogs = otherCommunityRecipes
            .filter((r) => r.communityId)
            .map((r) => ({
              type: "RECIPE_UPDATED" as ActivityType,
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
  proposedServings: number | null;
  proposedPrepTime: number | null;
  proposedCookTime: number | null;
  proposedRestTime: number | null;
  proposerId: string;
  proposedSteps: { order: number; instruction: string }[];
  recipe: {
    id: string;
    servings: number;
    prepTime: number | null;
    cookTime: number | null;
    restTime: number | null;
    imageUrl: string | null;
    communityId: string | null;
  };
}

/**
 * Refuse une proposition et cree une variante pour le proposeur.
 * Si des ProposalIngredients existent, les copie dans la variante.
 */
export async function rejectProposal(
  proposalId: string,
  proposal: ProposalForReject
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // Recuperer les ingredients proposes avant de creer la variante
    const proposalIngredients = await tx.proposalIngredient.findMany({
      where: { proposalId },
      select: {
        ingredientId: true,
        quantity: true,
        unitId: true,
        order: true,
      },
      orderBy: { order: "asc" },
    });

    // 1. Creer une variante pour le proposeur
    const variant = await tx.recipe.create({
      data: {
        title: proposal.proposedTitle,
        servings: proposal.proposedServings ?? proposal.recipe.servings,
        prepTime: proposal.proposedPrepTime !== null ? proposal.proposedPrepTime : proposal.recipe.prepTime,
        cookTime: proposal.proposedCookTime !== null ? proposal.proposedCookTime : proposal.recipe.cookTime,
        restTime: proposal.proposedRestTime !== null ? proposal.proposedRestTime : proposal.recipe.restTime,
        imageUrl: proposal.recipe.imageUrl,
        isVariant: true,
        creatorId: proposal.proposerId,
        communityId: proposal.recipe.communityId,
        originRecipeId: proposal.recipe.id,
      },
      select: {
        id: true,
        title: true,
        servings: true,
        prepTime: true,
        cookTime: true,
        restTime: true,
        imageUrl: true,
        isVariant: true,
        creatorId: true,
        communityId: true,
        originRecipeId: true,
        createdAt: true,
      },
    });

    // Copier les steps proposes dans la variante
    if (proposal.proposedSteps.length > 0) {
      await applyProposalSteps(tx, variant.id, proposal.proposedSteps);
    }

    // Copier les ingredients proposes dans la variante
    if (proposalIngredients.length > 0) {
      for (const pi of proposalIngredients) {
        await tx.recipeIngredient.create({
          data: {
            recipeId: variant.id,
            ingredientId: pi.ingredientId,
            quantity: pi.quantity,
            unitId: pi.unitId,
            order: pi.order,
          },
        });
      }
    }

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

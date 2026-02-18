import { PrismaClient } from "@prisma/client";
import prisma from "../util/db";
import { normalizeNames } from "../util/validation";
import { resolveTagsForRecipe } from "./tagService";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Cree une TagSuggestion avec status PENDING_OWNER.
 */
export async function createTagSuggestion(
  tx: TransactionClient,
  recipeId: string,
  tagName: string,
  suggestedById: string
) {
  const [normalized] = normalizeNames([tagName]);

  return tx.tagSuggestion.create({
    data: {
      recipeId,
      tagName: normalized,
      suggestedById,
      status: "PENDING_OWNER",
    },
    select: {
      id: true,
      recipeId: true,
      tagName: true,
      status: true,
      createdAt: true,
      suggestedBy: {
        select: { id: true, username: true },
      },
    },
  });
}

interface SuggestionWithRecipe {
  id: string;
  tagName: string;
  recipeId: string;
  suggestedById: string;
  recipe: {
    id: string;
    communityId: string | null;
    creatorId: string;
  };
}

/**
 * Accepte une suggestion : resout le tag et cree le RecipeTag.
 * Si tag inconnu -> PENDING_MODERATOR, sinon -> APPROVED.
 */
export async function acceptTagSuggestion(
  suggestionId: string,
  suggestion: SuggestionWithRecipe,
  ownerId: string
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const communityId = suggestion.recipe.communityId;

    // Chercher un tag existant (GLOBAL APPROVED ou COMMUNITY APPROVED)
    let existingTag = await tx.tag.findFirst({
      where: {
        name: suggestion.tagName,
        scope: "GLOBAL",
        status: "APPROVED",
        communityId: null,
      },
    });

    if (!existingTag && communityId) {
      existingTag = await tx.tag.findFirst({
        where: {
          name: suggestion.tagName,
          scope: "COMMUNITY",
          status: "APPROVED",
          communityId,
        },
      });
    }

    let finalStatus: "APPROVED" | "PENDING_MODERATOR";

    if (existingTag) {
      // Tag existe -> lier directement
      await tx.recipeTag.create({
        data: { recipeId: suggestion.recipeId, tagId: existingTag.id },
      });
      finalStatus = "APPROVED";
    } else {
      // Tag inconnu -> resolveTagsForRecipe cree un tag PENDING
      const { tagIds } = await resolveTagsForRecipe(
        tx,
        [suggestion.tagName],
        suggestion.suggestedById,
        communityId
      );

      // Creer le RecipeTag
      await tx.recipeTag.create({
        data: { recipeId: suggestion.recipeId, tagId: tagIds[0] },
      });
      finalStatus = "PENDING_MODERATOR";
    }

    // Mettre a jour la suggestion
    const updated = await tx.tagSuggestion.update({
      where: { id: suggestionId },
      data: { status: finalStatus, decidedAt: now },
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
    });

    // ActivityLog
    await tx.activityLog.create({
      data: {
        type: "TAG_SUGGESTION_ACCEPTED",
        userId: ownerId,
        communityId,
        recipeId: suggestion.recipeId,
        metadata: { suggestionId, tagName: suggestion.tagName, finalStatus },
      },
    });

    return updated;
  });
}

/**
 * Rejette une suggestion.
 */
export async function rejectTagSuggestion(
  suggestionId: string,
  ownerId: string,
  communityId: string | null,
  recipeId: string
) {
  const now = new Date();

  const updated = await prisma.tagSuggestion.update({
    where: { id: suggestionId },
    data: { status: "REJECTED", decidedAt: now },
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
  });

  await prisma.activityLog.create({
    data: {
      type: "TAG_SUGGESTION_REJECTED",
      userId: ownerId,
      communityId,
      recipeId,
      metadata: { suggestionId },
    },
  });

  return updated;
}

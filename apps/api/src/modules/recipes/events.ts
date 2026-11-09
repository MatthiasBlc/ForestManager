// Notifications et activite du module Recettes (C6.5) [P04, P06, P07, D41].
// Appelees apres l'action ; le socle applique preferences et regroupement.
import { recordActivity } from "../../core/activity/service.ts";
import type { Context } from "../../core/context.ts";
import { activeMembers } from "../../core/notifications/recipients.ts";
import { notify } from "../../core/notifications/service.ts";
import { authorIsActiveMember } from "./service.ts";

const MODULE = "recipes";

interface RecipeRef {
  id: string;
  title: string;
  authorId: string;
  homeSpaceId: string;
}

/** Qui tranche pour la recette [D81, D18] : l'auteur, sinon MOD et OWNER de l'origine. */
async function decidersOf(ctx: Context, recipe: RecipeRef): Promise<string[]> {
  if (await authorIsActiveMember(ctx.db, recipe)) return [recipe.authorId];
  return activeMembers(ctx.db, recipe.homeSpaceId, ["OWNER", "MODERATOR"]);
}

export async function recipeCreated(ctx: Context, recipe: RecipeRef): Promise<void> {
  const spaceId = recipe.homeSpaceId;
  await recordActivity(ctx, {
    spaceId,
    type: "recipes.recipe.created",
    moduleCode: MODULE,
    actorId: recipe.authorId,
    targetType: "recipe",
    targetId: recipe.id,
    data: { title: recipe.title },
  });
  await notify(ctx, {
    type: "recipes.recipe.created",
    recipients: await activeMembers(ctx.db, spaceId),
    spaceId,
    moduleCode: MODULE,
    actorId: recipe.authorId,
    targetType: "recipe",
    targetId: recipe.id,
    data: { recipeId: recipe.id, title: recipe.title },
    groupKey: `recipes.recipe.created:${spaceId}`,
  });
}

export async function suggestionCreated(
  ctx: Context,
  recipe: RecipeRef,
  suggestionId: string,
  proposerId: string
): Promise<void> {
  await notify(ctx, {
    type: "recipes.suggestion.created",
    recipients: await decidersOf(ctx, recipe),
    spaceId: recipe.homeSpaceId,
    moduleCode: MODULE,
    actorId: proposerId,
    targetType: "suggestion",
    targetId: suggestionId,
    data: { recipeId: recipe.id, title: recipe.title, suggestionId },
  });
}

export async function suggestionDecided(
  ctx: Context,
  suggestion: { id: string; spaceId: string; proposerId: string },
  recipe: { id: string; title: string },
  accepted: boolean,
  deciderId: string,
  message?: string | null
): Promise<void> {
  await notify(ctx, {
    type: accepted ? "recipes.suggestion.accepted" : "recipes.suggestion.rejected",
    recipients: [suggestion.proposerId],
    spaceId: suggestion.spaceId,
    moduleCode: MODULE,
    actorId: deciderId,
    targetType: "suggestion",
    targetId: suggestion.id,
    data: { recipeId: recipe.id, title: recipe.title, ...(message ? { message } : {}) },
  });
}

async function spaceInfo(ctx: Context, spaceId: string) {
  return ctx.db.space.findUniqueOrThrow({
    where: { id: spaceId },
    select: { name: true, kind: true },
  });
}

export async function shareRequested(
  ctx: Context,
  recipe: RecipeRef,
  targetSpaceId: string,
  requesterId: string
): Promise<void> {
  const [target, home] = await Promise.all([
    spaceInfo(ctx, targetSpaceId),
    spaceInfo(ctx, recipe.homeSpaceId),
  ]);
  await notify(ctx, {
    type: "recipes.share-request.created",
    recipients: await decidersOf(ctx, recipe),
    spaceId: recipe.homeSpaceId,
    moduleCode: MODULE,
    actorId: requesterId,
    targetType: "recipe",
    targetId: recipe.id,
    // `personal` : le bandeau des demandes est sur "Mes recettes" dans l'espace perso.
    data: {
      recipeId: recipe.id,
      title: recipe.title,
      targetSpaceName: target.name,
      personal: home.kind === "PERSONAL",
    },
  });
}

export async function shareDecided(
  ctx: Context,
  request: { sourceSpaceId: string; targetSpaceId: string; requesterId: string },
  recipe: { id: string; title: string },
  approved: boolean,
  deciderId: string
): Promise<void> {
  const target = await spaceInfo(ctx, request.targetSpaceId);
  await notify(ctx, {
    type: approved ? "recipes.share-request.approved" : "recipes.share-request.rejected",
    recipients: [request.requesterId],
    spaceId: request.sourceSpaceId,
    moduleCode: MODULE,
    actorId: deciderId,
    targetType: "recipe",
    targetId: recipe.id,
    data: {
      recipeId: recipe.id,
      title: recipe.title,
      targetSpaceName: target.name,
      targetSpaceId: request.targetSpaceId,
    },
  });
}

/** Partage effectif dans un espace : activite de l'espace cible (P06). */
export async function recipeShared(
  ctx: Context,
  recipe: { id: string; title: string },
  spaceId: string,
  sharedById: string
): Promise<void> {
  await recordActivity(ctx, {
    spaceId,
    type: "recipes.recipe.shared",
    moduleCode: MODULE,
    actorId: sharedById,
    targetType: "recipe",
    targetId: recipe.id,
    data: { title: recipe.title },
  });
}

/** L'auteur de l'original apprend qu'elle a ete adaptee ailleurs (P06). */
export async function recipeAdapted(
  ctx: Context,
  original: RecipeRef,
  targetSpaceId: string,
  actorId: string
): Promise<void> {
  const target = await spaceInfo(ctx, targetSpaceId);
  await notify(ctx, {
    type: "recipes.recipe.adapted",
    recipients: [original.authorId],
    spaceId: original.homeSpaceId,
    moduleCode: MODULE,
    actorId,
    targetType: "recipe",
    targetId: original.id,
    data: { recipeId: original.id, title: original.title, spaceName: target.name },
  });
}

// Photo d'une recette [D167] : hors revisions, meme droit que modifier la
// recette, copiee par l'adaptation, liberee 30 jours apres la suppression.
import type { Context } from "../../core/context.ts";
import type { Db } from "../../core/db/client.ts";
import { claimUpload, discardImage, imageUrl } from "../../core/storage/images.ts";
import { findEditable, type RecipeActor } from "./service.ts";

/** Une recette supprimee garde sa photo ce temps-la (comme un espace, D22). */
const DELETED_PHOTO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function setPhoto(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  uploadId: string
): Promise<string | null> {
  const recipe = await findEditable(ctx, actor, recipeId);
  const key = await claimUpload(ctx, actor.userId, uploadId, `recipes/${recipeId}`, "photo");
  await ctx.db.recipe.update({ where: { id: recipeId }, data: { imageKey: key } });
  await discardImage(ctx, recipe.imageKey);
  return imageUrl(ctx, key);
}

export async function removePhoto(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<void> {
  const recipe = await findEditable(ctx, actor, recipeId);
  await ctx.db.recipe.update({ where: { id: recipeId }, data: { imageKey: null } });
  await discardImage(ctx, recipe.imageKey);
}

/** Menage du stockage : libere les photos des recettes supprimees depuis 30 jours. */
export async function storageKeys(db: Db, now: Date): Promise<string[]> {
  await db.recipe.updateMany({
    where: {
      deletedAt: { lt: new Date(now.getTime() - DELETED_PHOTO_RETENTION_MS) },
      imageKey: { not: null },
    },
    data: { imageKey: null },
  });
  const rows = await db.recipe.findMany({
    where: { imageKey: { not: null } },
    select: { imageKey: true },
  });
  return rows.flatMap((row) => (row.imageKey ? [row.imageKey] : []));
}

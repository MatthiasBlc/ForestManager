import cron from "node-cron";
import prisma from "../util/db";
import logger from "../util/logger";
import { deleteObject } from "../services/storageService";

const RETENTION_DAYS = 7;
const BATCH_SIZE = 100;

/**
 * Supprime les images MinIO des recettes soft-deleted depuis > RETENTION_DAYS jours.
 * Met imageKey a null en DB apres suppression.
 */
async function cleanupRecipeImages(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const recipes = await prisma.recipe.findMany({
    where: {
      deletedAt: { not: null, lte: cutoffDate },
      imageKey: { not: null },
    },
    select: { id: true, imageKey: true },
    take: BATCH_SIZE,
  });

  let deleted = 0;
  for (const recipe of recipes) {
    try {
      await deleteObject(recipe.imageKey!);
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { imageKey: null },
      });
      deleted++;
    } catch (err) {
      logger.error({ err, recipeId: recipe.id }, "Failed to cleanup recipe image");
    }
  }

  return deleted;
}

/**
 * Supprime les images MinIO des communautes soft-deleted depuis > RETENTION_DAYS jours.
 * Met imageKey a null en DB apres suppression.
 */
async function cleanupCommunityImages(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const communities = await prisma.community.findMany({
    where: {
      deletedAt: { not: null, lte: cutoffDate },
      imageKey: { not: null },
    },
    select: { id: true, imageKey: true },
    take: BATCH_SIZE,
  });

  let deleted = 0;
  for (const community of communities) {
    try {
      await deleteObject(community.imageKey!);
      await prisma.community.update({
        where: { id: community.id },
        data: { imageKey: null },
      });
      deleted++;
    } catch (err) {
      logger.error({ err, communityId: community.id }, "Failed to cleanup community image");
    }
  }

  return deleted;
}

/**
 * Execute le nettoyage complet des images orphelines.
 */
export async function cleanupOrphanImages(): Promise<number> {
  const recipeCount = await cleanupRecipeImages();
  const communityCount = await cleanupCommunityImages();
  const total = recipeCount + communityCount;

  if (total > 0) {
    logger.info({ recipeCount, communityCount, total }, "Image cleanup completed");
  } else {
    logger.debug("Image cleanup: nothing to delete");
  }

  return total;
}

/**
 * Demarre le job cron de nettoyage des images.
 * Execute tous les jours a 3h30.
 */
export function startImageCleanupJob() {
  cron.schedule("30 3 * * *", async () => {
    try {
      await cleanupOrphanImages();
    } catch (err) {
      logger.error({ err }, "Image cleanup job failed");
    }
  });

  logger.info("Image cleanup job scheduled (daily at 03:30)");
}

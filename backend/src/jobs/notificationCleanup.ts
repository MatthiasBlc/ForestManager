import cron from "node-cron";
import prisma from "../util/db";
import logger from "../util/logger";

const RETENTION_DAYS = 30;
const BATCH_SIZE = 500;

/**
 * Supprime les notifications lues depuis plus de RETENTION_DAYS jours.
 * Execute en batches pour eviter de verrouiller la table longtemps.
 * Retourne le nombre total de notifications supprimees.
 */
export async function cleanupReadNotifications(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  let totalDeleted = 0;
  let batchDeleted: number;

  do {
    // Trouver un batch d'IDs a supprimer
    const batch = await prisma.notification.findMany({
      where: {
        readAt: { not: null, lte: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const result = await prisma.notification.deleteMany({
      where: {
        id: { in: batch.map((n) => n.id) },
      },
    });

    batchDeleted = result.count;
    totalDeleted += batchDeleted;

    logger.debug({ batchDeleted, totalDeleted }, "Notification cleanup batch completed");
  } while (batchDeleted === BATCH_SIZE);

  if (totalDeleted > 0) {
    logger.info({ totalDeleted, cutoffDate: cutoffDate.toISOString() }, "Notification cleanup completed");
  } else {
    logger.debug("Notification cleanup: nothing to delete");
  }

  return totalDeleted;
}

/**
 * Demarre le job cron de nettoyage des notifications.
 * Execute tous les jours a 3h du matin.
 */
export function startNotificationCleanupJob() {
  cron.schedule("0 3 * * *", async () => {
    try {
      await cleanupReadNotifications();
    } catch (err) {
      logger.error({ err }, "Notification cleanup job failed");
    }
  });

  logger.info("Notification cleanup job scheduled (daily at 03:00)");
}

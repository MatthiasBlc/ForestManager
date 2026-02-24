import prisma from "../util/db";

/**
 * Retourne les IDs des moderateurs d'une communaute qui ont les notifications tags activees.
 * Filtre par NotificationPreference (category=TAG, global puis par communaute).
 */
export async function getModeratorIdsForTagNotification(
  communityId: string
): Promise<string[]> {
  // Recuperer tous les moderateurs de la communaute
  const moderators = await prisma.userCommunity.findMany({
    where: {
      communityId,
      role: "MODERATOR",
      deletedAt: null,
    },
    select: { userId: true },
  });

  if (moderators.length === 0) return [];

  const moderatorIds = moderators.map((m) => m.userId);

  // Recuperer les preferences de notification TAG de ces moderateurs
  const prefs = await prisma.notificationPreference.findMany({
    where: {
      userId: { in: moderatorIds },
      category: "TAG",
      OR: [{ communityId: null }, { communityId }],
    },
  });

  // Construire un map userId -> { global: boolean, community: boolean | undefined }
  const prefMap = new Map<
    string,
    { global: boolean; community?: boolean }
  >();

  for (const pref of prefs) {
    const entry = prefMap.get(pref.userId) ?? { global: true };
    if (pref.communityId === null) {
      entry.global = pref.enabled;
    } else {
      entry.community = pref.enabled;
    }
    prefMap.set(pref.userId, entry);
  }

  // Filtrer : la preference communaute surcharge la globale
  return moderatorIds.filter((userId) => {
    const entry = prefMap.get(userId);
    if (!entry) return true; // Pas de pref = defaut (true)
    if (entry.community !== undefined) return entry.community;
    return entry.global;
  });
}

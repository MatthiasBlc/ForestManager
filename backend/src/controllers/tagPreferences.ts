import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { requireMembership } from "../services/membershipService";

// =============================================================================
// TAG VISIBILITY PREFERENCES (UserCommunityTagPreference)
// =============================================================================

/**
 * GET /api/users/me/tag-preferences
 * Liste les preferences showTags pour toutes les communautes de l'utilisateur
 */
export const getTagPreferences: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    // Recuperer toutes les communautes dont l'utilisateur est membre
    const memberships = await prisma.userCommunity.findMany({
      where: { userId, deletedAt: null },
      select: {
        communityId: true,
        community: { select: { id: true, name: true } },
      },
    });

    // Recuperer les preferences existantes
    const prefs = await prisma.userCommunityTagPreference.findMany({
      where: { userId },
    });

    const prefMap = new Map(prefs.map((p) => [p.communityId, p.showTags]));

    // Construire la reponse : une entree par communaute (defaut showTags=true)
    const data = memberships.map((m) => ({
      communityId: m.communityId,
      communityName: m.community.name,
      showTags: prefMap.get(m.communityId) ?? true,
    }));

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/me/tag-preferences/:communityId
 * Active/desactive l'affichage des tags communautaires
 */
export const updateTagPreference: RequestHandler<
  { communityId: string },
  unknown,
  { showTags?: boolean },
  unknown
> = async (req, res, next) => {
  const userId = req.session.userId;
  const { communityId } = req.params;
  const { showTags } = req.body;

  try {
    assertIsDefine(userId);

    if (typeof showTags !== "boolean") {
      throw createHttpError(400, "TAG_001: showTags must be a boolean");
    }

    // Verifier membership
    await requireMembership(userId, communityId);

    const pref = await prisma.userCommunityTagPreference.upsert({
      where: { userId_communityId: { userId, communityId } },
      update: { showTags },
      create: { userId, communityId, showTags },
    });

    res.status(200).json({
      communityId: pref.communityId,
      showTags: pref.showTags,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// MODERATOR NOTIFICATION PREFERENCES (ModeratorNotificationPreference)
// =============================================================================

/**
 * GET /api/users/me/notification-preferences
 * Liste les preferences de notification du moderateur
 */
export const getNotificationPreferences: RequestHandler = async (
  req,
  res,
  next
) => {
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    // Recuperer les communautes ou l'utilisateur est moderateur
    const moderatorships = await prisma.userCommunity.findMany({
      where: { userId, role: "MODERATOR", deletedAt: null },
      select: {
        communityId: true,
        community: { select: { id: true, name: true } },
      },
    });

    // Recuperer toutes les prefs
    const prefs = await prisma.moderatorNotificationPreference.findMany({
      where: { userId },
    });

    // Pref globale (communityId = null)
    const globalPref = prefs.find((p) => p.communityId === null);
    const communityPrefs = prefs.filter((p) => p.communityId !== null);
    const communityPrefMap = new Map(
      communityPrefs.map((p) => [p.communityId, p.tagNotifications])
    );

    const data = {
      global: {
        tagNotifications: globalPref?.tagNotifications ?? true,
      },
      communities: moderatorships.map((m) => ({
        communityId: m.communityId,
        communityName: m.community.name,
        tagNotifications: communityPrefMap.get(m.communityId) ?? globalPref?.tagNotifications ?? true,
      })),
    };

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/me/notification-preferences/tags
 * Toggle global tagNotifications
 */
export const updateGlobalNotificationPreference: RequestHandler<
  unknown,
  unknown,
  { tagNotifications?: boolean },
  unknown
> = async (req, res, next) => {
  const userId = req.session.userId;
  const { tagNotifications } = req.body;

  try {
    assertIsDefine(userId);

    if (typeof tagNotifications !== "boolean") {
      throw createHttpError(
        400,
        "TAG_001: tagNotifications must be a boolean"
      );
    }

    // Verifier que l'utilisateur est moderateur d'au moins une communaute
    const modCount = await prisma.userCommunity.count({
      where: { userId, role: "MODERATOR", deletedAt: null },
    });
    if (modCount === 0) {
      throw createHttpError(
        403,
        "TAG_005: Only moderators can manage notification preferences"
      );
    }

    // Chercher la pref globale (communityId = null)
    const existing = await prisma.moderatorNotificationPreference.findFirst({
      where: { userId, communityId: null },
    });

    let pref;
    if (existing) {
      pref = await prisma.moderatorNotificationPreference.update({
        where: { id: existing.id },
        data: { tagNotifications },
      });
    } else {
      pref = await prisma.moderatorNotificationPreference.create({
        data: { userId, communityId: null, tagNotifications },
      });
    }

    res.status(200).json({
      tagNotifications: pref.tagNotifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/me/notification-preferences/tags/:communityId
 * Toggle par communaute
 */
export const updateCommunityNotificationPreference: RequestHandler<
  { communityId: string },
  unknown,
  { tagNotifications?: boolean },
  unknown
> = async (req, res, next) => {
  const userId = req.session.userId;
  const { communityId } = req.params;
  const { tagNotifications } = req.body;

  try {
    assertIsDefine(userId);

    if (typeof tagNotifications !== "boolean") {
      throw createHttpError(
        400,
        "TAG_001: tagNotifications must be a boolean"
      );
    }

    // Verifier que l'utilisateur est moderateur de cette communaute
    const membership = await requireMembership(userId, communityId);
    if (membership.role !== "MODERATOR") {
      throw createHttpError(
        403,
        "TAG_005: Only moderators can manage notification preferences"
      );
    }

    const pref = await prisma.moderatorNotificationPreference.upsert({
      where: { userId_communityId: { userId, communityId } },
      update: { tagNotifications },
      create: { userId, communityId, tagNotifications },
    });

    res.status(200).json({
      communityId: pref.communityId,
      tagNotifications: pref.tagNotifications,
    });
  } catch (error) {
    next(error);
  }
};

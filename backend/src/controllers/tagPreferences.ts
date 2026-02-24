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


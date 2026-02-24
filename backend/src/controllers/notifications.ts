import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { NotificationCategory, Notification } from "@prisma/client";

const ALL_CATEGORIES = Object.values(NotificationCategory);
const VALID_CATEGORIES: Set<string> = new Set(ALL_CATEGORIES);

const GROUP_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

// =============================================================================
// GET /api/notifications
// =============================================================================

interface NotificationGroup {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl: string | null;
  actor: { id: string; username: string } | null;
  community: { id: string; name: string } | null;
  readAt: Date | null;
  createdAt: Date;
  group: {
    count: number;
    notificationIds: string[];
    items: {
      id: string;
      message: string;
      createdAt: Date;
      readAt: Date | null;
    }[];
  } | null;
}

function groupNotifications(
  notifications: (Notification & {
    actor: { id: string; username: string } | null;
    community: { id: string; name: string } | null;
  })[]
): NotificationGroup[] {
  const result: NotificationGroup[] = [];
  const grouped = new Map<string, typeof notifications>();

  // Separer les notifications groupables des individuelles
  for (const notif of notifications) {
    if (notif.groupKey) {
      const existing = grouped.get(notif.groupKey) ?? [];
      existing.push(notif);
      grouped.set(notif.groupKey, existing);
    } else {
      result.push({
        id: notif.id,
        type: notif.type,
        category: notif.category,
        title: notif.title,
        message: notif.message,
        actionUrl: notif.actionUrl,
        actor: notif.actor,
        community: notif.community,
        readAt: notif.readAt,
        createdAt: notif.createdAt,
        group: null,
      });
    }
  }

  // Pour chaque groupKey, fusionner les notifications dans la fenetre de 60min
  for (const [, notifs] of grouped) {
    // Trier par date decroissante
    notifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Decouper en sous-groupes par fenetre temporelle
    const subGroups: (typeof notifs)[] = [];
    let currentGroup: typeof notifs = [];

    for (const notif of notifs) {
      if (
        currentGroup.length === 0 ||
        currentGroup[currentGroup.length - 1].createdAt.getTime() -
          notif.createdAt.getTime() <=
          GROUP_WINDOW_MS
      ) {
        currentGroup.push(notif);
      } else {
        subGroups.push(currentGroup);
        currentGroup = [notif];
      }
    }
    if (currentGroup.length > 0) subGroups.push(currentGroup);

    // Convertir chaque sous-groupe
    for (const sg of subGroups) {
      if (sg.length === 1) {
        // Pas de groupement pour une seule notification
        const n = sg[0];
        result.push({
          id: n.id,
          type: n.type,
          category: n.category,
          title: n.title,
          message: n.message,
          actionUrl: n.actionUrl,
          actor: n.actor,
          community: n.community,
          readAt: n.readAt,
          createdAt: n.createdAt,
          group: null,
        });
      } else {
        // Groupe de plusieurs notifications
        const newest = sg[0];
        const allRead = sg.every((n) => n.readAt !== null);
        result.push({
          id: `group:${newest.groupKey}:${newest.createdAt.toISOString()}`,
          type: newest.type,
          category: newest.category,
          title: newest.title,
          message: `${sg.length} ${getGroupMessage(newest.type, newest.community?.name ?? "")}`,
          actionUrl: newest.community
            ? `/communities/${newest.community.id}`
            : null,
          actor: null,
          community: newest.community,
          readAt: allRead ? newest.readAt : null,
          createdAt: newest.createdAt,
          group: {
            count: sg.length,
            notificationIds: sg.map((n) => n.id),
            items: sg.map((n) => ({
              id: n.id,
              message: n.message,
              createdAt: n.createdAt,
              readAt: n.readAt,
            })),
          },
        });
      }
    }
  }

  // Trier par date decroissante
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return result;
}

function getGroupMessage(type: string, communityName: string): string {
  switch (type) {
    case "RECIPE_CREATED":
      return `nouvelles recettes dans ${communityName}`;
    case "RECIPE_SHARED":
      return `recettes partagees dans ${communityName}`;
    case "USER_JOINED":
      return `nouveaux membres dans ${communityName}`;
    case "USER_LEFT":
      return `membres ont quitte ${communityName}`;
    default:
      return `notifications dans ${communityName}`;
  }
}

export const getNotifications: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const category = req.query.category as string | undefined;
    const unreadOnly = req.query.unreadOnly === "true";
    const grouped = req.query.grouped !== "false"; // default true

    // Validation categorie
    if (category && !VALID_CATEGORIES.has(category)) {
      throw createHttpError(400, "NOTIF_003: Invalid notification category");
    }

    // Construire le filtre
    const where: Record<string, unknown> = { userId };
    if (category) where.category = category as NotificationCategory;
    if (unreadOnly) where.readAt = null;

    // Compter le total
    const total = await prisma.notification.count({ where });

    // Fetch les notifications avec relations
    const notifications = await prisma.notification.findMany({
      where,
      include: {
        actor: { select: { id: true, username: true } },
        community: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Compteur non-lues
    const unreadCount = await prisma.notification.count({
      where: { userId, readAt: null },
    });

    // Groupement optionnel
    const data = grouped
      ? groupNotifications(notifications)
      : notifications.map((n) => ({
          id: n.id,
          type: n.type,
          category: n.category,
          title: n.title,
          message: n.message,
          actionUrl: n.actionUrl,
          actor: n.actor,
          community: n.community,
          readAt: n.readAt,
          createdAt: n.createdAt,
          group: null,
        }));

    res.status(200).json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /api/notifications/unread-count
// =============================================================================

export const getUnreadCount: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    const [total, ...categoryCounts] = await Promise.all([
      prisma.notification.count({ where: { userId, readAt: null } }),
      ...ALL_CATEGORIES.map((cat) =>
        prisma.notification.count({
          where: { userId, readAt: null, category: cat },
        })
      ),
    ]);

    const byCategory: Record<string, number> = {};
    ALL_CATEGORIES.forEach((cat, i) => {
      byCategory[cat] = categoryCounts[i];
    });

    res.status(200).json({ count: total, byCategory });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// PATCH /api/notifications/:id/read
// =============================================================================

export const markAsRead: RequestHandler<{ id: string }> = async (
  req,
  res,
  next
) => {
  const userId = req.session.userId;
  const { id } = req.params;

  try {
    assertIsDefine(userId);

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw createHttpError(404, "NOTIF_001: Notification not found");
    }

    if (notification.userId !== userId) {
      throw createHttpError(403, "NOTIF_002: Notification belongs to another user");
    }

    if (notification.readAt) {
      // Deja lue
      res.status(200).json({ id: notification.id, readAt: notification.readAt });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    res.status(200).json({ id: updated.id, readAt: updated.readAt });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// PATCH /api/notifications/read (batch)
// =============================================================================

export const markBatchAsRead: RequestHandler<
  unknown,
  unknown,
  { ids?: string[] }
> = async (req, res, next) => {
  const userId = req.session.userId;
  const { ids } = req.body;

  try {
    assertIsDefine(userId);

    if (!Array.isArray(ids) || ids.length === 0) {
      throw createHttpError(400, "NOTIF_004: ids must be a non-empty array");
    }

    if (ids.length > 100) {
      throw createHttpError(400, "NOTIF_004: Maximum 100 ids per batch");
    }

    // Verifier que toutes les notifications appartiennent au user
    const notifications = await prisma.notification.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });

    const invalidIds = notifications.filter((n) => n.userId !== userId);
    if (invalidIds.length > 0) {
      throw createHttpError(403, "NOTIF_002: Some notifications belong to another user");
    }

    const { count } = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.status(200).json({ updated: count });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// PATCH /api/notifications/read-all
// =============================================================================

export const markAllAsRead: RequestHandler<
  unknown,
  unknown,
  { category?: string }
> = async (req, res, next) => {
  const userId = req.session.userId;
  const { category } = req.body;

  try {
    assertIsDefine(userId);

    if (category && !VALID_CATEGORIES.has(category)) {
      throw createHttpError(400, "NOTIF_003: Invalid notification category");
    }

    const where: Record<string, unknown> = { userId, readAt: null };
    if (category) where.category = category as NotificationCategory;

    const { count } = await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    res.status(200).json({ updated: count });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /api/notifications/preferences
// =============================================================================

export const getPreferences: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    // Toutes les communautes de l'utilisateur
    const memberships = await prisma.userCommunity.findMany({
      where: { userId, deletedAt: null },
      select: {
        communityId: true,
        community: { select: { id: true, name: true } },
      },
    });

    // Toutes les preferences existantes
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });

    // Construire les preferences globales (defaut true si pas de row)
    const allCategories: NotificationCategory[] = [
      "INVITATION",
      "RECIPE_PROPOSAL",
      "TAG",
      "INGREDIENT",
      "MODERATION",
    ];

    const globalPrefs: Record<string, boolean> = {};
    for (const cat of allCategories) {
      const pref = prefs.find((p) => p.communityId === null && p.category === cat);
      globalPrefs[cat] = pref?.enabled ?? true;
    }

    // Construire les preferences par communaute
    const communities = memberships.map((m) => {
      const communityPrefs: Record<string, boolean> = {};
      for (const cat of allCategories) {
        const pref = prefs.find(
          (p) => p.communityId === m.communityId && p.category === cat
        );
        // Si pas de pref communaute, heriter de la globale
        communityPrefs[cat] = pref?.enabled ?? globalPrefs[cat];
      }
      return {
        communityId: m.communityId,
        communityName: m.community.name,
        preferences: communityPrefs,
      };
    });

    res.status(200).json({
      global: globalPrefs,
      communities,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// PUT /api/notifications/preferences
// =============================================================================

export const updatePreference: RequestHandler<
  unknown,
  unknown,
  { category?: string; enabled?: boolean; communityId?: string | null }
> = async (req, res, next) => {
  const userId = req.session.userId;
  const { category, enabled, communityId } = req.body;

  try {
    assertIsDefine(userId);

    if (!category || !VALID_CATEGORIES.has(category)) {
      throw createHttpError(400, "NOTIF_003: Invalid notification category");
    }

    if (typeof enabled !== "boolean") {
      throw createHttpError(400, "NOTIF_005: enabled must be a boolean");
    }

    // Si communityId fourni, verifier le membership
    if (communityId) {
      const membership = await prisma.userCommunity.findFirst({
        where: { userId, communityId, deletedAt: null },
      });
      if (!membership) {
        throw createHttpError(403, "COMMUNITY_001: Not a member of this community");
      }
    }

    const resolvedCommunityId = communityId ?? null;

    // Upsert : findFirst + update/create (communityId nullable dans contrainte unique)
    if (resolvedCommunityId) {
      const pref = await prisma.notificationPreference.upsert({
        where: {
          userId_communityId_category: {
            userId,
            communityId: resolvedCommunityId,
            category: category as NotificationCategory,
          },
        },
        update: { enabled },
        create: {
          userId,
          communityId: resolvedCommunityId,
          category: category as NotificationCategory,
          enabled,
        },
      });

      res.status(200).json({
        category: pref.category,
        enabled: pref.enabled,
        communityId: pref.communityId,
      });
    } else {
      // communityId null : upsert impossible sur contrainte unique avec null
      const existing = await prisma.notificationPreference.findFirst({
        where: { userId, communityId: null, category: category as NotificationCategory },
      });

      let pref;
      if (existing) {
        pref = await prisma.notificationPreference.update({
          where: { id: existing.id },
          data: { enabled },
        });
      } else {
        pref = await prisma.notificationPreference.create({
          data: {
            userId,
            communityId: null,
            category: category as NotificationCategory,
            enabled,
          },
        });
      }

      res.status(200).json({
        category: pref.category,
        enabled: pref.enabled,
        communityId: pref.communityId,
      });
    }
  } catch (error) {
    next(error);
  }
};

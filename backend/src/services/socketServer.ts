import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { RequestHandler } from "express";
import prisma from "../util/db";
import env from "../util/validateEnv";
import appEvents, { AppEvent } from "./eventEmitter";
import logger from "../util/logger";
import { NotificationCategory } from "@prisma/client";
import {
  getCategoryForType,
  createNotification,
  createBroadcastNotifications,
  resolveTemplateVars,
} from "./notificationService";

const ALL_CATEGORIES = Object.values(NotificationCategory);

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

/**
 * Recupere le compteur de notifications non-lues pour un user (total + par categorie).
 */
async function getUnreadCount(userId: string) {
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

  return { count: total, byCategory };
}

/**
 * Emet notification:count a un user connecte.
 */
async function emitUnreadCount(ioServer: Server, userId: string) {
  try {
    const countData = await getUnreadCount(userId);
    ioServer.to(`user:${userId}`).emit("notification:count", countData);
  } catch (err) {
    logger.debug({ err, userId }, "Failed to emit notification:count");
  }
}

// Types de broadcast communautaire (notifient tous les membres sauf l'acteur)
const BROADCAST_TYPES = new Set([
  "RECIPE_CREATED",
  "RECIPE_SHARED",
  "USER_JOINED",
  "USER_LEFT",
]);

export function initSocketServer(
  httpServer: HttpServer,
  userSessionMiddleware: RequestHandler
) {
  const corsOrigin = env.CORS_ORIGIN || false;

  io = new Server(httpServer, {
    cors: corsOrigin
      ? { origin: corsOrigin, credentials: true }
      : undefined,
    transports: ["websocket", "polling"],
  });

  // Wrap Express session middleware for Socket.IO
  io.use((socket, next) => {
    const req = socket.request as Parameters<RequestHandler>[0];
    const res = {} as Parameters<RequestHandler>[1];
    userSessionMiddleware(req, res, (err?: unknown) => {
      if (err) return next(new Error("Session error"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = (req as any).session?.userId;
      if (!userId) {
        return next(new Error("Authentication required"));
      }
      socket.data.userId = userId;
      next();
    });
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    // Join personal room
    socket.join(`user:${userId}`);

    // Join all user's community rooms
    try {
      const memberships = await prisma.userCommunity.findMany({
        where: { userId, deletedAt: null },
        select: { communityId: true },
      });
      for (const m of memberships) {
        socket.join(`community:${m.communityId}`);
      }
    } catch (err) {
      logger.debug({ err, userId }, "Failed to load community memberships for socket");
    }

    // Emit initial notification:count on connection
    emitUnreadCount(io!, userId);

    // Dynamic room management
    socket.on("join:community", (communityId: string) => {
      socket.join(`community:${communityId}`);
    });

    socket.on("leave:community", (communityId: string) => {
      socket.leave(`community:${communityId}`);
    });
  });

  // Listen for app events and broadcast
  appEvents.on("activity", (event: AppEvent) => {
    if (!io) return;

    // Broadcast activity to community room (inchange)
    if (event.communityId) {
      io.to(`community:${event.communityId}`).emit("activity", {
        type: event.type,
        userId: event.userId,
        communityId: event.communityId,
        recipeId: event.recipeId,
        metadata: event.metadata,
      });
    }

    // Persister les notifications et emettre notification:new + notification:count
    const category = getCategoryForType(event.type);
    if (category) {
      handleNotificationCreation(io!, event).catch((err) => {
        logger.error({ err, event: event.type }, "Failed to handle notification creation");
      });
    }
  });

  return io;
}

/**
 * Gere la creation des notifications en DB et l'emission WebSocket.
 * Separe en broadcast (tous les membres sauf acteur) et personal (targetUserIds).
 */
async function handleNotificationCreation(ioServer: Server, event: AppEvent) {
  const templateVars = await resolveTemplateVars(event);

  if (BROADCAST_TYPES.has(event.type) && event.communityId) {
    // Notifications broadcast : tous les membres sauf l'acteur
    const notifications = await createBroadcastNotifications({
      type: event.type,
      actorId: event.userId,
      communityId: event.communityId,
      recipeId: event.recipeId,
      metadata: event.metadata,
      templateVars,
    });

    // Emettre notification:new a chaque destinataire connecte
    const notifiedUserIds = new Set<string>();
    for (const notif of notifications) {
      ioServer.to(`user:${notif.userId}`).emit("notification:new", {
        notification: notif,
      });
      notifiedUserIds.add(notif.userId);
    }

    // Emettre notification:count a chaque destinataire
    for (const userId of notifiedUserIds) {
      emitUnreadCount(ioServer, userId);
    }
  } else if (event.targetUserIds && event.targetUserIds.length > 0) {
    // Notifications personnelles (invitations, proposals, etc.)
    const notifiedUserIds: string[] = [];

    for (const targetUserId of event.targetUserIds) {
      const notification = await createNotification({
        userId: targetUserId,
        type: event.type,
        actorId: event.userId,
        communityId: event.communityId,
        recipeId: event.recipeId,
        metadata: event.metadata,
        templateVars,
      });

      if (notification) {
        ioServer.to(`user:${targetUserId}`).emit("notification:new", {
          notification,
        });
        notifiedUserIds.push(targetUserId);
      }
    }

    // Emettre notification:count a chaque destinataire
    for (const userId of notifiedUserIds) {
      emitUnreadCount(ioServer, userId);
    }
  }
}

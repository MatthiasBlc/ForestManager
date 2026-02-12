import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { RequestHandler } from "express";
import prisma from "../util/db";
import env from "../util/validateEnv";
import appEvents, { AppEvent } from "./eventEmitter";
import logger from "../util/logger";

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

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

    // Broadcast to community room
    if (event.communityId) {
      io.to(`community:${event.communityId}`).emit("activity", {
        type: event.type,
        userId: event.userId,
        communityId: event.communityId,
        recipeId: event.recipeId,
        metadata: event.metadata,
      });
    }

    // Send personal notifications to target users
    if (event.targetUserIds) {
      for (const targetUserId of event.targetUserIds) {
        io.to(`user:${targetUserId}`).emit("notification", {
          type: event.type,
          userId: event.userId,
          communityId: event.communityId,
          recipeId: event.recipeId,
          metadata: event.metadata,
        });
      }
    }
  });

  return io;
}

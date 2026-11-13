// Routes du centre de notifications et des preferences (C6.1) [F-NOT-1, F-NOT-2].
import {
  cursorQuerySchema,
  notificationParamsSchema,
  notificationPreferencesSchema,
  notificationSchema,
  notificationSpaceParamsSchema,
  pageSchema,
  unreadCountSchema,
  updateNotificationPreferenceBodySchema,
  updateSpaceNotificationPreferencesBodySchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { handle, reply } from "../http/validate.ts";
import * as notifications from "./service.ts";

export function notificationsRouter(ctx: Context): Router {
  const router = Router();
  router.use(["/me/notifications", "/me/notification-preferences"], requireAuth);

  router.get(
    "/me/notifications",
    handle({ query: cursorQuerySchema }, async ({ query }, req, res) => {
      const page = await notifications.listNotifications(ctx, currentUserId(req), query);
      reply(res, pageSchema(notificationSchema), page);
    })
  );

  router.get("/me/notifications/unread-count", async (req, res) => {
    const count = await notifications.unreadCount(ctx, currentUserId(req));
    reply(res, unreadCountSchema, { count });
  });

  router.post("/me/notifications/read-all", async (req, res) => {
    await notifications.markAllRead(ctx, currentUserId(req));
    res.status(204).end();
  });

  router.post(
    "/me/notifications/:notificationId/read",
    handle({ params: notificationParamsSchema }, async ({ params }, req, res) => {
      await notifications.markRead(ctx, currentUserId(req), params.notificationId);
      res.status(204).end();
    })
  );

  router.get("/me/notification-preferences", async (req, res) => {
    const preferences = await notifications.readPreferences(ctx, currentUserId(req));
    reply(res, notificationPreferencesSchema, preferences);
  });

  router.put(
    "/me/notification-preferences",
    handle({ body: updateNotificationPreferenceBodySchema }, async ({ body }, req, res) => {
      const preferences = await notifications.setGlobalPreference(
        ctx,
        currentUserId(req),
        body.category,
        body.enabled
      );
      reply(res, notificationPreferencesSchema, preferences);
    })
  );

  router.put(
    "/me/notification-preferences/spaces/:spaceId",
    handle(
      { params: notificationSpaceParamsSchema, body: updateSpaceNotificationPreferencesBodySchema },
      async ({ params, body }, req, res) => {
        const preferences = await notifications.setSpacePreferences(
          ctx,
          currentUserId(req),
          params.spaceId,
          body.categories
        );
        reply(res, notificationPreferencesSchema, preferences);
      }
    )
  );

  router.delete(
    "/me/notification-preferences/spaces/:spaceId",
    handle({ params: notificationSpaceParamsSchema }, async ({ params }, req, res) => {
      const preferences = await notifications.resetSpacePreferences(
        ctx,
        currentUserId(req),
        params.spaceId
      );
      reply(res, notificationPreferencesSchema, preferences);
    })
  );

  return router;
}

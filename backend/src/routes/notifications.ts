import express from "express";
import * as notificationsController from "../controllers/notifications";
import { validateUUID } from "../middleware/validateUUID";
import { validateBody } from "../middleware/validateBody";
import {
  markBatchAsReadSchema,
  markAllAsReadSchema,
  updateNotificationPreferenceSchema,
} from "../schemas/notification.schema";

const router = express.Router();

// GET /api/notifications
router.get("/", notificationsController.getNotifications);

// GET /api/notifications/unread-count
router.get("/unread-count", notificationsController.getUnreadCount);

// PATCH /api/notifications/read (batch) - doit etre avant /:id/read
router.patch("/read", validateBody(markBatchAsReadSchema), notificationsController.markBatchAsRead);

// PATCH /api/notifications/read-all
router.patch("/read-all", validateBody(markAllAsReadSchema), notificationsController.markAllAsRead);

// PATCH /api/notifications/:id/read
router.patch("/:id/read", validateUUID, notificationsController.markAsRead);

// GET /api/notifications/preferences
router.get("/preferences", notificationsController.getPreferences);

// PUT /api/notifications/preferences
router.put(
  "/preferences",
  validateBody(updateNotificationPreferenceSchema),
  notificationsController.updatePreference
);

export default router;

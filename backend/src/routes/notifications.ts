import express from "express";
import * as notificationsController from "../controllers/notifications";
import { validateUUID } from "../middleware/validateUUID";

const router = express.Router();

// GET /api/notifications
router.get("/", notificationsController.getNotifications);

// GET /api/notifications/unread-count
router.get("/unread-count", notificationsController.getUnreadCount);

// PATCH /api/notifications/read (batch) - doit etre avant /:id/read
router.patch("/read", notificationsController.markBatchAsRead);

// PATCH /api/notifications/read-all
router.patch("/read-all", notificationsController.markAllAsRead);

// PATCH /api/notifications/:id/read
router.patch("/:id/read", validateUUID, notificationsController.markAsRead);

// GET /api/notifications/preferences
router.get("/preferences", notificationsController.getPreferences);

// PUT /api/notifications/preferences
router.put("/preferences", notificationsController.updatePreference);

export default router;

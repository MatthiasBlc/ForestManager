import express from "express";
import * as notificationsController from "../controllers/notifications";

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
router.patch("/:id/read", notificationsController.markAsRead);

export default router;

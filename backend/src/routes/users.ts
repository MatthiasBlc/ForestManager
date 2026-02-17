import express from "express";
import * as InvitesController from "../controllers/invites";
import * as UsersController from "../controllers/users";
import * as ActivityController from "../controllers/activity";
import * as TagPreferencesController from "../controllers/tagPreferences";

const router = express.Router();

// Search users by username prefix
router.get("/search", UsersController.searchUsers);

// Update my profile
router.patch("/me", UsersController.updateProfile);

// Get my received invitations
router.get("/me/invites", InvitesController.getMyInvites);

// Get my activity feed
router.get("/me/activity", ActivityController.getMyActivity);

// Tag visibility preferences
router.get("/me/tag-preferences", TagPreferencesController.getTagPreferences);
router.put("/me/tag-preferences/:communityId", TagPreferencesController.updateTagPreference);

// Moderator notification preferences
router.get("/me/notification-preferences", TagPreferencesController.getNotificationPreferences);
router.put("/me/notification-preferences/tags", TagPreferencesController.updateGlobalNotificationPreference);
router.put("/me/notification-preferences/tags/:communityId", TagPreferencesController.updateCommunityNotificationPreference);

export default router;

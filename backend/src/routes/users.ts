import express from "express";
import * as InvitesController from "../controllers/invites";
import * as UsersController from "../controllers/users";
import * as ActivityController from "../controllers/activity";

const router = express.Router();

// Search users by username prefix
router.get("/search", UsersController.searchUsers);

// Update my profile
router.patch("/me", UsersController.updateProfile);

// Get my received invitations
router.get("/me/invites", InvitesController.getMyInvites);

// Get my activity feed
router.get("/me/activity", ActivityController.getMyActivity);

export default router;

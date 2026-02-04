import express from "express";
import * as InvitesController from "../controllers/invites";
import * as UsersController from "../controllers/users";

const router = express.Router();

// Search users by username prefix
router.get("/search", UsersController.searchUsers);

// Update my profile
router.patch("/me", UsersController.updateProfile);

// Get my received invitations
router.get("/me/invites", InvitesController.getMyInvites);

export default router;

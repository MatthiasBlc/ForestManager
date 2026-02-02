import express from "express";
import * as CommunitiesController from "../controllers/communities";
import * as InvitesController from "../controllers/invites";
import { memberOf, requireCommunityRole } from "../middleware/community";

const router = express.Router();

// List user's communities
router.get("/", CommunitiesController.getCommunities);

// Create a new community
router.post("/", CommunitiesController.createCommunity);

// Get community details (requires membership)
router.get("/:communityId", memberOf, CommunitiesController.getCommunity);

// Update community (requires MODERATOR role)
router.patch(
  "/:communityId",
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunitiesController.updateCommunity
);

// =====================================
// Invitation routes (require MODERATOR role)
// =====================================

// List invitations for a community
router.get(
  "/:communityId/invites",
  memberOf,
  requireCommunityRole("MODERATOR"),
  InvitesController.getInvites
);

// Create an invitation
router.post(
  "/:communityId/invites",
  memberOf,
  requireCommunityRole("MODERATOR"),
  InvitesController.createInvite
);

// Cancel an invitation
router.delete(
  "/:communityId/invites/:inviteId",
  memberOf,
  requireCommunityRole("MODERATOR"),
  InvitesController.cancelInvite
);

export default router;
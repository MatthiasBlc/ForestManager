import express from "express";
import * as CommunitiesController from "../controllers/communities";
import * as CommunityRecipesController from "../controllers/communityRecipes";
import * as InvitesController from "../controllers/invites";
import * as MembersController from "../controllers/members";
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
// Recipe routes (any member)
// =====================================

// List community recipes
router.get("/:communityId/recipes", memberOf, CommunityRecipesController.getCommunityRecipes);

// Create a community recipe
router.post("/:communityId/recipes", memberOf, CommunityRecipesController.createCommunityRecipe);

// =====================================
// Member routes
// =====================================

// List community members (any member)
router.get("/:communityId/members", memberOf, MembersController.getMembers);

// Promote a member (MODERATOR only)
router.patch(
  "/:communityId/members/:userId",
  memberOf,
  requireCommunityRole("MODERATOR"),
  MembersController.promoteMember
);

// Leave community (self) or kick member (MODERATOR)
router.delete(
  "/:communityId/members/:userId",
  memberOf,
  MembersController.removeMember
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
import express from "express";
import * as CommunitiesController from "../controllers/communities";
import * as CommunityImageController from "../controllers/communityImage";
import * as CommunityRecipesController from "../controllers/communityRecipes";
import * as CommunityTagsController from "../controllers/communityTags";
import * as InvitesController from "../controllers/invites";
import * as MembersController from "../controllers/members";
import * as ActivityController from "../controllers/activity";
import { memberOf, requireCommunityRole } from "../middleware/community";
import { validateUUID } from "../middleware/validateUUID";
import { validateBody } from "../middleware/validateBody";
import mealPlanRoutes from "./mealPlan";
import mealIdeasRoutes from "./mealIdeas";
import mealGenerationParamsRoutes from "./mealGenerationParams";
import { createRecipeSchema } from "../schemas/recipe.schema";
import { createCommunitySchema, updateCommunitySchema } from "../schemas/community.schema";
import { createInviteSchema } from "../schemas/invite.schema";
import { promoteMemberSchema } from "../schemas/member.schema";
import { communityTagSchema } from "../schemas/tag.schema";

const router = express.Router();

// List user's communities
router.get("/", CommunitiesController.getCommunities);

// Create a new community
router.post("/", validateBody(createCommunitySchema), CommunitiesController.createCommunity);

// Get community details (requires membership)
router.get("/:communityId", validateUUID, memberOf, CommunitiesController.getCommunity);

// Update community (requires MODERATOR role)
router.patch(
  "/:communityId",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  validateBody(updateCommunitySchema),
  CommunitiesController.updateCommunity
);

// =====================================
// Image upload routes (MODERATOR only)
// =====================================

router.post(
  "/:communityId/upload-url",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunityImageController.getUploadUrl
);

router.post(
  "/:communityId/confirm-upload",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunityImageController.confirmUpload
);

router.delete(
  "/:communityId/image",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunityImageController.deleteImage
);

// =====================================
// Recipe routes (any member)
// =====================================

// List community recipes
router.get(
  "/:communityId/recipes",
  validateUUID,
  memberOf,
  CommunityRecipesController.getCommunityRecipes
);

// Create a community recipe
router.post(
  "/:communityId/recipes",
  validateUUID,
  memberOf,
  validateBody(createRecipeSchema),
  CommunityRecipesController.createCommunityRecipe
);

// =====================================
// Member routes
// =====================================

// List community members (any member)
router.get("/:communityId/members", validateUUID, memberOf, MembersController.getMembers);

// Promote a member (MODERATOR only)
router.patch(
  "/:communityId/members/:userId",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  validateBody(promoteMemberSchema),
  MembersController.promoteMember
);

// Leave community (self) or kick member (MODERATOR)
router.delete(
  "/:communityId/members/:userId",
  validateUUID,
  memberOf,
  MembersController.removeMember
);

// =====================================
// Invitation routes (require MODERATOR role)
// =====================================

// List invitations for a community
router.get(
  "/:communityId/invites",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  InvitesController.getInvites
);

// Create an invitation
router.post(
  "/:communityId/invites",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  validateBody(createInviteSchema),
  InvitesController.createInvite
);

// Cancel an invitation
router.delete(
  "/:communityId/invites/:inviteId",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  InvitesController.cancelInvite
);

// =====================================
// Tag management routes (MODERATOR only)
// =====================================

// List community tags (APPROVED + PENDING)
router.get(
  "/:communityId/tags",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunityTagsController.getCommunityTags
);

// Create a community tag
router.post(
  "/:communityId/tags",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  validateBody(communityTagSchema),
  CommunityTagsController.createCommunityTag
);

// Rename a community tag
router.patch(
  "/:communityId/tags/:tagId",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  validateBody(communityTagSchema),
  CommunityTagsController.updateCommunityTag
);

// Delete a community tag
router.delete(
  "/:communityId/tags/:tagId",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunityTagsController.deleteCommunityTag
);

// Approve a pending tag
router.post(
  "/:communityId/tags/:tagId/approve",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunityTagsController.approveCommunityTag
);

// Reject a pending tag
router.post(
  "/:communityId/tags/:tagId/reject",
  validateUUID,
  memberOf,
  requireCommunityRole("MODERATOR"),
  CommunityTagsController.rejectCommunityTag
);

// =====================================
// Meal Plan routes (feature-gated)
// =====================================

router.use("/:communityId/meal-plan", mealPlanRoutes);

// =====================================
// Meal Ideas routes (feature-gated)
// =====================================

router.use("/:communityId/meal-ideas", mealIdeasRoutes);

// =====================================
// Meal Generation Params routes (feature-gated)
// =====================================

router.use("/:communityId/meal-generation-params", mealGenerationParamsRoutes);

// =====================================
// Activity feed
// =====================================

// Get community activity feed (any member)
router.get(
  "/:communityId/activity",
  validateUUID,
  memberOf,
  ActivityController.getCommunityActivity
);

export default router;

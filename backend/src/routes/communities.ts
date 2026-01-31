import express from "express";
import * as CommunitiesController from "../controllers/communities";
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

export default router;
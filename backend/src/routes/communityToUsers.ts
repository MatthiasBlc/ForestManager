import express from "express";
import * as CommunitiesController from "../controllers/communityToUsers";

const router = express.Router();

// router.get("/", CommunitiesController.getCommunities);

// router.get("/:communityId", CommunitiesController.getCommunity);

router.post("/", CommunitiesController.joinCommunity);

// router.patch("/:communityId", CommunitiesController.updateCommunity);

// router.delete("/:recipeId", CommunitiesController.deleteRecipe);


export default router;
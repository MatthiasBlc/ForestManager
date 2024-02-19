import express from "express";
import * as CommunitiesController from "../controllers/communities";

const router = express.Router();

router.get("/", CommunitiesController.getCommunities);

// router.get("/:recipeId", CommunitiesController.getRecipe);

// router.post("/", CommunitiesController.createRecipe);

// router.patch("/:recipeId", CommunitiesController.updateRecipe);

// router.delete("/:recipeId", CommunitiesController.deleteRecipe);


export default router;
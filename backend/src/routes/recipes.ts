import express from "express";
import * as RecipesController from "../controllers/recipes";
import * as ProposalsController from "../controllers/proposals";

const router = express.Router();

router.get("/", RecipesController.getRecipes);

router.get("/:recipeId", RecipesController.getRecipe);

router.post("/", RecipesController.createRecipe);

router.patch("/:recipeId", RecipesController.updateRecipe);

router.delete("/:recipeId", RecipesController.deleteRecipe);

// Variants routes on recipes
router.get("/:recipeId/variants", RecipesController.getVariants);

// Proposals routes on recipes
router.get("/:recipeId/proposals", ProposalsController.getProposals);

router.post("/:recipeId/proposals", ProposalsController.createProposal);

// Share recipe to another community (fork)
router.post("/:recipeId/share", RecipesController.shareRecipe);

// Publish personal recipe to communities
router.post("/:recipeId/publish", RecipesController.publishToCommunities);

// Get communities where a recipe has copies
router.get("/:recipeId/communities", RecipesController.getRecipeCommunities);

export default router;
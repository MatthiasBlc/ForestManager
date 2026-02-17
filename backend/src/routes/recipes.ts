import express from "express";
import * as RecipesController from "../controllers/recipes";
import * as RecipeVariantsController from "../controllers/recipeVariants";
import * as RecipeShareController from "../controllers/recipeShare";
import * as ProposalsController from "../controllers/proposals";
import * as TagSuggestionsController from "../controllers/tagSuggestions";

const router = express.Router();

router.get("/", RecipesController.getRecipes);

router.get("/:recipeId", RecipesController.getRecipe);

router.post("/", RecipesController.createRecipe);

router.patch("/:recipeId", RecipesController.updateRecipe);

router.delete("/:recipeId", RecipesController.deleteRecipe);

// Variants routes on recipes
router.get("/:recipeId/variants", RecipeVariantsController.getVariants);

// Proposals routes on recipes
router.get("/:recipeId/proposals", ProposalsController.getProposals);

router.post("/:recipeId/proposals", ProposalsController.createProposal);

// Tag suggestions routes on recipes
router.get("/:recipeId/tag-suggestions", TagSuggestionsController.getTagSuggestions);

router.post("/:recipeId/tag-suggestions", TagSuggestionsController.createTagSuggestion);

// Share recipe to another community (fork)
router.post("/:recipeId/share", RecipeShareController.shareRecipe);

// Publish personal recipe to communities
router.post("/:recipeId/publish", RecipeShareController.publishToCommunities);

// Get communities where a recipe has copies
router.get("/:recipeId/communities", RecipeShareController.getRecipeCommunities);

export default router;
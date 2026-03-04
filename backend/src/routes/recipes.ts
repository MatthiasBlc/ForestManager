import express from "express";
import * as RecipesController from "../controllers/recipes";
import * as RecipeVariantsController from "../controllers/recipeVariants";
import * as RecipeShareController from "../controllers/recipeShare";
import * as ProposalsController from "../controllers/proposals";
import * as TagSuggestionsController from "../controllers/tagSuggestions";
import { validateUUID } from "../middleware/validateUUID";

const router = express.Router();

router.get("/", RecipesController.getRecipes);

router.get("/:recipeId", validateUUID, RecipesController.getRecipe);

router.post("/", RecipesController.createRecipe);

router.patch("/:recipeId", validateUUID, RecipesController.updateRecipe);

router.delete("/:recipeId", validateUUID, RecipesController.deleteRecipe);

// Variants routes on recipes
router.get("/:recipeId/variants", validateUUID, RecipeVariantsController.getVariants);

// Proposals routes on recipes
router.get("/:recipeId/proposals", validateUUID, ProposalsController.getProposals);

router.post("/:recipeId/proposals", validateUUID, ProposalsController.createProposal);

// Tag suggestions routes on recipes
router.get("/:recipeId/tag-suggestions", validateUUID, TagSuggestionsController.getTagSuggestions);

router.post("/:recipeId/tag-suggestions", validateUUID, TagSuggestionsController.createTagSuggestion);

// Share recipe to another community (fork)
router.post("/:recipeId/share", validateUUID, RecipeShareController.shareRecipe);

// Publish personal recipe to communities
router.post("/:recipeId/publish", validateUUID, RecipeShareController.publishToCommunities);

// Get communities where a recipe has copies
router.get("/:recipeId/communities", validateUUID, RecipeShareController.getRecipeCommunities);

export default router;
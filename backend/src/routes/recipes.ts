import express from "express";
import * as RecipesController from "../controllers/recipes";
import * as RecipeImageController from "../controllers/recipeImage";
import * as RecipeVariantsController from "../controllers/recipeVariants";
import * as RecipeShareController from "../controllers/recipeShare";
import * as RecipeImportController from "../controllers/recipeImport";
import * as ProposalsController from "../controllers/proposals";
import * as TagSuggestionsController from "../controllers/tagSuggestions";
import { validateUUID } from "../middleware/validateUUID";
import { validateBody } from "../middleware/validateBody";
import { createRecipeSchema, updateRecipeSchema } from "../schemas/recipe.schema";
import { createProposalSchema } from "../schemas/proposal.schema";
import { shareRecipeSchema, publishToCommunitySchema } from "../schemas/recipeShare.schema";
import { createTagSuggestionSchema } from "../schemas/tag.schema";

const router = express.Router();

// Import route (must be before /:recipeId to avoid UUID validation)
router.post("/import-url", RecipeImportController.importRecipeFromUrl);

router.get("/", RecipesController.getRecipes);

router.get("/:recipeId", validateUUID, RecipesController.getRecipe);

router.post("/", validateBody(createRecipeSchema), RecipesController.createRecipe);

router.patch(
  "/:recipeId",
  validateUUID,
  validateBody(updateRecipeSchema),
  RecipesController.updateRecipe
);

router.delete("/:recipeId", validateUUID, RecipesController.deleteRecipe);

// Image upload routes
router.post("/:recipeId/upload-url", validateUUID, RecipeImageController.getUploadUrl);
router.post("/:recipeId/confirm-upload", validateUUID, RecipeImageController.confirmUpload);
router.delete("/:recipeId/image", validateUUID, RecipeImageController.deleteImage);

// Variants routes on recipes
router.get("/:recipeId/variants", validateUUID, RecipeVariantsController.getVariants);

// Proposals routes on recipes
router.get("/:recipeId/proposals", validateUUID, ProposalsController.getProposals);

router.post(
  "/:recipeId/proposals",
  validateUUID,
  validateBody(createProposalSchema),
  ProposalsController.createProposal
);

// Tag suggestions routes on recipes
router.get("/:recipeId/tag-suggestions", validateUUID, TagSuggestionsController.getTagSuggestions);

router.post(
  "/:recipeId/tag-suggestions",
  validateUUID,
  validateBody(createTagSuggestionSchema),
  TagSuggestionsController.createTagSuggestion
);

// Share recipe to another community (fork)
router.post(
  "/:recipeId/share",
  validateUUID,
  validateBody(shareRecipeSchema),
  RecipeShareController.shareRecipe
);

// Publish personal recipe to communities
router.post(
  "/:recipeId/publish",
  validateUUID,
  validateBody(publishToCommunitySchema),
  RecipeShareController.publishToCommunities
);

// Get communities where a recipe has copies
router.get("/:recipeId/communities", validateUUID, RecipeShareController.getRecipeCommunities);

export default router;

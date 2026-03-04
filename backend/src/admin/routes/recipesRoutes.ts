import express from "express";
import * as recipesController from "../controllers/recipesController";
import { validateUUID } from "../../middleware/validateUUID";

const router = express.Router();

// GET /api/admin/recipes/:recipeId - Detail complet d'une recette
router.get("/:recipeId", validateUUID, recipesController.getDetail);

// PATCH /api/admin/recipes/:recipeId - Modifier une recette
router.patch("/:recipeId", validateUUID, recipesController.update);

// DELETE /api/admin/recipes/:recipeId - Soft delete une recette
router.delete("/:recipeId", validateUUID, recipesController.remove);

export default router;

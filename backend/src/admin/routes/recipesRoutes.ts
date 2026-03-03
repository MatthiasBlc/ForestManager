import express from "express";
import * as recipesController from "../controllers/recipesController";

const router = express.Router();

// GET /api/admin/recipes/:recipeId - Detail complet d'une recette
router.get("/:recipeId", recipesController.getDetail);

// PATCH /api/admin/recipes/:recipeId - Modifier une recette
router.patch("/:recipeId", recipesController.update);

// DELETE /api/admin/recipes/:recipeId - Soft delete une recette
router.delete("/:recipeId", recipesController.remove);

export default router;

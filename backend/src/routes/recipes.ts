import express from "express";
import * as RecipesController from "../controllers/recipes";

const router = express.Router();

router.get("/", RecipesController.getRecipes);

router.get("/:recipeId", RecipesController.getRecipe);

router.post("/", RecipesController.createRecipe);

router.patch("/:recipeId", RecipesController.updateRecipe);

router.delete("/:recipeId", RecipesController.deleteRecipe);


export default router;
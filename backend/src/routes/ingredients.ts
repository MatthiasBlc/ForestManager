import express from "express";
import * as IngredientsController from "../controllers/ingredients";

const router = express.Router();

router.get("/", IngredientsController.searchIngredients);
router.get("/:id/suggested-unit", IngredientsController.getSuggestedUnit);

export default router;

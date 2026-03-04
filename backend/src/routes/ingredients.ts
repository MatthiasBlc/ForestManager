import express from "express";
import * as IngredientsController from "../controllers/ingredients";
import { validateUUID } from "../middleware/validateUUID";

const router = express.Router();

router.get("/", IngredientsController.searchIngredients);
router.get("/:id/suggested-unit", validateUUID, IngredientsController.getSuggestedUnit);

export default router;

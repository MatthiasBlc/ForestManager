import express from "express";
import { memberOf } from "../middleware/community";
import { validateUUID } from "../middleware/validateUUID";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody } from "../middleware/validateBody";
import { createMealIdeaSchema, updateMealIdeaSchema } from "../schemas/mealPlan.schema";
import * as MealIdeasController from "../controllers/mealIdeas";

const router = express.Router({ mergeParams: true });

// Tous les endpoints meal-ideas requierent membership + feature MEAL_PLAN
router.use(validateUUID, memberOf, requireFeature("MEAL_PLAN"));

// GET /api/communities/:communityId/meal-ideas — Liste paginee (memberOf)
router.get("/", MealIdeasController.listIdeas);

// POST /api/communities/:communityId/meal-ideas — Creer une idee (memberOf)
router.post("/", validateBody(createMealIdeaSchema), MealIdeasController.createIdea);

// PATCH /api/communities/:communityId/meal-ideas/:ideaId — Modifier (createur ou MODERATOR)
router.patch("/:ideaId", validateBody(updateMealIdeaSchema), MealIdeasController.updateIdea);

// DELETE /api/communities/:communityId/meal-ideas/:ideaId — Soft delete (createur ou MODERATOR)
router.delete("/:ideaId", MealIdeasController.deleteIdea);

export default router;

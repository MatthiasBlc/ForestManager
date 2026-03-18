import express from "express";
import { memberOf } from "../middleware/community";
import { validateUUID } from "../middleware/validateUUID";
import { requireFeature } from "../middleware/requireFeature";
import * as MealPlanController from "../controllers/mealPlan";

const router = express.Router({ mergeParams: true });

// Tous les endpoints meal-plan requierent membership + feature MEAL_PLAN
router.use(validateUUID, memberOf, requireFeature("MEAL_PLAN"));

// GET /api/communities/:communityId/meal-plan — Plan ACTIVE + slots
router.get("/", MealPlanController.getActivePlan);

export default router;

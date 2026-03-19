import express from "express";
import { memberOf, requireCommunityRole } from "../middleware/community";
import { validateUUID } from "../middleware/validateUUID";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody } from "../middleware/validateBody";
import {
  createMealGenerationParamsSchema,
  updateMealGenerationParamsSchema,
} from "../schemas/mealPlan.schema";
import * as MealGenerationParamsController from "../controllers/mealGenerationParams";

const router = express.Router({ mergeParams: true });

// Tous les endpoints requierent membership + feature MEAL_PLAN
router.use(validateUUID, memberOf, requireFeature("MEAL_PLAN"));

// GET /api/communities/:communityId/meal-generation-params — Liste (memberOf)
router.get("/", MealGenerationParamsController.listParams);

// POST /api/communities/:communityId/meal-generation-params — Creer (MODERATOR)
router.post(
  "/",
  requireCommunityRole("MODERATOR"),
  validateBody(createMealGenerationParamsSchema),
  MealGenerationParamsController.createParams
);

// GET /api/communities/:communityId/meal-generation-params/:paramsId — Detail (memberOf)
router.get("/:paramsId", MealGenerationParamsController.getParamsDetail);

// PATCH /api/communities/:communityId/meal-generation-params/:paramsId — Modifier (MODERATOR)
router.patch(
  "/:paramsId",
  requireCommunityRole("MODERATOR"),
  validateBody(updateMealGenerationParamsSchema),
  MealGenerationParamsController.updateParams
);

// DELETE /api/communities/:communityId/meal-generation-params/:paramsId — Soft delete (MODERATOR)
router.delete(
  "/:paramsId",
  requireCommunityRole("MODERATOR"),
  MealGenerationParamsController.deleteParams
);

export default router;

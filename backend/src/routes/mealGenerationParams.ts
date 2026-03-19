import express from "express";
import { memberOf, requireCommunityRole } from "../middleware/community";
import { validateUUID } from "../middleware/validateUUID";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody } from "../middleware/validateBody";
import {
  createMealGenerationParamsSchema,
  updateMealGenerationParamsSchema,
  setExclusionsSchema,
  createRuleSchema,
  updateRuleSchema,
  setPinsSchema,
} from "../schemas/mealGeneration.schema";
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

// =============================================
// Exclusions
// =============================================

// PUT .../meal-generation-params/:paramsId/exclusions — Set complet (MODERATOR)
router.put(
  "/:paramsId/exclusions",
  requireCommunityRole("MODERATOR"),
  validateBody(setExclusionsSchema),
  MealGenerationParamsController.setExclusions
);

// =============================================
// Rules
// =============================================

// GET .../meal-generation-params/:paramsId/rules — Liste (memberOf)
router.get("/:paramsId/rules", MealGenerationParamsController.listRules);

// POST .../meal-generation-params/:paramsId/rules — Ajouter (MODERATOR)
router.post(
  "/:paramsId/rules",
  requireCommunityRole("MODERATOR"),
  validateBody(createRuleSchema),
  MealGenerationParamsController.createRule
);

// PATCH .../meal-generation-params/:paramsId/rules/:ruleId — Modifier (MODERATOR)
router.patch(
  "/:paramsId/rules/:ruleId",
  requireCommunityRole("MODERATOR"),
  validateBody(updateRuleSchema),
  MealGenerationParamsController.updateRule
);

// DELETE .../meal-generation-params/:paramsId/rules/:ruleId — Supprimer (MODERATOR, hard delete)
router.delete(
  "/:paramsId/rules/:ruleId",
  requireCommunityRole("MODERATOR"),
  MealGenerationParamsController.deleteRule
);

// =============================================
// Pins
// =============================================

// PUT .../meal-generation-params/:paramsId/pins — Set complet (MODERATOR)
router.put(
  "/:paramsId/pins",
  requireCommunityRole("MODERATOR"),
  validateBody(setPinsSchema),
  MealGenerationParamsController.setPins
);

export default router;

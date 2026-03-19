import express from "express";
import { memberOf, requireCommunityRole } from "../middleware/community";
import { validateUUID } from "../middleware/validateUUID";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody } from "../middleware/validateBody";
import {
  createMealPlanSchema,
  updateMealPlanSchema,
  updateSlotSchema,
  swapSlotsSchema,
  generateSchema,
  replaceSlotSchema,
} from "../schemas/mealPlan.schema";
import * as MealPlanController from "../controllers/mealPlan";

const router = express.Router({ mergeParams: true });

// Tous les endpoints meal-plan requierent membership + feature MEAL_PLAN
router.use(validateUUID, memberOf, requireFeature("MEAL_PLAN"));

// GET /api/communities/:communityId/meal-plan — Plan ACTIVE + slots (memberOf)
router.get("/", MealPlanController.getActivePlan);

// POST /api/communities/:communityId/meal-plan — Creer plan + slots (MODERATOR)
router.post(
  "/",
  requireCommunityRole("MODERATOR"),
  validateBody(createMealPlanSchema),
  MealPlanController.createPlan
);

// DELETE /api/communities/:communityId/meal-plan — Supprimer plan ACTIVE (MODERATOR)
router.delete("/", requireCommunityRole("MODERATOR"), MealPlanController.deletePlan);

// PATCH /api/communities/:communityId/meal-plan — Update plan settings (MODERATOR)
router.patch(
  "/",
  requireCommunityRole("MODERATOR"),
  validateBody(updateMealPlanSchema),
  MealPlanController.updatePlan
);

// POST /api/communities/:communityId/meal-plan/generate — Generer le planning (MODERATOR)
router.post(
  "/generate",
  requireCommunityRole("MODERATOR"),
  validateBody(generateSchema),
  MealPlanController.generatePlan
);

// PATCH /api/communities/:communityId/meal-plan/slots/:slotId — Update slot (permission dynamique)
router.patch("/slots/:slotId", validateBody(updateSlotSchema), MealPlanController.updateSlot);

// POST /api/communities/:communityId/meal-plan/slots/:slotId/replace — Re-generer 1 slot (MODERATOR)
router.post(
  "/slots/:slotId/replace",
  requireCommunityRole("MODERATOR"),
  validateBody(replaceSlotSchema),
  MealPlanController.replaceSlot
);

// POST /api/communities/:communityId/meal-plan/slots/swap — Swap 2 slots (permission dynamique)
router.post("/slots/swap", validateBody(swapSlotsSchema), MealPlanController.swapSlots);

// GET /api/communities/:communityId/meal-plan/archives — Liste paginee (memberOf)
router.get("/archives", MealPlanController.getArchives);

// GET /api/communities/:communityId/meal-plan/archives/:planId — Detail archive (memberOf)
router.get("/archives/:planId", MealPlanController.getArchiveDetail);

// DELETE /api/communities/:communityId/meal-plan/archives/:planId — Supprimer archive (MODERATOR)
router.delete(
  "/archives/:planId",
  requireCommunityRole("MODERATOR"),
  MealPlanController.deleteArchive
);

export default router;

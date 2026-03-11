import express from "express";
import * as ingredientsController from "../controllers/ingredientsController";
import { validateUUID } from "../../middleware/validateUUID";
import { validateBody } from "../../middleware/validateBody";
import {
  adminCreateIngredientSchema,
  adminUpdateIngredientSchema,
  adminApproveIngredientSchema,
  adminRejectIngredientSchema,
  adminMergeIngredientSchema,
} from "../schemas/ingredient.schema";

const router = express.Router();

// GET /api/admin/ingredients - Liste tous les ingredients
router.get("/", ingredientsController.getAll);

// POST /api/admin/ingredients - Cree un ingredient
router.post("/", validateBody(adminCreateIngredientSchema), ingredientsController.create);

// PATCH /api/admin/ingredients/:id - Modifie un ingredient
router.patch(
  "/:id",
  validateUUID,
  validateBody(adminUpdateIngredientSchema),
  ingredientsController.update
);

// DELETE /api/admin/ingredients/:id - Supprime un ingredient
router.delete("/:id", validateUUID, ingredientsController.remove);

// POST /api/admin/ingredients/:id/merge - Fusionne un ingredient dans un autre
router.post(
  "/:id/merge",
  validateUUID,
  validateBody(adminMergeIngredientSchema),
  ingredientsController.merge
);

// POST /api/admin/ingredients/:id/approve - Approuve un ingredient PENDING
router.post(
  "/:id/approve",
  validateUUID,
  validateBody(adminApproveIngredientSchema),
  ingredientsController.approve
);

// POST /api/admin/ingredients/:id/reject - Rejette un ingredient PENDING
router.post(
  "/:id/reject",
  validateUUID,
  validateBody(adminRejectIngredientSchema),
  ingredientsController.reject
);

export default router;

import express from "express";
import * as ingredientsController from "../controllers/ingredientsController";
import { validateUUID } from "../../middleware/validateUUID";

const router = express.Router();

// GET /api/admin/ingredients - Liste tous les ingredients
router.get("/", ingredientsController.getAll);

// POST /api/admin/ingredients - Cree un ingredient
router.post("/", ingredientsController.create);

// PATCH /api/admin/ingredients/:id - Modifie un ingredient
router.patch("/:id", validateUUID, ingredientsController.update);

// DELETE /api/admin/ingredients/:id - Supprime un ingredient
router.delete("/:id", validateUUID, ingredientsController.remove);

// POST /api/admin/ingredients/:id/merge - Fusionne un ingredient dans un autre
router.post("/:id/merge", validateUUID, ingredientsController.merge);

// POST /api/admin/ingredients/:id/approve - Approuve un ingredient PENDING
router.post("/:id/approve", validateUUID, ingredientsController.approve);

// POST /api/admin/ingredients/:id/reject - Rejette un ingredient PENDING
router.post("/:id/reject", validateUUID, ingredientsController.reject);

export default router;

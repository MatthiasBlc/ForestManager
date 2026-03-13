import express from "express";
import * as unitsController from "../controllers/unitsController";
import { validateUUID } from "../../middleware/validateUUID";
import { validateBody } from "../../middleware/validateBody";
import { adminCreateUnitSchema, adminUpdateUnitSchema } from "../schemas/unit.schema";

const router = express.Router();

// GET /api/admin/units - Liste toutes les unites
router.get("/", unitsController.getAll);

// POST /api/admin/units - Cree une unite
router.post("/", validateBody(adminCreateUnitSchema), unitsController.create);

// PATCH /api/admin/units/:id - Modifie une unite
router.patch("/:id", validateUUID, validateBody(adminUpdateUnitSchema), unitsController.update);

// DELETE /api/admin/units/:id - Supprime une unite
router.delete("/:id", validateUUID, unitsController.remove);

export default router;

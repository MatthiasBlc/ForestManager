import express from "express";
import * as unitsController from "../controllers/unitsController";

const router = express.Router();

// GET /api/admin/units - Liste toutes les unites
router.get("/", unitsController.getAll);

// POST /api/admin/units - Cree une unite
router.post("/", unitsController.create);

// PATCH /api/admin/units/:id - Modifie une unite
router.patch("/:id", unitsController.update);

// DELETE /api/admin/units/:id - Supprime une unite
router.delete("/:id", unitsController.remove);

export default router;

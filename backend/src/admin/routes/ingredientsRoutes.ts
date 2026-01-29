import express from "express";
import * as ingredientsController from "../controllers/ingredientsController";

const router = express.Router();

// GET /api/admin/ingredients - Liste tous les ingredients
router.get("/", ingredientsController.getAll);

// POST /api/admin/ingredients - Cree un ingredient
router.post("/", ingredientsController.create);

// PATCH /api/admin/ingredients/:id - Renomme un ingredient
router.patch("/:id", ingredientsController.update);

// DELETE /api/admin/ingredients/:id - Supprime un ingredient
router.delete("/:id", ingredientsController.remove);

// POST /api/admin/ingredients/:id/merge - Fusionne un ingredient dans un autre
router.post("/:id/merge", ingredientsController.merge);

export default router;

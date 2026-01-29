import express from "express";
import * as featuresController from "../controllers/featuresController";

const router = express.Router();

// GET /api/admin/features - Liste toutes les features
router.get("/", featuresController.getAll);

// POST /api/admin/features - Cree une feature
router.post("/", featuresController.create);

// PATCH /api/admin/features/:id - Modifie une feature
router.patch("/:id", featuresController.update);

export default router;

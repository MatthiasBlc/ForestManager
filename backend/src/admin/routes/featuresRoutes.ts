import express from "express";
import * as featuresController from "../controllers/featuresController";
import { validateBody } from "../../middleware/validateBody";
import { adminCreateFeatureSchema, adminUpdateFeatureSchema } from "../schemas/feature.schema";

const router = express.Router();

// GET /api/admin/features - Liste toutes les features
router.get("/", featuresController.getAll);

// POST /api/admin/features - Cree une feature
router.post("/", validateBody(adminCreateFeatureSchema), featuresController.create);

// PATCH /api/admin/features/:id - Modifie une feature
router.patch("/:id", validateBody(adminUpdateFeatureSchema), featuresController.update);

export default router;

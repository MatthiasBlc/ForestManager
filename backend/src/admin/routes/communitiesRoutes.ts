import express from "express";
import * as communitiesController from "../controllers/communitiesController";
import * as featuresController from "../controllers/featuresController";

const router = express.Router();

// GET /api/admin/communities - Liste toutes les communautes
router.get("/", communitiesController.getAll);

// GET /api/admin/communities/:id - Detail d'une communaute
router.get("/:id", communitiesController.getOne);

// PATCH /api/admin/communities/:id - Modifie une communaute
router.patch("/:id", communitiesController.update);

// DELETE /api/admin/communities/:id - Soft delete une communaute
router.delete("/:id", communitiesController.remove);

// POST /api/admin/communities/:communityId/features/:featureId - Attribue une feature
router.post("/:communityId/features/:featureId", featuresController.grant);

// DELETE /api/admin/communities/:communityId/features/:featureId - Revoque une feature
router.delete("/:communityId/features/:featureId", featuresController.revoke);

export default router;

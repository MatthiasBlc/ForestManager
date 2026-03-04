import express from "express";
import * as communitiesController from "../controllers/communitiesController";
import * as featuresController from "../controllers/featuresController";
import { validateUUID } from "../../middleware/validateUUID";

const router = express.Router();

// GET /api/admin/communities - Liste toutes les communautes
router.get("/", communitiesController.getAll);

// GET /api/admin/communities/:id - Detail d'une communaute
router.get("/:id", validateUUID, communitiesController.getOne);

// PATCH /api/admin/communities/:id - Modifie une communaute
router.patch("/:id", validateUUID, communitiesController.update);

// DELETE /api/admin/communities/:id - Soft delete une communaute
router.delete("/:id", validateUUID, communitiesController.remove);

// POST /api/admin/communities/:communityId/features/:featureId - Attribue une feature
router.post("/:communityId/features/:featureId", validateUUID, featuresController.grant);

// DELETE /api/admin/communities/:communityId/features/:featureId - Revoque une feature
router.delete("/:communityId/features/:featureId", validateUUID, featuresController.revoke);

export default router;

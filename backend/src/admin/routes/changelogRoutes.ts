import express from "express";
import * as changelogController from "../controllers/changelogController";
import { validateUUID } from "../../middleware/validateUUID";
import { validateBody } from "../../middleware/validateBody";
import {
  adminCreateChangelogSchema,
  adminUpdateChangelogSchema,
} from "../schemas/changelog.schema";

const router = express.Router();

// GET /api/admin/changelog - Liste paginee
router.get("/", changelogController.getAll);

// POST /api/admin/changelog - Creation manuelle
router.post("/", validateBody(adminCreateChangelogSchema), changelogController.create);

// PATCH /api/admin/changelog/:id - Modification
router.patch(
  "/:id",
  validateUUID,
  validateBody(adminUpdateChangelogSchema),
  changelogController.update
);

// DELETE /api/admin/changelog/:id - Soft delete
router.delete("/:id", validateUUID, changelogController.remove);

export default router;

import express from "express";
import * as changelogController from "../controllers/changelog";
import { validateUUID } from "../middleware/validateUUID";

const router = express.Router();

// GET /api/changelog - Liste paginee
router.get("/", changelogController.getAll);

// GET /api/changelog/:id - Detail
router.get("/:id", validateUUID, changelogController.getById);

export default router;

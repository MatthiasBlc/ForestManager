import express from "express";
import * as activityController from "../controllers/activityController";

const router = express.Router();

// GET /api/admin/activity - Liste des activites admin
router.get("/", activityController.getAll);

export default router;

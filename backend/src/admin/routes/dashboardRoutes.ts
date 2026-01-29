import express from "express";
import * as dashboardController from "../controllers/dashboardController";

const router = express.Router();

// GET /api/admin/dashboard/stats - Statistiques globales
router.get("/stats", dashboardController.getStats);

export default router;

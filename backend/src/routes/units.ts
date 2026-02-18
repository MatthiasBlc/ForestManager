import express from "express";
import * as UnitsController from "../controllers/units";

const router = express.Router();

router.get("/", UnitsController.getUnits);

export default router;

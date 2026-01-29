import express from "express";
import * as TagsController from "../controllers/tags";

const router = express.Router();

router.get("/", TagsController.searchTags);

export default router;

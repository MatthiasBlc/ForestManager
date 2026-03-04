import express from "express";
import * as TagSuggestionsController from "../controllers/tagSuggestions";
import { validateUUID } from "../middleware/validateUUID";

const router = express.Router();

// POST /api/tag-suggestions/:id/accept
router.post("/:id/accept", validateUUID, TagSuggestionsController.acceptTagSuggestion);

// POST /api/tag-suggestions/:id/reject
router.post("/:id/reject", validateUUID, TagSuggestionsController.rejectTagSuggestion);

export default router;

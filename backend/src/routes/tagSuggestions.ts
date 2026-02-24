import express from "express";
import * as TagSuggestionsController from "../controllers/tagSuggestions";

const router = express.Router();

// POST /api/tag-suggestions/:id/accept
router.post("/:id/accept", TagSuggestionsController.acceptTagSuggestion);

// POST /api/tag-suggestions/:id/reject
router.post("/:id/reject", TagSuggestionsController.rejectTagSuggestion);

export default router;

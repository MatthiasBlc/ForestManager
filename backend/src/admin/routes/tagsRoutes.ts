import express from "express";
import * as tagsController from "../controllers/tagsController";
import * as recipesController from "../controllers/recipesController";
import { validateUUID } from "../../middleware/validateUUID";
import { validateBody } from "../../middleware/validateBody";
import {
  adminCreateTagSchema,
  adminUpdateTagSchema,
  adminMergeTagSchema,
} from "../schemas/tag.schema";

const router = express.Router();

// GET /api/admin/tags - Liste tous les tags
router.get("/", tagsController.getAll);

// POST /api/admin/tags - Cree un tag
router.post("/", validateBody(adminCreateTagSchema), tagsController.create);

// PATCH /api/admin/tags/:id - Renomme un tag
router.patch("/:id", validateUUID, validateBody(adminUpdateTagSchema), tagsController.update);

// DELETE /api/admin/tags/:id - Supprime un tag
router.delete("/:id", validateUUID, tagsController.remove);

// GET /api/admin/tags/:id/recipes - Liste les recettes d'un tag
router.get("/:id/recipes", validateUUID, recipesController.getTagRecipes);

// POST /api/admin/tags/:id/merge - Fusionne un tag dans un autre
router.post("/:id/merge", validateUUID, validateBody(adminMergeTagSchema), tagsController.merge);

export default router;

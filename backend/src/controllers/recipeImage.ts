import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { requireRecipeOwnership } from "../services/membershipService";
import {
  generatePresignedUploadUrl,
  validateUploadedFile,
  deleteObject,
} from "../services/storageService";
import { buildImageUrl } from "../config/storage";

/**
 * POST /api/recipes/:recipeId/upload-url
 * Genere une presigned PUT URL pour uploader une image de recette.
 * Seul l'auteur de la recette peut uploader.
 */
export const getUploadUrl: RequestHandler = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, deletedAt: null },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    await requireRecipeOwnership(authenticatedUserId, recipe);

    const imageKey = `recipes/${recipeId}/cover.webp`;
    const uploadUrl = await generatePresignedUploadUrl(imageKey);

    res.status(200).json({ uploadUrl, imageKey });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/recipes/:recipeId/confirm-upload
 * Confirme l'upload et valide le fichier sur MinIO.
 * Si invalide, supprime le fichier et renvoie une erreur.
 */
export const confirmUpload: RequestHandler = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, deletedAt: null },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    await requireRecipeOwnership(authenticatedUserId, recipe);

    const imageKey = `recipes/${recipeId}/cover.webp`;

    const validationError = await validateUploadedFile(imageKey);
    if (validationError) {
      await deleteObject(imageKey);
      throw createHttpError(400, `RECIPE_005: ${validationError}`);
    }

    await prisma.recipe.update({
      where: { id: recipeId },
      data: { imageKey },
    });

    res.status(200).json({
      imageKey,
      imageUrl: buildImageUrl(imageKey),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/recipes/:recipeId/image
 * Supprime l'image de la recette (MinIO + DB).
 */
export const deleteImage: RequestHandler = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, deletedAt: null },
    });

    if (!recipe) {
      throw createHttpError(404, "RECIPE_001: Recipe not found");
    }

    await requireRecipeOwnership(authenticatedUserId, recipe);

    if (recipe.imageKey) {
      await deleteObject(recipe.imageKey);
    }

    await prisma.recipe.update({
      where: { id: recipeId },
      data: { imageKey: null },
    });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

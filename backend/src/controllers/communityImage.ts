import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import {
  generatePresignedUploadUrl,
  validateUploadedFile,
  deleteObject,
} from "../services/storageService";
import { buildImageUrl } from "../config/storage";
import { COMMUNITY_002 } from "../constants/errorCodes";

/**
 * POST /api/communities/:communityId/upload-url
 * Genere une presigned PUT URL pour uploader un avatar de communaute.
 * Middleware memberOf + requireCommunityRole("MODERATOR") en amont.
 */
export const getUploadUrl: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const community = await prisma.community.findUnique({
      where: { id: communityId, deletedAt: null },
    });

    if (!community) {
      throw createHttpError(404, COMMUNITY_002);
    }

    const imageKey = `communities/${communityId}/avatar.webp`;
    const uploadUrl = await generatePresignedUploadUrl(imageKey);

    res.status(200).json({ uploadUrl, imageKey });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/communities/:communityId/confirm-upload
 * Confirme l'upload et valide le fichier sur MinIO.
 */
export const confirmUpload: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const community = await prisma.community.findUnique({
      where: { id: communityId, deletedAt: null },
    });

    if (!community) {
      throw createHttpError(404, COMMUNITY_002);
    }

    const imageKey = `communities/${communityId}/avatar.webp`;

    const validationError = await validateUploadedFile(imageKey);
    if (validationError) {
      await deleteObject(imageKey);
      throw createHttpError(400, `COMMUNITY_006: ${validationError}`);
    }

    await prisma.community.update({
      where: { id: communityId },
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
 * DELETE /api/communities/:communityId/image
 * Supprime l'avatar de la communaute (MinIO + DB).
 */
export const deleteImage: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const community = await prisma.community.findUnique({
      where: { id: communityId, deletedAt: null },
    });

    if (!community) {
      throw createHttpError(404, COMMUNITY_002);
    }

    if (community.imageKey) {
      await deleteObject(community.imageKey);
    }

    await prisma.community.update({
      where: { id: communityId },
      data: { imageKey: null },
    });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { importFromUrl } from "../services/recipeImportService";

interface ImportUrlBody {
  url?: string;
}

export const importRecipeFromUrl: RequestHandler<unknown, unknown, ImportUrlBody, unknown> = async (
  req,
  res,
  next
) => {
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const { url } = req.body;

    if (!url || typeof url !== "string") {
      throw createHttpError(400, "IMPORT_001: Invalid URL format");
    }

    const parsedRecipe = await importFromUrl(url);

    res.status(200).json({ data: parsedRecipe });
  } catch (error) {
    next(error);
  }
};

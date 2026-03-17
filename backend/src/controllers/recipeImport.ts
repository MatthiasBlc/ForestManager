import { RequestHandler } from "express";
import { assertIsDefine } from "../util/assertIsDefine";
import { importFromUrl } from "../services/recipeImportService";
import { ImportRecipeUrlInput } from "../schemas/recipeImport.schema";

export const importRecipeFromUrl: RequestHandler<
  unknown,
  unknown,
  ImportRecipeUrlInput,
  unknown
> = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const { url } = req.body;

    const parsedRecipe = await importFromUrl(url);

    res.status(200).json({ data: parsedRecipe });
  } catch (error) {
    next(error);
  }
};

import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";



export const getRecipes: RequestHandler = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);
    const recipes = await prisma.recipe.findMany({
      where: {
        authorId: authenticatedUserId,
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAT: true,
      },
    })
    res.status(200).json(recipes);
  } catch (error) {
    next(error);
  }
};

export const getRecipe: RequestHandler = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAT: true,
        author: true,
        authorId: true
      },
    })

    if (!recipe) {
      throw createHttpError(404, "Recipe not found");
    }

    if (!recipe.authorId === authenticatedUserId) {
      throw createHttpError(401, "You cannot access this recipe");
    }


    res.status(200).json(recipe);
  } catch (error) {
    next(error);
  }
}

interface CreateRecipeBody {
  title?: string,
  text?: string,
}

export const createRecipe: RequestHandler<unknown, unknown, CreateRecipeBody, unknown> = async (req, res, next) => {
  const title = req.body.title;
  const text = req.body.text;
  const authenticatedUserId = req.session.userId;


  try {
    assertIsDefine(authenticatedUserId);

    if (!title || !text) {
      throw createHttpError(400, "Recipe must have a title and a text");
    }
    const newRecipe = await prisma.recipe.create({
      data: {
        title: title,
        content: text,
        authorId: authenticatedUserId
      },
    });
    res.status(201).json(newRecipe);
  } catch (error) {
    next(error);
  }

};

interface UpdateRecipeParams {
  recipeId: string;
}

interface UpdateRecipeBody {
  title?: string,
  text?: string,
}

export const updateRecipe: RequestHandler<UpdateRecipeParams, unknown, UpdateRecipeBody, unknown> = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const newTitle = req.body.title;
  const newText = req.body.text;
  const authenticatedUserId = req.session.userId;


  try {
    assertIsDefine(authenticatedUserId);

    if (!newTitle || !newText) {
      throw createHttpError(400, "Recipe must have a title and a text");
    }

    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        title: newTitle,
        content: newText,
      }
    })

    if (!updatedRecipe) {
      throw createHttpError(404, "Recipe not found");
    }

    if (!updatedRecipe.authorId === authenticatedUserId) {
      throw createHttpError(401, "You cannot access this recipe");
    }

    res.status(200).json(updatedRecipe);
  } catch (error) {
    next(error);
  }

};

export const deleteRecipe: RequestHandler = async (req, res, next) => {
  const recipeId = req.params.recipeId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const recipe = await prisma.recipe.delete({
      where: { id: recipeId },
    })

    if (!recipe) {
      throw createHttpError(404, "Recipe not found");
    }

    if (!recipe.authorId === authenticatedUserId) {
      throw createHttpError(401, "You cannot access this recipe");
    }

    res.sendStatus(204);
  } catch (error) {
    next(error);

  }

};

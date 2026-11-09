// Idees de repas [D182] : un nom et un commentaire, sans lien vers une recette.
// Ajout par tout membre ; modification et suppression par l'auteur ou les
// moderateurs ; retrait (soft delete) une fois transformee en recette [F-MPL-4].
import type { ConvertMealIdeaBody, MealIdea, mealIdeaBodySchema } from "@fm/shared";
import type { z } from "zod";

import type { Db, Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";

type IdeaInput = z.output<typeof mealIdeaBodySchema>;

/** Lecteur : son id et le droit de moderer les idees des autres. */
export interface IdeaViewer {
  id: string;
  moderate: boolean;
}

const ideaSelect = {
  id: true,
  name: true,
  comment: true,
  createdAt: true,
  createdBy: { select: { id: true, username: true } },
} as const;

type IdeaRow = Prisma.MealIdeaGetPayload<{ select: typeof ideaSelect }>;

function present(row: IdeaRow, viewer: IdeaViewer): MealIdea {
  const mine = row.createdBy?.id === viewer.id;
  const allowed = mine || viewer.moderate;
  return {
    id: row.id,
    name: row.name,
    comment: row.comment,
    author: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    can: { edit: allowed, delete: allowed },
  };
}

export async function listIdeas(db: Db, spaceId: string, viewer: IdeaViewer): Promise<MealIdea[]> {
  const rows = await db.mealIdea.findMany({
    where: { spaceId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: ideaSelect,
  });
  return rows.map((row) => present(row, viewer));
}

export async function createIdea(
  db: Db,
  spaceId: string,
  viewer: IdeaViewer,
  body: IdeaInput
): Promise<MealIdea> {
  const row = await db.mealIdea.create({
    data: { spaceId, name: body.name, comment: body.comment, createdById: viewer.id },
    select: ideaSelect,
  });
  return present(row, viewer);
}

/** Idee active de l'espace, sinon MEAL_002 (inconnue, retiree ou d'un autre espace). */
async function findIdea(db: Db, spaceId: string, ideaId: string) {
  const idea = await db.mealIdea.findFirst({
    where: { id: ideaId, spaceId, deletedAt: null },
    select: { id: true, createdById: true },
  });
  if (!idea) throw new AppError("MEAL_002");
  return idea;
}

async function findOwnIdea(db: Db, spaceId: string, ideaId: string, viewer: IdeaViewer) {
  const idea = await findIdea(db, spaceId, ideaId);
  if (idea.createdById !== viewer.id && !viewer.moderate) throw new AppError("SPACE_002");
  return idea;
}

export async function updateIdea(
  db: Db,
  spaceId: string,
  ideaId: string,
  viewer: IdeaViewer,
  body: IdeaInput
): Promise<MealIdea> {
  await findOwnIdea(db, spaceId, ideaId, viewer);
  const row = await db.mealIdea.update({
    where: { id: ideaId },
    data: { name: body.name, comment: body.comment },
    select: ideaSelect,
  });
  return present(row, viewer);
}

export async function deleteIdea(
  db: Db,
  spaceId: string,
  ideaId: string,
  viewer: IdeaViewer
): Promise<void> {
  await findOwnIdea(db, spaceId, ideaId, viewer);
  await retire(db, ideaId);
}

/**
 * Transformer en recette : la recette vient d'etre enregistree par le lecteur
 * dans cet espace (il en est l'auteur, D182) ; l'idee est alors retiree.
 */
export async function convertIdea(
  db: Db,
  spaceId: string,
  ideaId: string,
  viewer: IdeaViewer,
  body: ConvertMealIdeaBody
): Promise<void> {
  await findIdea(db, spaceId, ideaId);
  const recipe = await db.recipe.findFirst({
    where: { id: body.recipeId, homeSpaceId: spaceId, authorId: viewer.id, deletedAt: null },
    select: { id: true },
  });
  if (!recipe) throw new AppError("RECIPE_001");
  await retire(db, ideaId);
}

async function retire(db: Db, ideaId: string): Promise<void> {
  // Conditionnel : deux retraits simultanes n'en comptent qu'un.
  const { count } = await db.mealIdea.updateMany({
    where: { id: ideaId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw new AppError("MEAL_002");
}

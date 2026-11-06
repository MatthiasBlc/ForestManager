// Suggestions de modification (C3.6) [D04, D18, D140, D166] : un membre qui
// n'est pas l'auteur propose un contenu complet base sur une revision. Le
// decideur (auteur, ou MOD / OWNER de l'origine si l'auteur est parti) accepte
// (revision SUGGESTION) ou refuse avec un mot ; le suggereur retire sa
// suggestion en attente ou transforme une suggestion refusee en adaptation.
// La recette a pu changer depuis : accepter applique les parties changees par la
// suggestion sur la version actuelle et signale celles changees des deux cotes.
import type {
  createSuggestionBodySchema,
  DiffField,
  Recipe,
  Suggestion,
  SuggestionSummary,
} from "@fm/shared";
import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";

import type { Context } from "../../core/context.ts";
import { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { targetActor, viewsOf } from "./adaptation.ts";
import { linksOf, resolveContent, snapshotOf } from "./content.ts";
import { contentOf, snapshotAt, snapshotSchema, type Snapshot } from "./revisions.ts";
import { decision } from "./sharing.ts";
import {
  createRecipe,
  findVisible,
  getRecipe,
  writeRevision,
  type RecipeActor,
} from "./service.ts";

// --- Fusion sur la version actuelle ---

const FIELDS: Record<
  DiffField,
  [get: (s: Snapshot) => unknown, set: (s: Snapshot, v: never) => void]
> = {
  title: [(s) => s.title, (s, v) => (s.title = v)],
  description: [(s) => s.description, (s, v) => (s.description = v)],
  notes: [(s) => s.notes, (s, v) => (s.notes = v)],
  source: [(s) => s.sourceUrl, (s, v) => (s.sourceUrl = v)],
  yield: [(s) => s.yield, (s, v) => (s.yield = v)],
  prep: [(s) => s.times.prep, (s, v) => (s.times.prep = v)],
  cook: [(s) => s.times.cook, (s, v) => (s.times.cook = v)],
  rest: [(s) => s.times.rest, (s, v) => (s.times.rest = v)],
  base: [(s) => s.isBase, (s, v) => (s.isBase = v)],
};

/**
 * Version actuelle + parties changees par la suggestion (base -> propose).
 * Conflit : partie changee aussi depuis la base, autrement. Les blocs se
 * comparent un par un s'ils sont aussi nombreux partout, sinon ensemble.
 */
export function mergeSuggestion(
  base: Snapshot,
  proposed: Snapshot,
  current: Snapshot
): { result: Snapshot; conflicts: string[] } {
  const result = structuredClone(current);
  const conflicts: string[] = [];
  const apply = (key: string, b: unknown, p: unknown, c: unknown, set: (v: never) => void) => {
    if (isDeepStrictEqual(b, p)) return;
    if (!isDeepStrictEqual(b, c) && !isDeepStrictEqual(c, p)) conflicts.push(key);
    set(structuredClone(p) as never);
  };
  for (const [field, [get, set]] of Object.entries(FIELDS)) {
    apply(field, get(base), get(proposed), get(current), (v) => {
      set(result, v);
    });
  }
  const sameShape =
    base.blocks.length === proposed.blocks.length && base.blocks.length === current.blocks.length;
  if (sameShape) {
    base.blocks.forEach((block, i) => {
      apply(`block:${String(i)}`, block, proposed.blocks[i], current.blocks[i], (v) => {
        result.blocks[i] = v;
      });
    });
  } else {
    apply("blocks", base.blocks, proposed.blocks, current.blocks, (v) => {
      result.blocks = v;
    });
  }
  return { result, conflicts };
}

// --- Lecture ---

const suggestionSelect = {
  id: true,
  recipeId: true,
  spaceId: true,
  proposerId: true,
  baseRevision: true,
  proposed: true,
  message: true,
  status: true,
  decidedAt: true,
  decisionMessage: true,
  convertedRecipeId: true,
  createdAt: true,
  recipe: { select: { id: true, title: true, authorId: true, homeSpaceId: true } },
  proposer: { select: { id: true, username: true } },
  decidedBy: { select: { id: true, username: true } },
} satisfies Prisma.RecipeSuggestionSelect;

type SuggestionRow = Prisma.RecipeSuggestionGetPayload<{ select: typeof suggestionSelect }>;

const user = (row: { id: string; username: string }) => ({
  id: row.id,
  username: row.username,
  avatarUrl: null,
});

function toSummary(row: SuggestionRow): SuggestionSummary {
  return {
    id: row.id,
    recipe: { id: row.recipe.id, title: row.recipe.title, homeSpaceId: row.recipe.homeSpaceId },
    proposer: user(row.proposer),
    message: row.message,
    status: row.status,
    baseRevision: row.baseRevision,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: row.decidedBy ? user(row.decidedBy) : null,
    decisionMessage: row.decisionMessage,
    convertedRecipeId: row.convertedRecipeId,
  };
}

/** Suggestion de cette recette, visible ici (sinon RECIPE_014, rien n'est revele). */
async function findSuggestion(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  suggestionId: string
) {
  const recipe = await findVisible(ctx, actor, recipeId);
  const row = await ctx.db.recipeSuggestion.findFirst({
    where: { id: suggestionId, recipeId },
    select: suggestionSelect,
  });
  if (!row) throw new AppError("RECIPE_014");
  const { decides } = await decision(ctx.db, recipe, actor.userId);
  const mine = row.proposerId === actor.userId;
  if (row.status !== "PENDING" && !mine && !decides) throw new AppError("RECIPE_014");
  return { recipe, row, decides, mine };
}

/** En attente, plus les suggestions de l'utilisateur (pour lire un refus), recentes d'abord. */
export async function listRecipeSuggestions(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string
): Promise<SuggestionSummary[]> {
  await findVisible(ctx, actor, recipeId);
  const rows = await ctx.db.recipeSuggestion.findMany({
    where: { recipeId, OR: [{ status: "PENDING" }, { proposerId: actor.userId }] },
    orderBy: { createdAt: "desc" },
    select: suggestionSelect,
  });
  return rows.map(toSummary);
}

/**
 * Bandeau [D166] : suggestions que l'utilisateur tranche. Espace perso : toutes
 * celles de ses recettes ; groupe : celles des recettes nees dans cet espace.
 */
export async function listSuggestionsToDecide(
  ctx: Context,
  actor: RecipeActor,
  personal: boolean
): Promise<SuggestionSummary[]> {
  const rows = await ctx.db.recipeSuggestion.findMany({
    where: {
      status: "PENDING",
      recipe: {
        deletedAt: null,
        ...(personal ? { authorId: actor.userId } : { homeSpaceId: actor.spaceId }),
      },
    },
    orderBy: { createdAt: "asc" },
    select: suggestionSelect,
  });
  const result: SuggestionSummary[] = [];
  for (const row of rows) {
    if ((await decision(ctx.db, row.recipe, actor.userId)).decides) result.push(toSummary(row));
  }
  return result;
}

export async function getSuggestion(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  suggestionId: string
): Promise<Suggestion> {
  const { recipe, row, decides, mine } = await findSuggestion(ctx, actor, recipeId, suggestionId);
  const [base, current] = await Promise.all([
    snapshotAt(ctx.db, recipeId, row.baseRevision),
    snapshotAt(ctx.db, recipeId, recipe.currentRevision),
  ]);
  const proposed = snapshotSchema.parse(row.proposed);
  const { result, conflicts } = mergeSuggestion(base, proposed, current);
  const [proposedView, currentView, resultView] = await viewsOf(ctx.db, [
    proposed,
    current,
    result,
  ]);
  if (!proposedView || !currentView || !resultView) throw new Error("missing views");
  const pending = row.status === "PENDING";
  return {
    ...toSummary(row),
    currentRevision: recipe.currentRevision,
    proposed: proposedView,
    current: currentView,
    result: resultView,
    conflicts,
    can: {
      decide: pending && decides,
      withdraw: pending && mine,
      convert: row.status === "REJECTED" && mine,
    },
  };
}

// --- Ecriture ---

export async function createSuggestion(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  body: z.output<typeof createSuggestionBodySchema>
): Promise<SuggestionSummary> {
  const recipe = await findVisible(ctx, actor, recipeId);
  if (recipe.authorId === actor.userId) throw new AppError("RECIPE_012");
  if (body.revision > recipe.currentRevision) throw new AppError("RECIPE_006");
  const { revision, message, ...input } = body;
  const keepLinks = new Set(recipe.blocks.flatMap((b) => (b.subRecipeId ? [b.subRecipeId] : [])));
  const content = await resolveContent(
    ctx.db,
    { ...input, globalTagIds: [], spaceTagIds: [] },
    actor.spaceId,
    keepLinks
  );
  try {
    const row = await ctx.db.recipeSuggestion.create({
      data: {
        recipeId,
        spaceId: actor.spaceId,
        proposerId: actor.userId,
        baseRevision: revision,
        proposed: snapshotOf(content),
        message: message || null,
      },
      select: { id: true },
    });
    // Relu a part : un create qui relit ses relations lance des requetes paralleles
    // dans sa transaction implicite (avertissement de pg).
    return toSummary(
      await ctx.db.recipeSuggestion.findUniqueOrThrow({
        where: { id: row.id },
        select: suggestionSelect,
      })
    );
  } catch (error) {
    // Index partiel : une seule suggestion en attente par personne et par recette.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("RECIPE_013");
    }
    throw error;
  }
}

/** Clot une suggestion encore en attente (sinon RECIPE_014). */
async function close(
  db: Context["db"] | Prisma.TransactionClient,
  id: string,
  from: "PENDING" | "REJECTED",
  data: Prisma.RecipeSuggestionUncheckedUpdateManyInput
): Promise<void> {
  const updated = await db.recipeSuggestion.updateMany({ where: { id, status: from }, data });
  if (updated.count === 0) throw new AppError("RECIPE_014");
}

export async function acceptSuggestion(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  suggestionId: string,
  revision: number
): Promise<Recipe> {
  const { recipe, row, decides } = await findSuggestion(ctx, actor, recipeId, suggestionId);
  if (!decides) throw new AppError("SPACE_002");
  if (row.status !== "PENDING") throw new AppError("RECIPE_014");
  const [base, current] = await Promise.all([
    snapshotAt(ctx.db, recipeId, row.baseRevision),
    snapshotAt(ctx.db, recipeId, recipe.currentRevision),
  ]);
  const proposed = snapshotSchema.parse(row.proposed);
  const { result } = mergeSuggestion(base, proposed, current);
  const content = contentOf(result, {
    globalTagIds: recipe.globalTags.map((link) => link.tag.id),
    spaceTagIds: recipe.spaceTags.map((link) => link.tag.id),
  });
  // Liens deja valables (version actuelle ou suggestion verifiee a sa creation).
  const keepLinks = new Set([...linksOf(current.blocks), ...linksOf(proposed.blocks)]);
  await writeRevision(ctx, actor, recipeId, content, revision, "SUGGESTION", keepLinks, {
    authorId: row.proposerId,
    suggestionId: row.id,
    inTransaction: (tx) =>
      close(tx, row.id, "PENDING", {
        status: "ACCEPTED",
        decidedById: actor.userId,
        decidedAt: new Date(),
      }),
  });
  return getRecipe(ctx, actor, recipeId);
}

export async function rejectSuggestion(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  suggestionId: string,
  message: string | undefined
): Promise<void> {
  const { row, decides } = await findSuggestion(ctx, actor, recipeId, suggestionId);
  if (!decides) throw new AppError("SPACE_002");
  await close(ctx.db, row.id, "PENDING", {
    status: "REJECTED",
    decidedById: actor.userId,
    decidedAt: new Date(),
    decisionMessage: message || null,
  });
}

export async function withdrawSuggestion(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  suggestionId: string
): Promise<void> {
  const { row, mine } = await findSuggestion(ctx, actor, recipeId, suggestionId);
  if (!mine) throw new AppError("SPACE_002");
  await close(ctx.db, row.id, "PENDING", { status: "WITHDRAWN", decidedAt: new Date() });
}

/** Suggestion refusee -> adaptation du suggereur, liee a la revision de depart (D140). */
export async function convertSuggestion(
  ctx: Context,
  actor: RecipeActor,
  recipeId: string,
  suggestionId: string,
  targetSpaceId: string
): Promise<Recipe> {
  const { recipe, row, mine } = await findSuggestion(ctx, actor, recipeId, suggestionId);
  if (!mine) throw new AppError("SPACE_002");
  if (row.status !== "REJECTED") throw new AppError("RECIPE_014");
  const target = await targetActor(ctx, actor.userId, targetSpaceId);
  const proposed = snapshotSchema.parse(row.proposed);
  const content = contentOf(proposed, {
    globalTagIds: recipe.globalTags.map((link) => link.tag.id),
    spaceTagIds: [],
  });
  const adaptation = await createRecipe(ctx, target, content, {
    adaptedFromId: recipe.id,
    adaptedFromRevision: row.baseRevision,
    keepLinks: new Set(linksOf(content.blocks)),
  });
  await close(ctx.db, row.id, "REJECTED", {
    status: "CONVERTED",
    convertedRecipeId: adaptation.id,
  });
  return adaptation;
}

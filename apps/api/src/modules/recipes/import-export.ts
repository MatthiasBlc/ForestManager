// Reimport d'un export de recettes dans l'espace courant [D192, D225] : la
// personne qui importe devient l'auteur, tout ou rien. Ingredients par nom
// (crees "nouveaux" s'ils manquent), unites par code, tags globaux retrouves
// par nom et tags d'espace crees au besoin [D216]. Sous-recettes du lot creees
// d'abord ; hors du lot, liees a la recette de meme titre de l'espace, sinon
// retirees et notees. Les photos suivent par le circuit photo existant.
import {
  createRecipeBodySchema,
  ingredientDisplayName,
  normalizeName,
  RECIPE_INGREDIENT_NOTE_MAX,
  RECIPE_NOTES_MAX,
  RECIPE_TAGS_MAX,
  type BlockInput,
  type ExportedRecipe,
} from "@fm/shared";

import type { Context } from "../../core/context.ts";
import type { Prisma } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";
import { assertComposition } from "./composition.ts";
import { LOCALE, linksOf, resolveContent, type RecipeContent } from "./content.ts";
import { recipeCreated, recipesAdded } from "./events.ts";
import { insertRecipe, notHiddenFrom, visibleIn, type RecipeActor } from "./service.ts";
import { findOrCreateIn } from "./tags.ts";

type Db = Context["db"] | Prisma.TransactionClient;
type Tx = Prisma.TransactionClient;

/** Un lot de 200 recettes depasse largement le delai par defaut d'une transaction. */
const TRANSACTION_TIMEOUT_MS = 120_000;

/** Recettes visibles dans l'espace, par titre normalise (la plus ancienne d'abord). */
async function titlesIn(db: Db, actor: RecipeActor): Promise<Map<string, string>> {
  const rows = await db.recipe.findMany({
    where: { ...visibleIn(actor.spaceId), AND: [notHiddenFrom(actor.userId)] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, title: true },
  });
  const byTitle = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeName(row.title);
    if (!byTitle.has(key)) byTitle.set(key, row.id);
  }
  return byTitle;
}

/** Titres de l'archive deja presents dans l'espace (sans casse ni accents). */
export async function previewImportExport(
  ctx: Context,
  actor: RecipeActor,
  titles: readonly string[]
): Promise<string[]> {
  const existing = await titlesIn(ctx.db, actor);
  return titles.filter((title) => existing.has(normalizeName(title)));
}

/** Sous-recettes du lot avant les recettes qui les utilisent ; boucle : RECIPE_023. */
function creationOrder(recipes: readonly ExportedRecipe[]): ExportedRecipe[] {
  const byRef = new Map(recipes.map((recipe) => [recipe.ref, recipe]));
  const state = new Map<string, "visiting" | "done">();
  const order: ExportedRecipe[] = [];
  const visit = (recipe: ExportedRecipe) => {
    const seen = state.get(recipe.ref);
    if (seen === "done") return;
    if (seen === "visiting") throw new AppError("RECIPE_023");
    state.set(recipe.ref, "visiting");
    for (const block of recipe.blocks) {
      const child = block.kind === "RECIPE" && block.recipe ? byRef.get(block.recipe) : undefined;
      if (child) visit(child);
    }
    state.set(recipe.ref, "done");
    order.push(recipe);
  };
  recipes.forEach(visit);
  return order;
}

/** Ingredient de chaque nom (cle normalisee) : existant (cible d'une fusion) ou nouveau [D09]. */
async function ingredientsByName(
  tx: Tx,
  recipes: readonly ExportedRecipe[],
  userId: string
): Promise<Map<string, string>> {
  const display = new Map<string, string>();
  for (const recipe of recipes) {
    for (const block of recipe.blocks) {
      if (block.kind !== "LOCAL") continue;
      for (const line of block.ingredients) {
        const name = ingredientDisplayName(line.name);
        display.set(normalizeName(name), name);
      }
    }
  }
  const found = await tx.ingredientTranslation.findMany({
    where: { locale: LOCALE, normalized: { in: [...display.keys()] } },
    select: { normalized: true, ingredient: { select: { id: true, mergedIntoId: true } } },
  });
  const ids = new Map(
    found.map((row) => [row.normalized, row.ingredient.mergedIntoId ?? row.ingredient.id])
  );
  for (const [normalized, name] of display) {
    if (ids.has(normalized)) continue;
    const row = await tx.ingredient.create({
      data: { createdById: userId, translations: { create: { locale: LOCALE, name, normalized } } },
      select: { id: true },
    });
    ids.set(normalized, row.id);
  }
  return ids;
}

/** Tags globaux actifs par nom normalise (nom traduit et nom de base). */
async function globalTagsByName(tx: Tx): Promise<Map<string, string>> {
  const rows = await tx.tag.findMany({
    where: { scope: "GLOBAL", deletedAt: null, mergedIntoId: null },
    select: { id: true, name: true, translations: { where: { locale: LOCALE } } },
  });
  const byName = new Map<string, string>();
  for (const row of rows) {
    byName.set(normalizeName(row.name), row.id);
    for (const translation of row.translations) byName.set(normalizeName(translation.name), row.id);
  }
  return byName;
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

interface Lookups {
  units: Map<string, string>;
  ingredients: Map<string, string>;
  globalTags: Map<string, string>;
  /** Recettes creees par ce lot, par reference. */
  created: Map<string, string>;
  /** Recettes deja visibles dans l'espace, par titre normalise. */
  existing: Map<string, string>;
}

/** Contenu d'une recette de l'archive, avant resolution ; `missing` : sous-recettes retirees. */
function toContent(
  recipe: ExportedRecipe,
  lookups: Lookups
): { content: Omit<RecipeContent, "spaceTagIds">; spaceTagNames: string[] } {
  const unitOf = (code: string | null) => (code ? (lookups.units.get(code) ?? null) : null);
  const missing: string[] = [];
  const blocks: BlockInput[] = [];
  for (const block of recipe.blocks) {
    if (block.kind === "RECIPE") {
      const recipeId =
        (block.recipe ? lookups.created.get(block.recipe) : undefined) ??
        lookups.existing.get(normalizeName(block.recipeTitle));
      if (recipeId) {
        blocks.push({
          kind: "RECIPE",
          recipeId,
          quantity: block.quantity,
          unitId: unitOf(block.unit),
        });
      } else {
        missing.push(block.recipeTitle);
      }
      continue;
    }
    blocks.push({
      kind: "LOCAL",
      title: block.title,
      ingredients: block.ingredients.map((line) => {
        const unitId = unitOf(line.unit);
        const unknownUnit = line.unit && !unitId ? `unité : ${line.unit}` : null;
        const note = [line.note, unknownUnit].filter(Boolean).join(", ");
        return {
          ingredientId:
            lookups.ingredients.get(normalizeName(ingredientDisplayName(line.name))) ?? "",
          quantity: line.quantity,
          unitId,
          note: note ? clip(note, RECIPE_INGREDIENT_NOTE_MAX) : null,
          optional: line.optional,
        };
      }),
      steps: block.steps.map((step) => step.trim()).filter(Boolean),
    });
  }
  // Une recette garde au moins un bloc, meme vide, si ses sous-recettes sont toutes retirees.
  if (blocks.length === 0) blocks.push({ kind: "LOCAL", title: null, ingredients: [], steps: [] });
  const missingLines = missing.map((title) => `Sous-recette non importée : ${title}`).join("\n");
  const notes = [recipe.notes, missingLines].filter(Boolean).join("\n\n");

  const globalTagIds: string[] = [];
  const spaceTagNames: string[] = [];
  for (const name of recipe.tags) {
    const globalId = lookups.globalTags.get(normalizeName(name));
    if (globalId) globalTagIds.push(globalId);
    else spaceTagNames.push(name);
  }
  return {
    content: {
      title: recipe.title,
      description: recipe.description,
      notes: notes ? clip(notes, RECIPE_NOTES_MAX) : null,
      sourceUrl: recipe.sourceUrl,
      yieldQuantity: recipe.yield.quantity,
      yieldUnitId: unitOf(recipe.yield.unit),
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      restMinutes: recipe.restMinutes,
      isBase: recipe.isBase,
      blocks,
      globalTagIds: [...new Set(globalTagIds)].slice(0, RECIPE_TAGS_MAX),
    },
    spaceTagNames: spaceTagNames.slice(0, RECIPE_TAGS_MAX),
  };
}

/** Recette de l'archive refusee par les regles d'une recette (lien source, bornes...). */
function invalidRecipe(index: number, message: string): AppError {
  return new AppError("VALIDATION_001", [
    { location: "body", path: `recipes.${String(index)}`, code: "custom", message },
  ]);
}

/** Cree les recettes du lot dans l'espace courant ; renvoie la recette de chaque reference. */
export async function importExport(
  ctx: Context,
  actor: RecipeActor,
  recipes: readonly ExportedRecipe[]
): Promise<{ ref: string; recipeId: string }[]> {
  const order = creationOrder(recipes);
  const indexOf = new Map(recipes.map((recipe, index) => [recipe.ref, index]));
  const created = await ctx.db.$transaction(
    async (tx) => {
      const lookups: Lookups = {
        units: new Map(
          (await tx.unit.findMany({ select: { id: true, code: true } })).map((u) => [u.code, u.id])
        ),
        ingredients: await ingredientsByName(tx, recipes, actor.userId),
        globalTags: await globalTagsByName(tx),
        created: new Map(),
        existing: await titlesIn(tx, actor),
      };
      const spaceTags = new Map<string, string>();
      for (const recipe of order) {
        const { content, spaceTagNames } = toContent(recipe, lookups);
        const spaceTagIds: string[] = [];
        for (const name of spaceTagNames) {
          const key = normalizeName(name);
          let tagId = spaceTags.get(key);
          if (!tagId) {
            tagId = (await findOrCreateIn(tx, actor.spaceId, name, actor.userId)).tag.id;
            spaceTags.set(key, tagId);
          }
          spaceTagIds.push(tagId);
        }
        const parsed = createRecipeBodySchema.safeParse({ ...content, spaceTagIds });
        if (!parsed.success) {
          throw invalidRecipe(indexOf.get(recipe.ref) ?? 0, parsed.error.issues[0]?.message ?? "");
        }
        const { imported: _imported, ...input } = parsed.data;
        const resolved = await resolveContent(tx, input, actor.spaceId);
        await assertComposition(tx, null, linksOf(resolved.blocks));
        const id = await insertRecipe(tx, actor, resolved, "IMPORT");
        lookups.created.set(recipe.ref, id);
      }
      return lookups.created;
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );

  const result = recipes.map((recipe) => ({
    ref: recipe.ref,
    recipeId: created.get(recipe.ref) ?? "",
  }));
  const [single] = result;
  if (recipes.length === 1 && single) {
    await recipeCreated(ctx, {
      id: single.recipeId,
      title: recipes[0]?.title ?? "",
      authorId: actor.userId,
      homeSpaceId: actor.spaceId,
    });
  } else {
    await recipesAdded(ctx, [...recipes], actor.spaceId, actor.userId);
  }
  return result;
}

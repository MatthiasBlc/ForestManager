// Module Recettes : contenu d'une recette, liste et filtres [D03, D05, D19, D24].
// C3.2 : blocs LOCAL seulement ; les blocs RECIPE (lien vivant) arrivent en C3.4.
import { z } from "zod";

import { cursorQuerySchema, isoDateTimeSchema, userSummarySchema, uuidSchema } from "./common.ts";
import { tagSchema } from "./referentials.ts";

export const RECIPE_TITLE_MAX = 120;
export const RECIPE_DESCRIPTION_MAX = 1000;
export const RECIPE_NOTES_MAX = 5000;
export const RECIPE_URL_MAX = 2000;
export const RECIPE_STEP_MAX = 2000;
export const RECIPE_INGREDIENT_NOTE_MAX = 120;
export const RECIPE_BLOCK_TITLE_MAX = 80;
export const RECIPE_BLOCKS_MAX = 20;
export const RECIPE_LINES_MAX = 100;
export const RECIPE_TAGS_MAX = 20;
export const RECIPE_MINUTES_MAX = 10_000;
export const RECIPE_YIELD_MAX = 10_000;

/** Texte optionnel : vide ou blanc = absent (null). */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));
}

const minutesSchema = z
  .number()
  .int()
  .min(0)
  .max(RECIPE_MINUTES_MAX)
  .nullish()
  .transform((v) => v ?? null);

/** Lien http(s) seulement (pas de javascript:, data:...). */
const sourceUrlSchema = z
  .string()
  .trim()
  .max(RECIPE_URL_MAX)
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https?:\/\/[^\s]+$/i.test(value), {
    message: "URL http(s) attendue",
  });

const tagIdsSchema = z
  .array(uuidSchema)
  .max(RECIPE_TAGS_MAX)
  .default([])
  .transform((ids) => [...new Set(ids)]);

export const recipeIngredientInputSchema = z.strictObject({
  ingredientId: uuidSchema,
  /** null = "a gout" ou "selon besoin". */
  quantity: z.number().positive().max(1_000_000).nullable(),
  unitId: uuidSchema.nullable(),
  note: optionalText(RECIPE_INGREDIENT_NOTE_MAX),
  optional: z.boolean().default(false),
});
export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>;

export const localBlockInputSchema = z.strictObject({
  kind: z.literal("LOCAL"),
  title: optionalText(RECIPE_BLOCK_TITLE_MAX),
  ingredients: z.array(recipeIngredientInputSchema).max(RECIPE_LINES_MAX),
  steps: z.array(z.string().trim().min(1).max(RECIPE_STEP_MAX)).max(RECIPE_LINES_MAX),
});
export type LocalBlockInput = z.infer<typeof localBlockInputSchema>;

/**
 * Lien vivant vers une autre recette [D24] : quantite utilisee dans l'unite de
 * rendement de la sous-recette [D107] (`unitId` null = portions).
 */
export const linkedBlockInputSchema = z.strictObject({
  kind: z.literal("RECIPE"),
  recipeId: uuidSchema,
  quantity: z.number().positive().max(RECIPE_YIELD_MAX),
  unitId: uuidSchema.nullable(),
});
export type LinkedBlockInput = z.infer<typeof linkedBlockInputSchema>;

export const blockInputSchema = z.discriminatedUnion("kind", [
  localBlockInputSchema,
  linkedBlockInputSchema,
]);
export type BlockInput = z.infer<typeof blockInputSchema>;

/** Contenu commun a la creation et a la modification. */
const recipeContentShape = {
  title: z.string().trim().min(1).max(RECIPE_TITLE_MAX),
  description: optionalText(RECIPE_DESCRIPTION_MAX),
  notes: optionalText(RECIPE_NOTES_MAX),
  sourceUrl: sourceUrlSchema,
  yieldQuantity: z.number().positive().max(RECIPE_YIELD_MAX),
  /** null = portions. */
  yieldUnitId: uuidSchema.nullish().transform((v) => v ?? null),
  prepMinutes: minutesSchema,
  cookMinutes: minutesSchema,
  restMinutes: minutesSchema,
  isBase: z.boolean().default(false),
  blocks: z.array(blockInputSchema).min(1).max(RECIPE_BLOCKS_MAX),
  /** Tags globaux : suivent la recette, memes droits que modifier [D19]. */
  globalTagIds: tagIdsSchema,
  /** Tags de l'espace courant [D19]. */
  spaceTagIds: tagIdsSchema,
};

export const createRecipeBodySchema = z.strictObject(recipeContentShape);
export type CreateRecipeBody = z.input<typeof createRecipeBodySchema>;

/** `revision` : revision sur laquelle l'edition est basee (refus si depassee). */
export const updateRecipeBodySchema = z.strictObject({
  ...recipeContentShape,
  revision: z.number().int().min(1),
});
export type UpdateRecipeBody = z.input<typeof updateRecipeBodySchema>;

export const recipeSpaceTagsBodySchema = z.strictObject({ tagIds: tagIdsSchema });

export const recipeParamsSchema = z.strictObject({ spaceId: uuidSchema, recipeId: uuidSchema });

// --- Sorties ---

export const recipeIngredientSchema = z.object({
  ingredientId: uuidSchema,
  name: z.string(),
  namePlural: z.string().nullable(),
  quantity: z.number().nullable(),
  unitId: uuidSchema.nullable(),
  note: z.string().nullable(),
  optional: z.boolean(),
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const localBlockSchema = z.object({
  kind: z.literal("LOCAL"),
  title: z.string().nullable(),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(z.string()),
});
export type LocalBlock = z.infer<typeof localBlockSchema>;

/** AVAILABLE : visible ici ; HIDDEN : pas visible dans cet espace ; DELETED : supprimee. */
export const LINK_STATUSES = ["AVAILABLE", "HIDDEN", "DELETED"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/** Sous-recette telle qu'affichee dans le plat (version actuelle, lien vivant). */
export interface LinkedRecipe {
  id: string;
  title: string;
  yieldQuantity: number;
  yieldUnitId: string | null;
  isBase: boolean;
  blocks: RecipeBlock[];
}

export interface LinkedBlock {
  kind: "RECIPE";
  recipeId: string;
  /** Quantite utilisee, dans l'unite `unitId` (rendement de la sous-recette). */
  quantity: number;
  unitId: string | null;
  status: LinkStatus;
  /** null sauf si AVAILABLE. */
  recipe: LinkedRecipe | null;
}

export type RecipeBlock = LocalBlock | LinkedBlock;

const linkedRecipeSchema: z.ZodType<LinkedRecipe> = z.object({
  id: uuidSchema,
  title: z.string(),
  yieldQuantity: z.number(),
  yieldUnitId: uuidSchema.nullable(),
  isBase: z.boolean(),
  get blocks() {
    return z.array(recipeBlockSchema);
  },
});

export const linkedBlockSchema: z.ZodType<LinkedBlock> = z.object({
  kind: z.literal("RECIPE"),
  recipeId: uuidSchema,
  quantity: z.number(),
  unitId: uuidSchema.nullable(),
  status: z.enum(LINK_STATUSES),
  recipe: linkedRecipeSchema.nullable(),
});

export const recipeBlockSchema: z.ZodType<RecipeBlock> = z.union([
  localBlockSchema,
  linkedBlockSchema,
]);

const recipeBaseShape = {
  id: uuidSchema,
  homeSpaceId: uuidSchema,
  title: z.string(),
  imageUrl: z.string().nullable(),
  yieldQuantity: z.number(),
  yieldUnitId: uuidSchema.nullable(),
  /** Somme des temps renseignes ; null si aucun. */
  totalMinutes: z.number().int().nullable(),
  isBase: z.boolean(),
  author: userSummarySchema,
  tags: z.array(tagSchema),
  updatedAt: isoDateTimeSchema,
};

export const recipeSummarySchema = z.object({
  ...recipeBaseShape,
  /** Au moins un bloc lie a une autre recette (C3.4). */
  isComposed: z.boolean(),
});
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;

export const recipeSchema = z.object({
  ...recipeBaseShape,
  description: z.string().nullable(),
  notes: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  restMinutes: z.number().int().nullable(),
  currentRevision: z.number().int(),
  createdAt: isoDateTimeSchema,
  blocks: z.array(recipeBlockSchema),
  /** Recettes non supprimees qui lient celle-ci (prevenir avant suppression). */
  usedBy: z.number().int(),
  /** Droits de l'utilisateur courant sur cette recette, dans cet espace. */
  can: z.object({ edit: z.boolean(), delete: z.boolean() }),
});
export type Recipe = z.infer<typeof recipeSchema>;

// --- Revisions [D05, D30, D55] ---

export const REVISION_SOURCES = ["CREATE", "EDIT", "SUGGESTION", "RESTORE", "IMPORT"] as const;
export type RevisionSource = (typeof REVISION_SOURCES)[number];

/** Parties de la recette qui different de la revision precedente. */
export const REVISION_CHANGES = [
  "title",
  "description",
  "notes",
  "source",
  "yield",
  "times",
  "base",
  "blocks",
  "ingredients",
  "steps",
] as const;
export type RevisionChange = (typeof REVISION_CHANGES)[number];

export const recipeRevisionSchema = z.object({
  number: z.number().int(),
  source: z.enum(REVISION_SOURCES),
  author: userSummarySchema,
  createdAt: isoDateTimeSchema,
  /** Vide pour la premiere revision. */
  changes: z.array(z.enum(REVISION_CHANGES)),
});
export type RecipeRevision = z.infer<typeof recipeRevisionSchema>;

export const revisionParamsSchema = recipeParamsSchema.extend({
  number: z.coerce.number().int().min(1),
});

/** `revision` : revision courante vue par le client (verrou optimiste, D163). */
export const restoreRevisionBodySchema = z.strictObject({
  revision: z.number().int().min(1),
});
export type RestoreRevisionBody = z.infer<typeof restoreRevisionBodySchema>;

// --- Liste ---

export const RECIPE_SORTS = ["recent", "title", "time"] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

/** Liste d'UUID separes par des virgules dans la query string. */
const uuidListSchema = z
  .string()
  .max(40 * RECIPE_TAGS_MAX)
  .transform((value) => value.split(",").filter(Boolean))
  .pipe(z.array(uuidSchema).max(RECIPE_TAGS_MAX));

export const recipeListQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(RECIPE_TITLE_MAX).optional(),
  tagIds: uuidListSchema.optional(),
  ingredientIds: uuidListSchema.optional(),
  maxMinutes: z.coerce.number().int().min(1).max(RECIPE_MINUTES_MAX).optional(),
  authorId: uuidSchema.optional(),
  base: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(RECIPE_SORTS).default("recent"),
});
export type RecipeListQuery = z.infer<typeof recipeListQuerySchema>;

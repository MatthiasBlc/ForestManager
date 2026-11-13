// Export de donnees (F-EXPORT, P12) [D37, D192] : demande, statut, et format
// de l'archive. Le JSON est versionne et relu par ce schema (reimport en V2.1).

import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./common.ts";

export const EXPORT_SCOPES = ["MY_RECIPES", "SPACE"] as const;
export const exportScopeSchema = z.enum(EXPORT_SCOPES);
export type ExportScope = z.infer<typeof exportScopeSchema>;

export const EXPORT_FORMATS = ["JSON", "MARKDOWN"] as const;
export const exportFormatSchema = z.enum(EXPORT_FORMATS);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportStatusSchema = z.enum(["PENDING", "READY", "FAILED", "EXPIRED"]);
export type ExportStatus = z.infer<typeof exportStatusSchema>;

/** Duree de vie d'une archive prete, et delai entre deux exports d'un meme espace. */
export const EXPORT_TTL_HOURS = 24;
export const SPACE_EXPORT_INTERVAL_HOURS = 24;

export const createExportBodySchema = z
  .strictObject({
    scope: exportScopeSchema,
    spaceId: uuidSchema.optional(),
    format: exportFormatSchema,
    photos: z.boolean().default(false),
  })
  .refine((body) => (body.scope === "SPACE") === (body.spaceId !== undefined), {
    message: "spaceId is required for SPACE and only for SPACE",
    path: ["spaceId"],
  });
export type CreateExportBody = z.input<typeof createExportBodySchema>;

export const dataExportSchema = z.object({
  id: uuidSchema,
  scope: exportScopeSchema,
  space: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  format: exportFormatSchema,
  photos: z.boolean(),
  status: exportStatusSchema,
  createdAt: isoDateTimeSchema,
  /** Fin de disponibilite de l'archive (READY). */
  expiresAt: isoDateTimeSchema.nullable(),
});
export type DataExport = z.infer<typeof dataExportSchema>;

/** Details de EXPORT_001 : prochain export d'espace possible. */
export const exportLimitDetailsSchema = z.object({ nextAt: isoDateTimeSchema });

// --- Contenu de l'archive (recettes.json) ---

export const RECIPES_EXPORT_FORMAT = "forest-manager/recipes";
export const RECIPES_EXPORT_VERSION = 1;

const minutes = z.number().int().min(0).nullable();

export const exportedIngredientSchema = z.object({
  name: z.string().min(1),
  /** null = "a gout". */
  quantity: z.number().positive().nullable(),
  /** Code de l'unite ("g", "tbsp"...), null sans unite. */
  unit: z.string().nullable(),
  note: z.string().nullable(),
  optional: z.boolean(),
});

export const exportedBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LOCAL"),
    title: z.string().nullable(),
    ingredients: z.array(exportedIngredientSchema),
    steps: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("RECIPE"),
    title: z.string().nullable(),
    /** Reference d'une autre recette de l'archive, null si elle n'y est pas. */
    recipe: z.string().nullable(),
    recipeTitle: z.string(),
    quantity: z.number().positive(),
    unit: z.string().nullable(),
  }),
]);
export type ExportedBlock = z.infer<typeof exportedBlockSchema>;

export const exportedRecipeSchema = z.object({
  /** Identifiant dans l'archive (nom des fichiers Markdown et des photos). */
  ref: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().nullable(),
  author: z.string(),
  space: z.string(),
  isBase: z.boolean(),
  yield: z.object({ quantity: z.number().positive(), unit: z.string().nullable() }),
  prepMinutes: minutes,
  cookMinutes: minutes,
  restMinutes: minutes,
  tags: z.array(z.string()),
  blocks: z.array(exportedBlockSchema),
  notes: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  /** Chemin de la photo dans l'archive (`photos/...`). */
  photo: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type ExportedRecipe = z.infer<typeof exportedRecipeSchema>;

export const recipesExportSchema = z.object({
  format: z.literal(RECIPES_EXPORT_FORMAT),
  version: z.literal(RECIPES_EXPORT_VERSION),
  exportedAt: isoDateTimeSchema,
  recipes: z.array(exportedRecipeSchema),
});
export type RecipesExport = z.infer<typeof recipesExportSchema>;

// Referentiels (unites, ingredients, tags) [D08, D09, D34, D160].
import { z } from "zod";

import { UNIT_DIMENSIONS } from "../units/index.ts";
import { uuidSchema } from "./common.ts";

export const INGREDIENT_NAME_MAX = 80;
export const TAG_NAME_MAX = 40;

export const unitSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  dimension: z.enum(UNIT_DIMENSIONS),
  toBase: z.number().nullable(),
  metric: z.boolean(),
  name: z.string(),
  namePlural: z.string().nullable(),
  abbreviation: z.string(),
});
export type Unit = z.infer<typeof unitSchema>;

export const ingredientQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(INGREDIENT_NAME_MAX),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const createIngredientBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(INGREDIENT_NAME_MAX),
});

export const ingredientSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  namePlural: z.string().nullable(),
  defaultUnitId: uuidSchema.nullable(),
  /** Synonyme saisi qui a mene a cet ingredient (fusion D120), sinon null. */
  matchedName: z.string().nullable(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const tagSchema = z.object({
  id: uuidSchema,
  scope: z.enum(["GLOBAL", "SPACE"]),
  name: z.string(),
});
export type Tag = z.infer<typeof tagSchema>;

export const tagNameBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(TAG_NAME_MAX),
});
export const mergeTagBodySchema = z.strictObject({ intoTagId: uuidSchema });
export const spaceTagParamsSchema = z.strictObject({ spaceId: uuidSchema, tagId: uuidSchema });

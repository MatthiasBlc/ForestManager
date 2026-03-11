import { z } from "zod";
import { MAX_TITLE_LENGTH, MAX_TAGS_PER_RECIPE } from "../util/validation";
import {
  VALIDATION_001,
  RECIPE_003,
  RECIPE_006,
  RECIPE_007,
  RECIPE_008,
  RECIPE_009,
  TAG_003,
} from "../constants/errorCodes";

// --- Building blocks ---

const stepSchema = z.object({
  instruction: z.string({ error: RECIPE_007 }).trim().min(1, RECIPE_007).max(5000, RECIPE_007),
});

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z
    .number({ error: VALIDATION_001("ingredient quantity must be a number") })
    .positive(VALIDATION_001("ingredient quantity must be positive"))
    .max(99999, VALIDATION_001("ingredient quantity must be <= 99999"))
    .nullable()
    .optional(),
  unitId: z.string().optional(),
});

const timeSchema = z
  .number({ error: RECIPE_008 })
  .int(RECIPE_008)
  .min(0, RECIPE_008)
  .max(10000, RECIPE_008)
  .nullable();

// Title: type error → VALIDATION_001, missing/empty/too long → RECIPE_003
const titleSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined ? RECIPE_003 : VALIDATION_001("title must be a string"),
  })
  .trim()
  .min(1, RECIPE_003)
  .max(MAX_TITLE_LENGTH, VALIDATION_001(`title must be at most ${MAX_TITLE_LENGTH} characters`));

// --- Create recipe (personal + community) ---

export const createRecipeSchema = z.object({
  title: titleSchema,
  servings: z.number({ error: RECIPE_006 }).int(RECIPE_006).min(1, RECIPE_006).max(100, RECIPE_006),
  prepTime: timeSchema.optional(),
  cookTime: timeSchema.optional(),
  restTime: timeSchema.optional(),
  steps: z.array(stepSchema, { error: RECIPE_007 }).min(1, RECIPE_007),
  tags: z
    .array(z.string(), { error: VALIDATION_001("tags must be an array") })
    .max(MAX_TAGS_PER_RECIPE, TAG_003)
    .optional()
    .default([]),
  ingredients: z.array(ingredientSchema).optional().default([]),
});

// --- Update recipe (all optional) ---

export const updateRecipeSchema = z.object({
  title: titleSchema.optional(),
  servings: z
    .number({ error: RECIPE_006 })
    .int(RECIPE_006)
    .min(1, RECIPE_006)
    .max(100, RECIPE_006)
    .optional(),
  prepTime: timeSchema.optional(),
  cookTime: timeSchema.optional(),
  restTime: timeSchema.optional(),
  steps: z.array(stepSchema, { error: RECIPE_007 }).min(1, RECIPE_007).optional(),
  tags: z
    .array(z.string(), { error: VALIDATION_001("tags must be an array") })
    .max(MAX_TAGS_PER_RECIPE, RECIPE_009(MAX_TAGS_PER_RECIPE))
    .optional(),
  ingredients: z.array(ingredientSchema).optional(),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

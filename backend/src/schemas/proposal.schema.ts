import { z } from "zod";
import { MAX_TITLE_LENGTH } from "../util/validation";
import {
  RECIPE_003,
  RECIPE_006,
  RECIPE_007,
  RECIPE_008,
  INGREDIENT_003,
} from "../constants/errorCodes";

const stepSchema = z.object({
  instruction: z.string({ error: RECIPE_007 }).trim().min(1, RECIPE_007).max(5000, RECIPE_007),
});

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number().positive().max(99999).nullable().optional(),
  unitId: z.string().optional(),
});

const timeSchema = z
  .number({ error: RECIPE_008 })
  .int(RECIPE_008)
  .min(0, RECIPE_008)
  .max(10000, RECIPE_008)
  .nullable();

export const createProposalSchema = z.object({
  proposedTitle: z
    .string({ error: RECIPE_003 })
    .trim()
    .min(1, RECIPE_003)
    .max(MAX_TITLE_LENGTH, RECIPE_003),
  proposedServings: z
    .number({ error: RECIPE_006 })
    .int(RECIPE_006)
    .min(1, RECIPE_006)
    .max(100, RECIPE_006)
    .nullable()
    .optional(),
  proposedPrepTime: timeSchema.optional(),
  proposedCookTime: timeSchema.optional(),
  proposedRestTime: timeSchema.optional(),
  proposedSteps: z.array(stepSchema, { error: RECIPE_007 }).min(1, RECIPE_007),
  proposedIngredients: z.array(ingredientSchema).max(50, INGREDIENT_003).optional(),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;

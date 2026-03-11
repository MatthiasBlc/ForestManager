import { z } from "zod";
import { RECIPE_006, RECIPE_008 } from "../../constants/errorCodes";
import { MAX_TITLE_LENGTH } from "../../util/validation";

/** Schema for admin updating a recipe */
export const adminUpdateRecipeSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(MAX_TITLE_LENGTH)
    .transform((val) => val.trim())
    .optional(),
  servings: z
    .number({ message: RECIPE_006 })
    .int(RECIPE_006)
    .min(1, RECIPE_006)
    .max(100, RECIPE_006)
    .optional(),
  prepTime: z
    .number({ message: RECIPE_008 })
    .int(RECIPE_008)
    .min(0, RECIPE_008)
    .max(10000, RECIPE_008)
    .optional(),
  cookTime: z
    .number({ message: RECIPE_008 })
    .int(RECIPE_008)
    .min(0, RECIPE_008)
    .max(10000, RECIPE_008)
    .optional(),
  restTime: z
    .number({ message: RECIPE_008 })
    .int(RECIPE_008)
    .min(0, RECIPE_008)
    .max(10000, RECIPE_008)
    .optional(),
});

export type AdminUpdateRecipeInput = z.infer<typeof adminUpdateRecipeSchema>;

import { z } from "zod";
import {
  ADMIN_ING_001,
  ADMIN_ING_004,
  ADMIN_ING_009,
} from "../../constants/errorCodes";
import { MAX_NAME_LENGTH, MAX_REASON_LENGTH } from "../../util/validation";

const uuidSchema = z.string().uuid();

const ingredientNameSchema = z
  .string({ message: ADMIN_ING_001 })
  .min(1, ADMIN_ING_001)
  .max(MAX_NAME_LENGTH, ADMIN_ING_001)
  .transform((val) => val.trim().toLowerCase());

/** Schema for creating an ingredient */
export const adminCreateIngredientSchema = z.object({
  name: ingredientNameSchema,
  defaultUnitId: uuidSchema.optional(),
});

/** Schema for updating an ingredient */
export const adminUpdateIngredientSchema = z.object({
  name: ingredientNameSchema.optional(),
  defaultUnitId: uuidSchema.nullable().optional(),
});

/** Schema for approving an ingredient (optionally rename) */
export const adminApproveIngredientSchema = z.object({
  newName: z
    .string()
    .min(1)
    .max(MAX_NAME_LENGTH)
    .transform((val) => val.trim().toLowerCase())
    .optional(),
});

/** Schema for rejecting an ingredient */
export const adminRejectIngredientSchema = z.object({
  reason: z
    .string({ message: ADMIN_ING_009 })
    .min(1, ADMIN_ING_009)
    .max(MAX_REASON_LENGTH, ADMIN_ING_009)
    .transform((val) => val.trim()),
});

/** Schema for merging an ingredient into another */
export const adminMergeIngredientSchema = z.object({
  targetId: uuidSchema.refine((val) => val.length > 0, { message: ADMIN_ING_004 }),
});

export type AdminCreateIngredientInput = z.infer<typeof adminCreateIngredientSchema>;
export type AdminUpdateIngredientInput = z.infer<typeof adminUpdateIngredientSchema>;
export type AdminApproveIngredientInput = z.infer<typeof adminApproveIngredientSchema>;
export type AdminRejectIngredientInput = z.infer<typeof adminRejectIngredientSchema>;
export type AdminMergeIngredientInput = z.infer<typeof adminMergeIngredientSchema>;

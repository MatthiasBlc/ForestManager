import { z } from "zod";
import { ADMIN_TAG_001, ADMIN_TAG_001_LENGTH, ADMIN_TAG_004 } from "../../constants/errorCodes";
import { uuidSchema } from "../../schemas/common.schema";

/** Validation du nom de tag: 2-50 caracteres, normalise lowercase */
const adminTagNameSchema = z
  .string({ error: () => ADMIN_TAG_001 })
  .min(1, ADMIN_TAG_001)
  .max(50, ADMIN_TAG_001_LENGTH)
  .transform((val) => val.trim().toLowerCase())
  .refine((val) => val.length >= 2, { message: ADMIN_TAG_001_LENGTH });

/** Schema for creating an admin tag */
export const adminCreateTagSchema = z.object({
  name: adminTagNameSchema,
});

/** Schema for updating an admin tag */
export const adminUpdateTagSchema = z.object({
  name: adminTagNameSchema,
});

/** Schema for merging tags */
export const adminMergeTagSchema = z.object({
  targetId: uuidSchema.refine((val) => val.trim().length > 0, { message: ADMIN_TAG_004 }),
});

export type AdminCreateTagInput = z.infer<typeof adminCreateTagSchema>;
export type AdminUpdateTagInput = z.infer<typeof adminUpdateTagSchema>;
export type AdminMergeTagInput = z.infer<typeof adminMergeTagSchema>;

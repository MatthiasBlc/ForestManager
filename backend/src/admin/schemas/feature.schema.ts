import { z } from "zod";
import { ADMIN_FEAT_001, ADMIN_FEAT_002 } from "../../constants/errorCodes";

/** Schema for creating a feature */
export const adminCreateFeatureSchema = z.object({
  code: z
    .string({ error: () => ADMIN_FEAT_001 })
    .min(1, ADMIN_FEAT_001)
    .transform((val) => val.trim().toUpperCase().replace(/\s+/g, "_")),
  name: z
    .string({ error: () => ADMIN_FEAT_002 })
    .min(1, ADMIN_FEAT_002)
    .transform((val) => val.trim()),
  description: z
    .string()
    .transform((val) => val?.trim() || null)
    .optional(),
  isDefault: z.boolean().optional().default(false),
});

/** Schema for updating a feature */
export const adminUpdateFeatureSchema = z.object({
  name: z
    .string({ error: () => ADMIN_FEAT_002 })
    .min(1, ADMIN_FEAT_002)
    .transform((val) => val.trim())
    .optional(),
  description: z
    .string()
    .transform((val) => val?.trim() || null)
    .optional(),
  isDefault: z.boolean().optional(),
});

export type AdminCreateFeatureInput = z.infer<typeof adminCreateFeatureSchema>;
export type AdminUpdateFeatureInput = z.infer<typeof adminUpdateFeatureSchema>;

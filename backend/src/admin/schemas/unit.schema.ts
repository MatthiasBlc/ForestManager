import { z } from "zod";
import {
  ADMIN_UNIT_001,
  ADMIN_UNIT_002,
  ADMIN_UNIT_003,
  VALIDATION_001,
} from "../../constants/errorCodes";

const VALID_CATEGORIES = ["WEIGHT", "VOLUME", "SPOON", "COUNT", "QUALITATIVE"] as const;

const unitNameSchema = z
  .string({ message: ADMIN_UNIT_001 })
  .min(1, ADMIN_UNIT_001)
  .max(50, ADMIN_UNIT_001)
  .transform((val) => val.trim().toLowerCase());

const abbreviationSchema = z
  .string({ message: ADMIN_UNIT_002 })
  .min(1, ADMIN_UNIT_002)
  .max(10, ADMIN_UNIT_002)
  .transform((val) => val.trim().toLowerCase());

const categorySchema = z.enum(VALID_CATEGORIES, { message: ADMIN_UNIT_003 });

const sortOrderSchema = z
  .number({ message: VALIDATION_001("sortOrder must be a number") })
  .int(VALIDATION_001("sortOrder must be an integer"))
  .min(0, VALIDATION_001("sortOrder must be >= 0"))
  .max(9999, VALIDATION_001("sortOrder must be <= 9999"))
  .optional()
  .default(0);

/** Schema for creating a unit */
export const adminCreateUnitSchema = z.object({
  name: unitNameSchema,
  abbreviation: abbreviationSchema,
  category: categorySchema,
  sortOrder: sortOrderSchema,
});

/** Schema for updating a unit */
export const adminUpdateUnitSchema = z.object({
  name: unitNameSchema.optional(),
  abbreviation: abbreviationSchema.optional(),
  category: categorySchema.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export type AdminCreateUnitInput = z.infer<typeof adminCreateUnitSchema>;
export type AdminUpdateUnitInput = z.infer<typeof adminUpdateUnitSchema>;

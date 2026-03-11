import { z } from "zod";

/** Schema UUID v4 */
export const uuidSchema = z.uuid("VALIDATION_001: Invalid UUID format");

/** Schema pagination (query params) */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

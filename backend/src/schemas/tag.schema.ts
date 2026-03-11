import { z } from "zod";
import { TAG_001 } from "../constants/errorCodes";

const VALIDATION_001_TYPE = "VALIDATION_001: must be a string";

/** Validation du nom de tag: 2-50 caracteres, normalise lowercase */
const tagNameSchema = z
  .string({ error: () => VALIDATION_001_TYPE })
  .min(1, TAG_001("Tag name is required"))
  .max(50, TAG_001("Tag name must be between 2 and 50 characters"))
  .transform((val) => val.trim().toLowerCase())
  .refine((val) => val.length >= 2, { message: TAG_001("Tag name must be between 2 and 50 characters") });

/** Schema for creating a tag suggestion on a recipe */
export const createTagSuggestionSchema = z.object({
  tagName: tagNameSchema,
});

/** Schema for creating/updating a community tag */
export const communityTagSchema = z.object({
  name: tagNameSchema,
});

/** Schema for updating tag visibility preference */
export const updateTagPreferenceSchema = z.object({
  showTags: z.boolean({ error: () => TAG_001("showTags must be a boolean") }),
});

export type CreateTagSuggestionInput = z.infer<typeof createTagSuggestionSchema>;
export type CommunityTagInput = z.infer<typeof communityTagSchema>;
export type UpdateTagPreferenceInput = z.infer<typeof updateTagPreferenceSchema>;

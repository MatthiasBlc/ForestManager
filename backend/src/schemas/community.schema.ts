import { z } from "zod";
import { COMMUNITY_VALIDATION } from "../util/validation";
import { VALIDATION_001_TYPE } from "../constants/errorCodes";

const nameSchema = z
  .string({ error: () => VALIDATION_001_TYPE })
  .min(
    COMMUNITY_VALIDATION.NAME_MIN,
    `VALIDATION_001: Name must be at least ${COMMUNITY_VALIDATION.NAME_MIN} characters`
  )
  .max(
    COMMUNITY_VALIDATION.NAME_MAX,
    `VALIDATION_001: Name must be at most ${COMMUNITY_VALIDATION.NAME_MAX} characters`
  );

const descriptionSchema = z
  .string({ error: () => VALIDATION_001_TYPE })
  .max(
    COMMUNITY_VALIDATION.DESCRIPTION_MAX,
    `VALIDATION_001: Description must be at most ${COMMUNITY_VALIDATION.DESCRIPTION_MAX} characters`
  )
  .optional();

/** Schema for creating a community */
export const createCommunitySchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

/** Schema for updating a community */
export const updateCommunitySchema = z
  .object({
    name: nameSchema.optional(),
    description: z
      .string({ error: () => VALIDATION_001_TYPE })
      .max(
        COMMUNITY_VALIDATION.DESCRIPTION_MAX,
        `VALIDATION_001: Description must be at most ${COMMUNITY_VALIDATION.DESCRIPTION_MAX} characters`
      )
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "VALIDATION_001: No fields to update",
  });

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;

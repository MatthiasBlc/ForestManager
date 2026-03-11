import { z } from "zod";
import {
  EMAIL_REGEX,
  USERNAME_REGEX,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "../util/validation";
import {
  AUTH_003,
  AUTH_004_LENGTH,
  AUTH_004_FORMAT,
  AUTH_005,
  AUTH_010,
} from "../constants/errorCodes";

const VALIDATION_001_TYPE = "VALIDATION_001: must be a string";

/** Schema for updating user profile */
export const updateProfileSchema = z
  .object({
    username: z
      .string({ error: () => VALIDATION_001_TYPE })
      .min(MIN_USERNAME_LENGTH, AUTH_004_LENGTH(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH))
      .max(MAX_USERNAME_LENGTH, AUTH_004_LENGTH(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH))
      .regex(USERNAME_REGEX, AUTH_004_FORMAT)
      .optional(),
    email: z
      .string({ error: () => VALIDATION_001_TYPE })
      .regex(EMAIL_REGEX, AUTH_003)
      .optional(),
    currentPassword: z.string({ error: () => VALIDATION_001_TYPE }).optional(),
    newPassword: z
      .string({ error: () => VALIDATION_001_TYPE })
      .min(MIN_PASSWORD_LENGTH, AUTH_005(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH))
      .max(MAX_PASSWORD_LENGTH, AUTH_005(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH))
      .optional(),
  })
  .superRefine((data, ctx) => {
    // If newPassword is provided, currentPassword is required
    if (data.newPassword && !data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: AUTH_010,
        path: ["currentPassword"],
      });
    }
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

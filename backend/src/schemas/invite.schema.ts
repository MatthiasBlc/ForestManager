import { z } from "zod";
import { EMAIL_REGEX } from "../util/validation";
import { AUTH_003, INVITE_004, INVITE_005 } from "../constants/errorCodes";
import { uuidSchema } from "./common.schema";

const VALIDATION_001_TYPE = "VALIDATION_001: must be a string";

/** Schema for creating an invite (exactly one of email, username, userId required) */
export const createInviteSchema = z
  .object({
    email: z.string({ error: () => VALIDATION_001_TYPE }).regex(EMAIL_REGEX, AUTH_003).optional(),
    username: z.string({ error: () => VALIDATION_001_TYPE }).optional(),
    userId: uuidSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const providedFields = [data.email, data.username, data.userId].filter(Boolean);

    if (providedFields.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: INVITE_004,
      });
    } else if (providedFields.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: INVITE_005,
      });
    }
  });

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

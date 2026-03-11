import { z } from "zod";
import { NOTIF_003, NOTIF_004, NOTIF_005 } from "../constants/errorCodes";
import { uuidSchema } from "./common.schema";

const VALID_CATEGORIES = ["INVITATION", "RECIPE_PROPOSAL", "TAG", "INGREDIENT", "MODERATION"];

/** Schema for batch marking notifications as read */
export const markBatchAsReadSchema = z.object({
  ids: z
    .array(z.string())
    .min(1, NOTIF_004)
    .max(100, NOTIF_004),
});

/** Schema for marking all notifications as read */
export const markAllAsReadSchema = z.object({
  category: z
    .string()
    .refine((val) => VALID_CATEGORIES.includes(val), { message: NOTIF_003 })
    .optional(),
});

/** Schema for updating notification preferences */
export const updateNotificationPreferenceSchema = z.object({
  category: z.string().refine((val) => VALID_CATEGORIES.includes(val), { message: NOTIF_003 }),
  enabled: z.boolean({ error: () => NOTIF_005 }),
  communityId: uuidSchema.nullable().optional(),
});

export type MarkBatchAsReadInput = z.infer<typeof markBatchAsReadSchema>;
export type MarkAllAsReadInput = z.infer<typeof markAllAsReadSchema>;
export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;

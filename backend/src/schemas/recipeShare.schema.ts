import { z } from "zod";
import { SHARE_001, PUBLISH_001 } from "../constants/errorCodes";
import { uuidSchema } from "./common.schema";

/** Schema for sharing a recipe to another community */
export const shareRecipeSchema = z.object({
  targetCommunityId: uuidSchema.refine((val) => val.trim().length > 0, { message: SHARE_001 }),
});

/** Schema for publishing a personal recipe to communities */
export const publishToCommunitySchema = z.object({
  communityIds: z.array(uuidSchema).min(1, PUBLISH_001),
});

export type ShareRecipeInput = z.infer<typeof shareRecipeSchema>;
export type PublishToCommunityInput = z.infer<typeof publishToCommunitySchema>;

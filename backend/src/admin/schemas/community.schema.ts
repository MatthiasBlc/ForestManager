import { z } from "zod";
import { COMMUNITY_VALIDATION } from "../../util/validation";
import { ADMIN_COM_002 } from "../../constants/errorCodes";

/** Schema for updating a community via admin */
export const adminUpdateCommunitySchema = z.object({
  name: z
    .string({ error: () => ADMIN_COM_002 })
    .min(COMMUNITY_VALIDATION.NAME_MIN, ADMIN_COM_002)
    .max(COMMUNITY_VALIDATION.NAME_MAX, ADMIN_COM_002)
    .transform((val) => val.trim()),
});

export type AdminUpdateCommunityInput = z.infer<typeof adminUpdateCommunitySchema>;

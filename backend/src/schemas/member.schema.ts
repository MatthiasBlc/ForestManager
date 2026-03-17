import { z } from "zod";
import { MEMBER_001, MEMBER_002 } from "../constants/errorCodes";

/** Schema for promoting a member to MODERATOR */
export const promoteMemberSchema = z.object({
  role: z
    .string({ error: () => MEMBER_001 })
    .refine((val) => val === "MODERATOR", { message: MEMBER_002 }),
});

export type PromoteMemberInput = z.infer<typeof promoteMemberSchema>;

import { z } from "zod";
import { ADMIN_003, ADMIN_005, VALIDATION_001_TYPE } from "../../constants/errorCodes";

/** Schema for admin login (email + password) */
export const adminLoginSchema = z.object({
  email: z.string({ error: () => ADMIN_003 }).min(1, ADMIN_003),
  password: z.string({ error: () => ADMIN_003 }).min(1, ADMIN_003),
});

/** Schema for TOTP verification */
export const verifyTotpSchema = z.object({
  code: z.string({ error: () => VALIDATION_001_TYPE }).min(1, ADMIN_005),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;

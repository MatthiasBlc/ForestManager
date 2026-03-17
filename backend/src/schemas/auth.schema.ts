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
  AUTH_002,
  AUTH_003,
  AUTH_004_LENGTH,
  AUTH_004_FORMAT,
  AUTH_005,
  VALIDATION_001_TYPE,
} from "../constants/errorCodes";

export const signupSchema = z.object({
  username: z
    .string({
      error: (issue) => (issue.input === undefined ? AUTH_002 : VALIDATION_001_TYPE),
    })
    .min(MIN_USERNAME_LENGTH, AUTH_004_LENGTH(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH))
    .max(MAX_USERNAME_LENGTH, AUTH_004_LENGTH(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH))
    .regex(USERNAME_REGEX, AUTH_004_FORMAT),
  email: z
    .string({
      error: (issue) => (issue.input === undefined ? AUTH_002 : VALIDATION_001_TYPE),
    })
    .regex(EMAIL_REGEX, AUTH_003),
  password: z
    .string({
      error: (issue) => (issue.input === undefined ? AUTH_002 : VALIDATION_001_TYPE),
    })
    .min(MIN_PASSWORD_LENGTH, AUTH_005(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH))
    .max(MAX_PASSWORD_LENGTH, AUTH_005(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)),
});

export const loginSchema = z.object({
  username: z.string({
    error: (issue) => (issue.input === undefined ? AUTH_002 : VALIDATION_001_TYPE),
  }),
  password: z.string({
    error: (issue) => (issue.input === undefined ? AUTH_002 : VALIDATION_001_TYPE),
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Comptes : inscription, connexion, emails optionnels [D21], profil, preferences.
// Entrees en `strictObject` (champ inconnu refuse) ; sorties en `object`.

import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./common.ts";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 10;
/** Borne haute : evite qu'un hash argon2 sur un texte enorme serve d'attaque. */
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 254;

/** Lettres, chiffres et tiret bas ; compare sans casse cote API. */
export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN)
  .max(USERNAME_MAX)
  .regex(/^[a-zA-Z0-9_]+$/);

/** Stocke en minuscules. */
export const emailSchema = z.string().trim().toLowerCase().max(EMAIL_MAX).pipe(z.email());

export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

/** Mot de passe saisi pour s'authentifier : aucune regle de politique, seulement les bornes. */
const currentPasswordSchema = z.string().min(1).max(PASSWORD_MAX);

/** Jeton recu par email (base64url, 32 octets). */
export const emailTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const registerBodySchema = z.strictObject({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.strictObject({
  /** Email ou username. */
  identifier: z.string().trim().min(1).max(EMAIL_MAX),
  password: currentPasswordSchema,
  /** "Rester connecte" : 30 jours au lieu d'un jour glissant [D13]. */
  rememberMe: z.boolean().default(false),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const forgotPasswordBodySchema = z.strictObject({ email: emailSchema });
export const resetPasswordBodySchema = z.strictObject({
  token: emailTokenSchema,
  password: passwordSchema,
});
export const verifyEmailBodySchema = z.strictObject({ token: emailTokenSchema });

// --- Preferences d'affichage [D32] ---

export const AMBIANCES = ["BRAISE", "SOUSBOIS", "POTAGER"] as const;
export const COLOR_MODES = ["SYSTEM", "LIGHT", "DARK"] as const;
export const DENSITIES = ["COMFORTABLE", "COMPACT"] as const;
export const TEXT_SCALES = [90, 100, 115, 130] as const;
/** Langues disponibles : francais seul en V2.0 [D34]. */
export const LOCALES = ["fr"] as const;

export const preferencesSchema = z.object({
  ambiance: z.enum(AMBIANCES),
  colorMode: z.enum(COLOR_MODES),
  density: z.enum(DENSITIES),
  textScale: z.union(TEXT_SCALES.map((scale) => z.literal(scale))),
  locale: z.enum(LOCALES),
});
export type Preferences = z.infer<typeof preferencesSchema>;

// --- Profil (F-ACC-4) ---

export const updateProfileBodySchema = z
  .strictObject({
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    /** Exige pour changer l'email. */
    currentPassword: currentPasswordSchema.optional(),
  })
  .refine((body) => body.username !== undefined || body.email !== undefined, {
    message: "username or email is required",
  })
  .refine((body) => body.email === undefined || body.currentPassword !== undefined, {
    message: "currentPassword is required to change the email",
    path: ["currentPassword"],
  });
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

/** Changer de mot de passe ferme les autres sessions. */
export const changePasswordBodySchema = z.strictObject({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;

export const updatePreferencesBodySchema = preferencesSchema
  .strict()
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "empty update" });
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>;

/** Suppression du compte : confirmee par le mot de passe [D116]. */
export const deleteAccountBodySchema = z.strictObject({ password: currentPasswordSchema });

// --- Sorties ---

export const meSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  username: z.string(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  personalSpaceId: uuidSchema,
  preferences: preferencesSchema,
  createdAt: isoDateTimeSchema,
});
export type Me = z.infer<typeof meSchema>;

export const appConfigSchema = z.object({
  /** Emails [D21] et envoi de photos [D167] : facultatifs selon la configuration. */
  features: z.object({ email: z.boolean(), uploads: z.boolean() }),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

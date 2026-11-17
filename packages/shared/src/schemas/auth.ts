// Comptes : inscription, connexion, emails optionnels [D21], profil, preferences.
// Entrees en `strictObject` (champ inconnu refuse) ; sorties en `object`.

import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./common.ts";
import { homeWidgetsSchema } from "./home.ts";

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
  /** Absent seulement pour un compte sans mot de passe (cree par Discord) [D210]. */
  currentPassword: currentPasswordSchema.optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;

export const updatePreferencesBodySchema = preferencesSchema
  .extend({
    /** Widgets de l'accueil, dans l'ordre ; null = defaut du registre [D193]. */
    homeWidgets: homeWidgetsSchema,
  })
  .strict()
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "empty update" });
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>;

/** Suppression du compte : confirmee par le mot de passe [D116]. */
/** Mot de passe ; un compte sans mot de passe tape son nom d'utilisateur [D210]. */
export const deleteAccountBodySchema = z
  .strictObject({
    password: currentPasswordSchema.optional(),
    username: z.string().trim().min(1).max(USERNAME_MAX).optional(),
  })
  .refine((body) => body.password !== undefined || body.username !== undefined, {
    message: "password or username is required",
  });
export type DeleteAccountBody = z.infer<typeof deleteAccountBodySchema>;

// --- Discord [D202, D210] ---

/** Confirmation de l'inscription par Discord (E-INSCRIPTION-DISCORD). */
export const discordRegisterBodySchema = z.strictObject({
  username: usernameSchema,
  email: emailSchema,
});
export type DiscordRegisterBody = z.infer<typeof discordRegisterBodySchema>;

/** Inscription par Discord en attente de confirmation. */
export const discordPendingSchema = z.object({
  /** Nom propose, ramene aux regles et libre. */
  username: z.string(),
  /** Email Discord verifie, ou null : a saisir. */
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  discordUsername: z.string(),
});
export type DiscordPending = z.infer<typeof discordPendingSchema>;

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
  /** Connecte avec un mot de passe temporaire : il doit en choisir un avant tout [D134]. */
  mustChoosePassword: z.boolean(),
  /** Faux pour un compte cree par Discord tant qu'il n'a pas defini de mot de passe [D210]. */
  hasPassword: z.boolean(),
  /** Compte Discord relie, ou null. */
  discord: z.object({ username: z.string() }).nullable(),
});
export type Me = z.infer<typeof meSchema>;

export const choosePasswordBodySchema = z.strictObject({ password: passwordSchema });

export const appConfigSchema = z.object({
  /** Emails [D21] et envoi de photos [D167] : facultatifs selon la configuration. */
  features: z.object({
    email: z.boolean(),
    uploads: z.boolean(),
    errorTracking: z.boolean(),
    /** Connexion avec Discord configuree [D202]. */
    discord: z.boolean(),
  }),
  /** Version et environnement, repris par le SDK du navigateur [D196]. */
  release: z.string(),
  environment: z.string(),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

// Admin, utilisateurs (C4.4) : comptes seulement, jamais le contenu ; pas de
// connexion a la place d'un utilisateur. Mot de passe temporaire [D134].

import { z } from "zod";

import { offsetQuerySchema } from "./admin.ts";
import { PASSWORD_MAX } from "./auth.ts";
import { isoDateTimeSchema, uuidSchema } from "./common.ts";

export const ADMIN_USER_FILTERS = ["ALL", "OWNERS", "INACTIVE"] as const;
export type AdminUserFilter = (typeof ADMIN_USER_FILTERS)[number];

/** Sans connexion depuis ce nombre de mois : compte inactif. */
export const INACTIVE_MONTHS = 6;

export const adminUsersQuerySchema = offsetQuerySchema.extend({
  filter: z.enum(ADMIN_USER_FILTERS).default("ALL"),
  query: z.string().trim().max(PASSWORD_MAX).optional(),
});

export const adminUserSchema = z.object({
  id: uuidSchema,
  username: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  /** Espaces groupe dont il est membre actif (OWNER : il en est proprietaire). */
  spaces: z.array(z.object({ name: z.string(), owner: z.boolean() })),
  createdAt: isoDateTimeSchema,
  lastLoginAt: isoDateTimeSchema.nullable(),
  /** Un mot de passe temporaire attend d'etre utilise. */
  temporaryPasswordPending: z.boolean(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** Mot de passe temporaire : affiche une seule fois a l'admin [D134]. */
export const temporaryPasswordSchema = z.object({
  password: z.string(),
  expiresAt: isoDateTimeSchema,
});
export type TemporaryPassword = z.infer<typeof temporaryPasswordSchema>;

// Administration de la plateforme : connexion 2FA, session, journal d'audit.
// Routes sous /api/v1/admin, session isolee de celle des utilisateurs [D170, D174].

import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./common.ts";
import { EMAIL_MAX, PASSWORD_MAX } from "./auth.ts";

/** Duree d'une session admin, non glissante (CDC S3.3). */
export const ADMIN_SESSION_MINUTES = 30;

export const adminLoginBodySchema = z.strictObject({
  /** Email ou username. */
  identifier: z.string().trim().min(1).max(EMAIL_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});
export type AdminLoginBody = z.infer<typeof adminLoginBodySchema>;

/** Code a 6 chiffres ; les espaces saisis ("123 456") sont retires. */
export const adminTotpBodySchema = z.strictObject({
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/)),
});
export type AdminTotpBody = z.infer<typeof adminTotpBodySchema>;

/**
 * Resultat de l'etape mot de passe : configuration de la 2FA a la premiere
 * connexion (QR code et cle a saisir a la main), sinon code demande.
 */
export const adminLoginResultSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("SETUP"),
    secret: z.string(),
    otpauthUri: z.string(),
    qrCode: z.string(),
  }),
  z.object({ step: z.literal("CODE") }),
]);
export type AdminLoginResult = z.infer<typeof adminLoginResultSchema>;

export const adminMeSchema = z.object({
  id: uuidSchema,
  username: z.string(),
  email: z.string(),
  /** Fin de la session, fixe depuis la connexion. */
  sessionExpiresAt: isoDateTimeSchema,
});
export type AdminMe = z.infer<typeof adminMeSchema>;

// --- Journal d'audit [D128] ---

export const AUDIT_CATEGORIES = [
  "MODERATION",
  "MODULES",
  "REFERENTIALS",
  "ACCOUNTS",
  "CONNECTIONS",
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/** Prefixe d'une action ("ingredient" dans "ingredient.merged") vers sa categorie. */
const AUDIT_PREFIXES: Readonly<Record<string, AuditCategory>> = {
  auth: "CONNECTIONS",
  module: "MODULES",
  "module-request": "MODULES",
  ingredient: "REFERENTIALS",
  unit: "REFERENTIALS",
  aisle: "REFERENTIALS",
  tag: "REFERENTIALS",
  user: "ACCOUNTS",
  space: "MODERATION",
  recipe: "MODERATION",
  moderation: "MODERATION",
};

/** Prefixes d'une categorie (filtre du journal). */
export function auditPrefixes(category: AuditCategory): string[] {
  return Object.entries(AUDIT_PREFIXES)
    .filter(([, value]) => value === category)
    .map(([prefix]) => prefix);
}

export function auditCategory(action: string): AuditCategory {
  const prefix = action.split(".")[0] ?? "";
  const category = AUDIT_PREFIXES[prefix];
  if (!category) throw new Error(`unknown audit action: ${action}`);
  return category;
}

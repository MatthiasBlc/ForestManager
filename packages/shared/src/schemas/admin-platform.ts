// Admin, journal d'audit (A11), reglages (A13) et tableau de bord (A02) : C4.6
// [D128, D129, D135]. Aucun secret n'est renvoye par ces routes.

import { z } from "zod";

import { AUDIT_CATEGORIES, offsetQuerySchema } from "./admin.ts";
import { isoDateTimeSchema, uuidSchema } from "./common.ts";

export const auditQuerySchema = offsetQuerySchema.extend({
  category: z.enum(AUDIT_CATEGORIES).optional(),
});

export const auditEntrySchema = z.object({
  id: uuidSchema,
  createdAt: isoDateTimeSchema,
  /** Username de l'admin. */
  admin: z.string(),
  action: z.string(),
  category: z.enum(AUDIT_CATEGORIES),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

/** Reglages en lecture seule [D135] : etat et valeurs non secretes. */
export const platformSettingsSchema = z.object({
  email: z.object({
    configured: z.boolean(),
    /** "smtp://mail.example.org:587" : sans identifiant ni mot de passe. */
    server: z.string().nullable(),
    from: z.string(),
  }),
  storage: z.object({
    configured: z.boolean(),
    endpoint: z.string().nullable(),
    bucket: z.string().nullable(),
    publicUrl: z.string().nullable(),
  }),
  /** Suivi des erreurs (SDK Sentry vers Bugsink, D75) : pas encore branche. */
  errorTracking: z.object({ configured: z.boolean() }),
});
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const SERVICE_TESTS = ["email", "storage"] as const;
export type ServiceTest = (typeof SERVICE_TESTS)[number];
export const serviceTestParamsSchema = z.strictObject({ service: z.enum(SERVICE_TESTS) });

export const serviceTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});
export type ServiceTestResult = z.infer<typeof serviceTestResultSchema>;

/** Tableau de bord [D129]. Les demandes de modules viennent de leur propre route. */
export const adminDashboardSchema = z.object({
  newIngredients: z.object({
    count: z.number().int(),
    /** Nouveaux qui ressemblent a un ingredient verifie (quelques noms). */
    duplicates: z.array(z.string()),
  }),
  deletingSpaces: z.array(
    z.object({ id: uuidSchema, name: z.string(), purgeAfter: isoDateTimeSchema })
  ),
  platform: z.object({
    users: z.number().int(),
    groupSpaces: z.number().int(),
    personalSpaces: z.number().int(),
    recipes: z.number().int(),
    /** Espaces ayant acces a chaque module qui se demande. */
    modules: z.array(z.object({ code: z.string(), grantedCount: z.number().int() })),
  }),
  services: z.object({ email: z.boolean(), storage: z.boolean(), errorTracking: z.boolean() }),
  version: z.string(),
  recent: z.array(auditEntrySchema),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

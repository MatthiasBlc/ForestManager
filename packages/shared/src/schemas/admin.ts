// Administration de la plateforme : connexion 2FA, session, journal d'audit.
// Routes sous /api/v1/admin, session isolee de celle des utilisateurs [D170, D174].

import { z } from "zod";

import { moduleStatusSchema } from "../modules/index.ts";
import { EMAIL_MAX, PASSWORD_MAX } from "./auth.ts";
import { isoDateTimeSchema, uuidSchema } from "./common.ts";
import { accessRequestStatusSchema } from "./modules.ts";

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
  "RELEASES",
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
  release: "RELEASES",
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

// --- Modules : demandes d'acces et catalogue (C4.2) [D33, D85] ---

/** Espace tel que l'admin le voit dans une liste : nom et teinte, jamais le contenu. */
export const adminSpaceRefSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  tintIndex: z.number().int(),
});
export type AdminSpaceRef = z.infer<typeof adminSpaceRefSchema>;

export const adminModuleRequestSchema = z.object({
  id: uuidSchema,
  moduleCode: z.string(),
  status: accessRequestStatusSchema,
  message: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  decidedAt: isoDateTimeSchema.nullable(),
  space: adminSpaceRefSchema,
  requestedBy: z.object({ username: z.string() }),
});
export type AdminModuleRequest = z.infer<typeof adminModuleRequestSchema>;

export const adminModuleRequestsSchema = z.object({
  pending: z.array(adminModuleRequestSchema),
  /** Demandes traitees recemment (les plus recentes d'abord). */
  recent: z.array(adminModuleRequestSchema),
});

export const MODULE_DECISION_NOTE_MAX = 500;
/** Refus : motif obligatoire, montre a l'OWNER [D124]. */
export const rejectModuleRequestBodySchema = z.strictObject({
  note: z.string().trim().min(1).max(MODULE_DECISION_NOTE_MAX),
});

export const adminModuleSchema = z.object({
  code: z.string(),
  status: moduleStatusSchema,
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  /** Espaces ayant acces (non retire). */
  grantedCount: z.number().int(),
  /** Parmi eux, ceux ou l'OWNER l'a active. */
  enabledCount: z.number().int(),
  pendingCount: z.number().int(),
});
export type AdminModule = z.infer<typeof adminModuleSchema>;

export const setModuleStatusBodySchema = z.strictObject({ status: moduleStatusSchema });

export const adminModuleGrantSchema = z.object({
  space: adminSpaceRefSchema,
  grantedAt: isoDateTimeSchema,
  /** Accorde par un admin (sur demande ou d'office) ; null = module par defaut. */
  byAdmin: z.boolean(),
  enabled: z.boolean(),
});
export type AdminModuleGrant = z.infer<typeof adminModuleGrantSchema>;

export const grantModuleBodySchema = z.strictObject({ spaceId: uuidSchema });

/** Pagination par offset, reservee a l'admin (14-Architecture). */
export const offsetQuerySchema = z.strictObject({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function offsetPageSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), total: z.number().int() });
}

export const spaceLookupQuerySchema = z.strictObject({
  query: z.string().trim().min(1).max(60),
});
export const spaceLookupItemSchema = adminSpaceRefSchema.extend({ ownerUsername: z.string() });
export type SpaceLookupItem = z.infer<typeof spaceLookupItemSchema>;

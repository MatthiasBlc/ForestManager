// Admin, espaces et moderation (C4.5) [D52, D121, D122, D178]. Les espaces sont
// prives : l'admin voit leurs informations generales ; le contenu ne s'ouvre que
// par un acces de moderation motive, en lecture seule pendant 30 minutes.

import { z } from "zod";

import { offsetQuerySchema } from "./admin.ts";
import { isoDateTimeSchema, uuidSchema } from "./common.ts";

export const ADMIN_SPACE_FILTERS = ["GROUP", "PERSONAL", "DELETING"] as const;
export type AdminSpaceFilter = (typeof ADMIN_SPACE_FILTERS)[number];

export const adminSpacesQuerySchema = offsetQuerySchema.extend({
  filter: z.enum(ADMIN_SPACE_FILTERS).default("GROUP"),
  query: z.string().trim().max(60).optional(),
});

export const adminSpaceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  tintIndex: z.number().int(),
  kind: z.enum(["PERSONAL", "GROUP"]),
  owner: z.string().nullable(),
  memberCount: z.number().int(),
  /** Recettes visibles dans l'espace (origine ou partage). */
  recipeCount: z.number().int(),
  /** Modules actifs (codes). */
  modules: z.array(z.string()),
  deletedAt: isoDateTimeSchema.nullable(),
  purgeAfter: isoDateTimeSchema.nullable(),
});
export type AdminSpace = z.infer<typeof adminSpaceSchema>;

export const adminSpaceListSchema = z.object({
  data: z.array(adminSpaceSchema),
  total: z.number().int(),
  counts: z.object({
    GROUP: z.number().int(),
    PERSONAL: z.number().int(),
    DELETING: z.number().int(),
  }),
});

/** Duree d'un acces de moderation (D122). */
export const MODERATION_MINUTES = 30;
export const MODERATION_NOTE_MAX = 500;

export const MODERATION_REASONS = [
  "MEMBER_REPORT",
  "OWNER_REQUEST",
  "EXTERNAL_REPORT",
  "OTHER",
] as const;
export type ModerationReason = (typeof MODERATION_REASONS)[number];

const noteSchema = z.string().trim().min(1).max(MODERATION_NOTE_MAX);

export const openModerationBodySchema = z.strictObject({
  reason: z.enum(MODERATION_REASONS),
  note: noteSchema,
});

/** Action de moderation (masquer, retirer, supprimer) : motif obligatoire, audite. */
export const moderationActionBodySchema = z.strictObject({ note: noteSchema });

export const moderationAccessSchema = z.object({
  id: uuidSchema,
  spaceId: uuidSchema,
  reason: z.enum(MODERATION_REASONS),
  note: z.string(),
  openedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
});
export type ModerationAccess = z.infer<typeof moderationAccessSchema>;

export const moderationRecipeItemSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  author: z.string(),
  /** Espace d'origine de la recette ; sinon elle y est partagee. */
  atHome: z.boolean(),
  hiddenReason: z.string().nullable(),
});
export type ModerationRecipeItem = z.infer<typeof moderationRecipeItemSchema>;

export const moderationSpaceSchema = z.object({
  access: moderationAccessSchema,
  space: adminSpaceSchema,
  recipes: z.array(moderationRecipeItemSchema),
});
export type ModerationSpace = z.infer<typeof moderationSpaceSchema>;

export const moderationRecipeParamsSchema = z.strictObject({
  spaceId: uuidSchema,
  recipeId: uuidSchema,
});
export const spaceIdParamsSchema = z.strictObject({ spaceId: uuidSchema });

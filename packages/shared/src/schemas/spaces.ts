// Espaces, membres, transfert de propriete, invitations (lien et username).

import { z } from "zod";

import { usernameSchema } from "./auth.ts";
import {
  isoDateTimeSchema,
  spaceKindSchema,
  spaceRoleSchema,
  userSummarySchema,
  uuidSchema,
} from "./common.ts";

export const SPACE_NAME_MIN = 3;
export const SPACE_NAME_MAX = 100;
export const SPACE_DESCRIPTION_MAX = 1000;
export const TINT_MIN = 1;
export const TINT_MAX = 5;
/** Plafond anti-abus d'espaces possedes par utilisateur [D51]. */
export const MAX_OWNED_SPACES = 20;
/** Delai de restauration d'un espace supprime [D22]. */
export const SPACE_RESTORE_DAYS = 30;

const spaceNameSchema = z.string().trim().min(SPACE_NAME_MIN).max(SPACE_NAME_MAX);
const descriptionSchema = z.string().trim().max(SPACE_DESCRIPTION_MAX);
const tintSchema = z.number().int().min(TINT_MIN).max(TINT_MAX);

export const spaceParamsSchema = z.strictObject({ spaceId: uuidSchema });
export const memberParamsSchema = z.strictObject({ spaceId: uuidSchema, userId: uuidSchema });

export const createSpaceBodySchema = z.strictObject({
  name: spaceNameSchema,
  description: descriptionSchema.optional(),
  tintIndex: tintSchema.default(TINT_MIN),
});
export type CreateSpaceBody = z.infer<typeof createSpaceBodySchema>;

/** Espace perso : seule la teinte change (regle du service). `description: null` l'efface. */
export const updateSpaceBodySchema = z
  .strictObject({
    name: spaceNameSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    tintIndex: tintSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "empty update" });
export type UpdateSpaceBody = z.infer<typeof updateSpaceBodySchema>;

/** Quitter : le dernier membre confirme la suppression de l'espace [D22]. */
export const leaveSpaceBodySchema = z.strictObject({
  confirmDeletion: z.boolean().default(false),
});

export const activeModuleSchema = z.object({ code: z.string(), sortOrder: z.number().int() });

export const spaceSummarySchema = z.object({
  id: uuidSchema,
  kind: spaceKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  tintIndex: z.number().int(),
  avatarUrl: z.string().nullable(),
  myRole: spaceRoleSchema,
  memberCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  purgeAfter: isoDateTimeSchema.nullable(),
});
export type SpaceSummary = z.infer<typeof spaceSummarySchema>;

/** Detail : modules accordes et actifs, dans l'ordre choisi par l'OWNER [D131]. */
export const spaceDetailSchema = spaceSummarySchema.extend({
  modules: z.array(activeModuleSchema),
});
export type SpaceDetail = z.infer<typeof spaceDetailSchema>;

// --- Membres ---

export const memberSchema = z.object({
  user: userSummarySchema,
  role: spaceRoleSchema,
  joinedAt: isoDateTimeSchema,
});
export type Member = z.infer<typeof memberSchema>;

/** Promouvoir ou retrograder : jamais vers OWNER (passe par le transfert). */
export const changeRoleBodySchema = z.strictObject({
  role: z.enum(["MEMBER", "MODERATOR"]),
});

// --- Transfert de propriete [D92] ---

export const ownershipTransferStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
]);

export const createTransferBodySchema = z.strictObject({ toUserId: uuidSchema });
export const transferParamsSchema = z.strictObject({ spaceId: uuidSchema, transferId: uuidSchema });

export const ownershipTransferSchema = z.object({
  id: uuidSchema,
  spaceId: uuidSchema,
  fromUser: userSummarySchema,
  toUser: userSummarySchema,
  status: ownershipTransferStatusSchema,
  createdAt: isoDateTimeSchema,
  respondedAt: isoDateTimeSchema.nullable(),
});
export type OwnershipTransfer = z.infer<typeof ownershipTransferSchema>;

// --- Liens d'invitation [D07, D94] ---

export const INVITE_LINK_DURATIONS = [1, 7, 30] as const;
export const INVITE_LINK_MAX_USES = 100;

/** Code du lien : 128 bits en base64url (22 caracteres), seul son hash est stocke. */
export const inviteCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const inviteCodeParamsSchema = z.strictObject({ code: inviteCodeSchema });
export const inviteLinkParamsSchema = z.strictObject({ spaceId: uuidSchema, linkId: uuidSchema });

export const createInviteLinkBodySchema = z.strictObject({
  expiresInDays: z.union(INVITE_LINK_DURATIONS.map((days) => z.literal(days))),
  /** null = nombre de personnes illimite. */
  maxUses: z.number().int().min(1).max(INVITE_LINK_MAX_USES).nullable(),
});
export type CreateInviteLinkBody = z.infer<typeof createInviteLinkBodySchema>;

export const inviteLinkSchema = z.object({
  id: uuidSchema,
  createdBy: userSummarySchema,
  expiresAt: isoDateTimeSchema,
  maxUses: z.number().int().nullable(),
  useCount: z.number().int(),
  revokedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type InviteLink = z.infer<typeof inviteLinkSchema>;

/** Reponse de creation : le code n'est montre qu'une fois. */
export const createdInviteLinkSchema = inviteLinkSchema.extend({ code: inviteCodeSchema });
export type CreatedInviteLink = z.infer<typeof createdInviteLinkSchema>;

/** Apercu public d'un lien, avant de rejoindre (aucune donnee privee). */
export const inviteLinkPreviewSchema = z.object({
  space: z.object({
    name: z.string(),
    tintIndex: z.number().int(),
    avatarUrl: z.string().nullable(),
    memberCount: z.number().int(),
  }),
  expiresAt: isoDateTimeSchema,
});
export type InviteLinkPreview = z.infer<typeof inviteLinkPreviewSchema>;

// --- Invitations par username [D07, D50] ---

export const invitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"]);

export const createInvitationBodySchema = z.strictObject({ username: usernameSchema });
export const invitationParamsSchema = z.strictObject({ invitationId: uuidSchema });
export const spaceInvitationParamsSchema = z.strictObject({
  spaceId: uuidSchema,
  invitationId: uuidSchema,
});

export const invitationSchema = z.object({
  id: uuidSchema,
  space: z.object({
    id: uuidSchema,
    name: z.string(),
    tintIndex: z.number().int(),
    avatarUrl: z.string().nullable(),
  }),
  inviter: userSummarySchema,
  invitee: userSummarySchema,
  status: invitationStatusSchema,
  createdAt: isoDateTimeSchema,
  respondedAt: isoDateTimeSchema.nullable(),
});
export type Invitation = z.infer<typeof invitationSchema>;

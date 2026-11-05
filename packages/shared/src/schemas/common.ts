// Briques communes des schemas : identifiants, enums du modele, pagination.
// Les enums reprennent exactement ceux du schema Prisma.

import { z } from "zod";

export const uuidSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime();

export const SPACE_KINDS = ["PERSONAL", "GROUP"] as const;
export const spaceKindSchema = z.enum(SPACE_KINDS);
export type SpaceKind = z.infer<typeof spaceKindSchema>;

/** Roles du plus faible au plus fort : l'ordre sert aux comparaisons. */
export const SPACE_ROLES = ["MEMBER", "MODERATOR", "OWNER"] as const;
export const spaceRoleSchema = z.enum(SPACE_ROLES);
export type SpaceRole = z.infer<typeof spaceRoleSchema>;

export function roleRank(role: SpaceRole): number {
  return SPACE_ROLES.indexOf(role);
}

/** Vrai si `role` vaut au moins `minRole`. */
export function hasMinRole(role: SpaceRole, minRole: SpaceRole): boolean {
  return roleRank(role) >= roleRank(minRole);
}

/** Parametres de route `:id` (et variantes) : UUID v4 obligatoire. */
export const idParamsSchema = z.strictObject({ id: uuidSchema });

/** Pagination par curseur [D72] : `?limit=30&cursor=<opaque>`. */
export const cursorQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().min(1).max(200).optional(),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), nextCursor: z.string().nullable() });
}

/** Utilisateur tel que vu par les autres membres (D50 : pas plus). */
export const userSummarySchema = z.object({
  id: uuidSchema,
  username: z.string(),
  avatarUrl: z.string().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

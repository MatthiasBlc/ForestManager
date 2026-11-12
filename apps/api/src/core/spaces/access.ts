// Acces a un espace : appartenance active puis permission de la matrice.
// Un non-membre recoit SPACE_001 comme si l'espace n'existait pas (pas
// d'enumeration) ; un membre sans le droit recoit SPACE_002 ; une action
// impossible dans un espace perso recoit SPACE_003.

import {
  CORE_PERMISSIONS,
  can,
  isAllowed,
  type CorePermissionKey,
  type SpaceRole,
} from "@fm/shared";

import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";

type Tx = Context["db"] | Prisma.TransactionClient;

export interface SpaceAccess {
  space: {
    id: string;
    kind: "PERSONAL" | "GROUP";
    deletedAt: Date | null;
    purgeAfter: Date | null;
  };
  role: SpaceRole;
}

/** Membre actif d'un espace ; `includeDeleted` pour restaurer un espace supprime. */
export async function loadAccess(
  db: Tx,
  spaceId: string,
  userId: string,
  options: { includeDeleted?: boolean } = {}
): Promise<SpaceAccess> {
  const membership = await db.membership.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
    select: {
      role: true,
      leftAt: true,
      space: { select: { id: true, kind: true, deletedAt: true, purgeAfter: true } },
    },
  });
  if (!membership || membership.leftAt) throw new AppError("SPACE_001");
  if (membership.space.deletedAt && options.includeDeleted !== true)
    throw new AppError("SPACE_001");
  return { space: membership.space, role: membership.role };
}

export function authorize(access: SpaceAccess, key: CorePermissionKey): void {
  const context = { authenticated: true, space: { kind: access.space.kind, role: access.role } };
  if (can(context, key)) return;
  const definition = CORE_PERMISSIONS[key];
  // Autorise dans un groupe pour ce role, interdit seulement parce que l'espace est perso.
  if (
    access.space.kind === "PERSONAL" &&
    isAllowed(definition, { authenticated: true, space: { kind: "GROUP", role: access.role } })
  ) {
    throw new AppError("SPACE_003");
  }
  throw new AppError("SPACE_002");
}

export async function requireSpacePermission(
  db: Tx,
  spaceId: string,
  userId: string,
  key: CorePermissionKey,
  options: { includeDeleted?: boolean } = {}
): Promise<SpaceAccess> {
  const access = await loadAccess(db, spaceId, userId, options);
  authorize(access, key);
  return access;
}

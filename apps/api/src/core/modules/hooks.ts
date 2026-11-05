// Crochets du cycle de vie appeles par le socle et fournis par les modules
// (remplis par le registre, C1.8). Le socle ne connait aucun module [D40].
import type { Prisma } from "../db/client.ts";

export type MemberLeftReason = "LEFT" | "EXCLUDED" | "ACCOUNT_DELETED";

export interface LifecycleHooks {
  /** Avant la purge definitive d'un espace (ex. Recettes rapatrie les recettes partagees [D83]). */
  onSpaceDeleted: ((tx: Prisma.TransactionClient, spaceId: string) => Promise<void>)[];
  /** Apres un depart (ex. reprise des recettes d'un ancien membre [D18, D84]). */
  onMemberLeft: ((
    tx: Prisma.TransactionClient,
    event: { spaceId: string; userId: string; reason: MemberLeftReason }
  ) => Promise<void>)[];
}

export function emptyHooks(): LifecycleHooks {
  return { onSpaceDeleted: [], onMemberLeft: [] };
}

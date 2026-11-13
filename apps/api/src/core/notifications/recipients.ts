// Destinataires usuels des notifications d'un espace.
import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";

type Tx = Context["db"] | Prisma.TransactionClient;

/** Membres actifs (comptes non supprimes), eventuellement limites a certains roles. */
export async function activeMembers(
  db: Tx,
  spaceId: string,
  roles?: readonly ("OWNER" | "MODERATOR" | "MEMBER")[]
): Promise<string[]> {
  const rows = await db.membership.findMany({
    where: {
      spaceId,
      leftAt: null,
      user: { deletedAt: null },
      ...(roles ? { role: { in: [...roles] } } : {}),
    },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

/** OWNER et moderateurs : ceux qui gerent les membres. */
export function managersOf(db: Tx, spaceId: string): Promise<string[]> {
  return activeMembers(db, spaceId, ["OWNER", "MODERATOR"]);
}

export async function ownerOf(db: Tx, spaceId: string): Promise<string[]> {
  return activeMembers(db, spaceId, ["OWNER"]);
}

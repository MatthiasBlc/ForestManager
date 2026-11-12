// Journal d'audit admin [D128] : chaque action d'un admin y laisse une entree,
// dans la meme transaction que l'action. Le journal ne se modifie ni ne se
// supprime (trigger en base).

import { auditCategory } from "@fm/shared";

import type { Db, Prisma } from "../db/client.ts";

type Writer = Pick<Db, "adminAuditLog">;

export interface AuditEntry {
  adminId: string;
  /** Cle "<prefixe>.<verbe>" ; le prefixe donne la categorie du filtre. */
  action: string;
  targetType?: string;
  targetId?: string;
  data?: Prisma.InputJsonValue;
}

export async function audit(db: Writer, entry: AuditEntry): Promise<void> {
  auditCategory(entry.action); // refuse une action sans categorie
  await db.adminAuditLog.create({ data: entry });
}

// Espaces ou l'utilisateur est membre actif, avec leurs modules actifs
// (recherche globale, widgets d'accueil) [D191, D193].
import type { Context } from "../context.ts";

export interface ActiveSpace {
  id: string;
  name: string;
  kind: "PERSONAL" | "GROUP";
  modules: Set<string>;
}

/** Espaces ou l'utilisateur est membre actif, avec leurs modules actifs. */
export async function activeSpaces(ctx: Context, userId: string): Promise<ActiveSpace[]> {
  const rows = await ctx.db.space.findMany({
    where: { deletedAt: null, memberships: { some: { userId, leftAt: null } } },
    select: {
      id: true,
      name: true,
      kind: true,
      modules: {
        where: {
          enabled: true,
          revokedAt: null,
          module: { status: { in: ["AVAILABLE", "BETA"] } },
        },
        select: { moduleCode: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    modules: new Set(row.modules.map((m) => m.moduleCode)),
  }));
}

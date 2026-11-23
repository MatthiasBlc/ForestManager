// Reglages de la liste d'un espace [D141] et premiere ouverture : la ligne de
// reglages est creee avec les sections de depart, depuis les rayons [D125, D231].
import type { SpaceRole } from "@fm/shared";

import type { Db } from "../../core/db/client.ts";

const LOCALE = "fr"; // francais seul en V2 [D34]

export async function readEditRole(db: Db, spaceId: string): Promise<SpaceRole> {
  const row = await db.shoppingSettings.findUnique({ where: { spaceId } });
  return row?.editRole ?? "MEMBER";
}

/**
 * Premiere ouverture du module dans l'espace : cree les reglages et une section par
 * rayon, dans l'ordre du parcours. Sans effet ensuite (sections supprimees comprises).
 * Deux appels simultanes : le second attend le premier et ne cree rien.
 */
export async function ensureInitialized(db: Db, spaceId: string): Promise<void> {
  if (await db.shoppingSettings.findUnique({ where: { spaceId }, select: { spaceId: true } })) {
    return;
  }
  await db.$transaction(async (tx) => {
    const created = await tx.shoppingSettings.createMany({
      data: [{ spaceId }],
      skipDuplicates: true,
    });
    if (created.count === 0) return;
    const aisles = await tx.aisle.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: { translations: { where: { locale: LOCALE }, select: { name: true } } },
    });
    await tx.shoppingSection.createMany({
      data: aisles.map((aisle, index) => ({
        spaceId,
        name: aisle.translations[0]?.name ?? aisle.code,
        sortOrder: index,
        aisleId: aisle.id,
      })),
    });
  });
}

export async function saveEditRole(db: Db, spaceId: string, editRole: SpaceRole): Promise<void> {
  await ensureInitialized(db, spaceId);
  await db.shoppingSettings.update({ where: { spaceId }, data: { editRole } });
}

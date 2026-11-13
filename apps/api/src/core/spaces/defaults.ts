// Ce que recoit tout nouvel espace : les modules par defaut accordes et actifs [D33].
import type { Prisma } from "../db/client.ts";

export async function grantDefaultModules(
  tx: Prisma.TransactionClient,
  spaceId: string
): Promise<void> {
  const defaults = await tx.module.findMany({
    where: { isDefault: true, status: { in: ["AVAILABLE", "BETA"] } },
    orderBy: { sortOrder: "asc" },
  });
  if (defaults.length === 0) return;
  const now = new Date();
  await tx.spaceModule.createMany({
    data: defaults.map((module, index) => ({
      spaceId,
      moduleCode: module.code,
      enabled: true,
      enabledChangedAt: now,
      sortOrder: index,
    })),
  });
}

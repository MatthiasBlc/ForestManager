// Seed idempotent (upsert seulement, jamais de truncate) : il tourne a chaque
// deploy sur des bases persistantes. Referentiels uniquement [D76] ; C1 : le
// catalogue des modules.

import { createDb, type Db } from "../src/core/db/client.ts";

/**
 * `status` n'est ecrit qu'a la creation : ensuite il appartient au super admin.
 * `isDefault` vient du code [D33] et est toujours reapplique.
 */
const MODULES = [
  { code: "recipes", status: "AVAILABLE", isDefault: true, sortOrder: 1 },
  { code: "meal-plan", status: "COMING_SOON", isDefault: false, sortOrder: 2 },
  { code: "shopping", status: "COMING_SOON", isDefault: false, sortOrder: 3 },
] as const;

export async function seed(db: Db): Promise<void> {
  for (const module of MODULES) {
    await db.module.upsert({
      where: { code: module.code },
      create: module,
      update: { isDefault: module.isDefault },
    });
  }
}

// Lance directement (`node prisma/seed.ts`, `prisma db seed`) : pas a l'import par les tests.
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const db = createDb(url);
  try {
    await seed(db);
    process.stdout.write("seed done\n");
  } finally {
    await db.$disconnect();
  }
}

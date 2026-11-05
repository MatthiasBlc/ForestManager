// Seed idempotent (upsert seulement, jamais de truncate) : il tourne a chaque
// deploy sur des bases persistantes. Referentiels uniquement [D76] ; C1 : le
// catalogue des modules, aligne sur le registre (voir syncCatalog), et les
// referentiels (unites, rayons, tags globaux).

import { createDb, type Db } from "../src/core/db/client.ts";
import { syncCatalog } from "../src/core/modules/registry.ts";
import { MODULES } from "../src/modules/index.ts";
import { seedReferentials } from "../src/referentials/seed.ts";

export async function seed(db: Db): Promise<void> {
  await syncCatalog(db, MODULES);
  await seedReferentials(db);
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

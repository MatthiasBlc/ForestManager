// Base de test partagee par les fichiers (un client par processus de test).
import { loadEnv } from "../../src/core/config/env.ts";
import { createDb, type Db } from "../../src/core/db/client.ts";
import { seed } from "../../prisma/seed.ts";

export const testEnv = loadEnv();
export const db: Db = createDb(testEnv.DATABASE_URL);

/** Referentiels : remplis par le seed, jamais vides entre deux fichiers. */
const KEPT_TABLES = new Set(["_prisma_migrations", "Module"]);

/** Vide toutes les tables hors referentiels, puis rejoue le seed. */
export async function resetDatabase(): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const tables = rows.map((row) => row.tablename).filter((name) => !KEPT_TABLES.has(name));
  if (tables.length > 0) {
    await db.$executeRawUnsafe(
      `TRUNCATE ${tables.map((name) => `"${name}"`).join(", ")} RESTART IDENTITY CASCADE`
    );
  }
  await seed(db);
}

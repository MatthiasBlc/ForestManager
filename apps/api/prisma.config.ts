// Configuration de la CLI Prisma 7 (migrations, seed, URL de la base).
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.ts",
  },
  // `generate` n'a pas besoin de base : l'URL peut manquer sur l'hote.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});

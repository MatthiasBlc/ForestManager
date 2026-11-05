// Avant chaque fichier de test : base videe (hors referentiels) et seed rejoue.
import { afterAll, beforeAll } from "vitest";

import { db, resetDatabase } from "./helpers/db.ts";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

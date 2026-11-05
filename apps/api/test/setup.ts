// Avant chaque fichier de test : base videe (hors referentiels) et seed rejoue.
import { afterAll, beforeAll } from "vitest";

import { TEST_PASSWORD } from "@fm/test-utils";

import { createPasswordHasher } from "../src/core/auth/password.ts";
import { db, resetDatabase } from "./helpers/db.ts";
import { setTestPasswordHash } from "./helpers/factories.ts";

beforeAll(async () => {
  await resetDatabase();
  setTestPasswordHash(await createPasswordHasher(true).hash(TEST_PASSWORD));
});

afterAll(async () => {
  await db.$disconnect();
});

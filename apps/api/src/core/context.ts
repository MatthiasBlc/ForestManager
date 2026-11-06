// Dependances partagees par les routeurs et services du socle.
import type { Logger } from "pino";

import type { PasswordHasher } from "./auth/password.ts";
import type { Env } from "./config/env.ts";
import type { Db } from "./db/client.ts";
import type { Mailer } from "./mail/mailer.ts";
import type { LifecycleHooks } from "./modules/hooks.ts";
import type { ApiModule } from "./modules/registry.ts";
import type { PageFetcher } from "./net/page-fetcher.ts";
import type { Storage } from "./storage/storage.ts";

export interface Context {
  env: Env;
  db: Db;
  logger: Logger;
  mailer: Mailer | null;
  /** Photos et avatars ; null sans variables MINIO_* [D167]. */
  storage: Storage | null;
  /** Lecture des pages web (import de recettes), protegee contre le SSRF. */
  fetchPage: PageFetcher;
  hasher: PasswordHasher;
  hooks: LifecycleHooks;
  /** Manifestes du registre (src/modules/index.ts), injectes. */
  modules: readonly ApiModule[];
}

// Dependances partagees par les routeurs et services du socle.
import type { Logger } from "pino";

import type { PasswordHasher } from "./auth/password.ts";
import type { Env } from "./config/env.ts";
import type { Db } from "./db/client.ts";
import type { Mailer } from "./mail/mailer.ts";

export interface Context {
  env: Env;
  db: Db;
  logger: Logger;
  mailer: Mailer | null;
  hasher: PasswordHasher;
}

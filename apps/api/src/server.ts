// Point d'entree : charge l'environnement, ouvre la base, demarre HTTP et
// s'arrete proprement sur SIGTERM / SIGINT (docker stop).

import { loadEnv } from "./core/config/env.ts";
import { createDb } from "./core/db/client.ts";
import { createApp } from "./core/http/app.ts";
import { createLogger } from "./core/http/logger.ts";

const env = loadEnv();
const logger = createLogger(env);
const db = createDb(env.DATABASE_URL);
const app = createApp({ env, db, logger });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API ready");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "shutting down");
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
  // Filet : les connexions keep-alive ne doivent pas bloquer l'arret.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

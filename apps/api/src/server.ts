// Point d'entree : charge l'environnement, ouvre la base, demarre HTTP, lance
// les taches horaires et s'arrete proprement sur SIGTERM / SIGINT (docker stop).

import { purgeExpiredSessions } from "./core/auth/session.ts";
import { loadEnv } from "./core/config/env.ts";
import { createDb } from "./core/db/client.ts";
import { createApp, createContext } from "./core/http/app.ts";
import { createLogger } from "./core/http/logger.ts";
import { purgeDeletedSpaces } from "./core/spaces/service.ts";

const env = loadEnv();
const logger = createLogger(env);
const db = createDb(env.DATABASE_URL);
const ctx = createContext({ env, db, logger });
const app = createApp(ctx);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API ready");
});

// Taches horaires : sessions expirees, espaces supprimes depuis plus de 30 jours [D22].
async function hourlyJobs(): Promise<void> {
  const sessions = await purgeExpiredSessions(db);
  const spaces = await purgeDeletedSpaces(ctx);
  if (sessions + spaces > 0) logger.info({ sessions, spaces }, "purge done");
}
const jobs = setInterval(
  () => {
    hourlyJobs().catch((error: unknown) => {
      logger.error({ err: error }, "hourly jobs failed");
    });
  },
  60 * 60 * 1000
);
jobs.unref();

function shutdown(signal: string): void {
  logger.info({ signal }, "shutting down");
  clearInterval(jobs);
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
  // Filet : les connexions keep-alive ne doivent pas bloquer l'arret.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

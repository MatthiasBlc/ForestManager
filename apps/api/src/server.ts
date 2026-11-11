// Point d'entree : charge l'environnement, ouvre la base, demarre HTTP, lance
// les taches horaires et s'arrete proprement sur SIGTERM / SIGINT (docker stop).

import { purgeExpiredAdminSessions } from "./core/admin/session.ts";
import { purgeExpiredSessions } from "./core/auth/session.ts";
import { loadEnv } from "./core/config/env.ts";
import { createDb } from "./core/db/client.ts";
import { createApp, createContext } from "./core/http/app.ts";
import { createLogger } from "./core/http/logger.ts";
import { purgeDeletedSpaces } from "./core/spaces/service.ts";
import { expireExports } from "./core/exports/service.ts";
import { sweepStorage } from "./core/storage/images.ts";
import { purgeNotifications } from "./core/notifications/service.ts";
import { MODULES } from "./modules/index.ts";

const env = loadEnv();
const logger = createLogger(env);
const db = createDb(env.DATABASE_URL);
// Stack E2E (NODE_ENV=test) : routes de test [D79], absentes de l'image de production.
const testRoutes =
  env.NODE_ENV === "test" ? (await import("../test/e2e/routes.ts")).e2eRoutes : undefined;
const ctx = createContext({ env, db, logger, modules: MODULES });
const app = createApp({ ...ctx, testRoutes });

// En dev, le bucket du stockage local est cree au besoin (en preprod et prod il existe deja).
if (ctx.storage && env.NODE_ENV !== "production") {
  ctx.storage.ensureBucket().catch((error: unknown) => {
    logger.error({ err: error }, "storage bucket unavailable");
  });
}

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API ready");
});

// Taches horaires : sessions expirees, espaces supprimes depuis plus de 30 jours [D22],
// puis menage du stockage (apres la purge, qui libere des images) [D167],
// notifications anciennes [D190] et exports expires (avant le menage, qui efface
// alors leur archive) [D192].
async function hourlyJobs(): Promise<void> {
  const sessions = (await purgeExpiredSessions(db)) + (await purgeExpiredAdminSessions(db));
  const spaces = await purgeDeletedSpaces(ctx);
  const exports = await expireExports(ctx);
  const files = await sweepStorage(ctx);
  const notifications = await purgeNotifications(db);
  if (sessions + spaces + exports + files + notifications > 0)
    logger.info({ sessions, spaces, exports, files, notifications }, "purge done");
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
  // Les flux SSE ouverts retiendraient l'arret : on les ferme d'abord.
  ctx.realtime.closeAll();
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
  // Filet : les connexions keep-alive ne doivent pas bloquer l'arret.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

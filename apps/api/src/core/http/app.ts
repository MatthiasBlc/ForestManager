// Application Express 5. Tout est injecte (env, base, journal) : les tests
// construisent leur propre app sur la base de test.

import { API_PREFIX, appConfigSchema } from "@fm/shared";
import cors from "cors";
import express, { Router } from "express";
import type { Logger } from "pino";

import { activityRouter } from "../activity/routes.ts";
import { changelogRouter } from "../changelog/routes.ts";
import { adminRouter } from "../admin/routes.ts";
import { createPasswordHasher, type PasswordHasher } from "../auth/password.ts";
import { authRouter } from "../auth/routes.ts";
import { sessionMiddleware } from "../auth/session.ts";
import type { Env } from "../config/env.ts";
import type { Context } from "../context.ts";
import type { Db } from "../db/client.ts";
import { createMailer, type Mailer } from "../mail/mailer.ts";
import { requireModule } from "../modules/guards.ts";
import type { LifecycleHooks } from "../modules/hooks.ts";
import { assertValidModules, hooksFrom, type ApiModule } from "../modules/registry.ts";
import { modulesRouter } from "../modules/routes.ts";
import { notificationsRouter } from "../notifications/routes.ts";
import { createRealtime, type Realtime } from "../realtime/hub.ts";
import { publishSpaceChanges, realtimeRouter } from "../realtime/routes.ts";
import { referentialsRouter } from "../../referentials/routes.ts";
import { searchRouter } from "../search/routes.ts";
import { exportsRouter } from "../exports/routes.ts";
import { homeRouter } from "../home/routes.ts";
import { invitationsRouter } from "../spaces/invitations-routes.ts";
import { storageRouter } from "../storage/routes.ts";
import { createStorage, type Storage } from "../storage/storage.ts";
import { createPageFetcher, type PageFetcher } from "../net/page-fetcher.ts";
import { spacesRouter } from "../spaces/routes.ts";
import { requireAuth } from "./auth.ts";
import { errorHandler, notFoundHandler } from "./errors.ts";
import { httpLogger } from "./logger.ts";
import { csrfProtection, securityHeaders } from "./security.ts";
import { reply } from "./validate.ts";

export interface AppDeps {
  env: Env;
  db: Db;
  logger: Logger;
  /** Limitation de debit ; coupee par defaut en test. */
  rateLimit?: boolean;
  /** Transport des emails ; par defaut celui de SMTP_URL (null sans SMTP). */
  mailer?: Mailer | null;
  /** Stockage des photos ; par defaut celui des variables MINIO_* (null sans). */
  storage?: Storage | null;
  /** Lecture des pages web ; les tests autorisent leur serveur local. */
  fetchPage?: PageFetcher;
  hasher?: PasswordHasher;
  hooks?: LifecycleHooks;
  /** Diffusion temps reel ; un hub en memoire par defaut. */
  realtime?: Realtime;
  /** Manifestes des modules (src/modules/index.ts) ; le socle ne les importe pas [D40]. */
  modules: readonly ApiModule[];
}

/** Taille maximale d'un corps JSON (comme la V1). */
const JSON_LIMIT = "50kb";

/** Contexte complet a partir des dependances (valeurs par defaut selon l'environnement). */
export function createContext(deps: AppDeps): Context {
  const { env } = deps;
  return {
    env,
    db: deps.db,
    logger: deps.logger,
    mailer: deps.mailer === undefined ? createMailer(env) : deps.mailer,
    storage: deps.storage === undefined ? createStorage(env) : deps.storage,
    fetchPage: deps.fetchPage ?? createPageFetcher(),
    hasher: deps.hasher ?? createPasswordHasher(env.NODE_ENV === "test"),
    hooks: deps.hooks ?? hooksFrom(deps.modules),
    realtime: deps.realtime ?? createRealtime(),
    modules: deps.modules,
  };
}

export function createApp(deps: AppDeps): express.Express {
  const { env } = deps;
  const production = env.NODE_ENV === "production";
  const rateLimit = deps.rateLimit ?? env.NODE_ENV !== "test";
  assertValidModules(deps.modules);
  const ctx = createContext(deps);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.set("query parser", "simple");
  app.locals.validateResponses = !production;

  app.use(httpLogger(deps.logger));
  app.use(securityHeaders(production));
  if (env.CORS_ORIGIN) app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

  // Hors prefixe, sans CSRF : sonde des conteneurs.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(express.json({ limit: JSON_LIMIT }));
  app.use(csrfProtection(env.SESSION_SECRET, production));

  const api = Router();
  api.get("/config", (_req, res) => {
    reply(res, appConfigSchema, {
      features: { email: ctx.mailer !== null, uploads: ctx.storage !== null },
    });
  });
  // Admin avant la session des utilisateurs : cookie et table distincts [D174].
  api.use("/admin", adminRouter(ctx, rateLimit));
  api.use(sessionMiddleware(deps.db, env.SESSION_SECRET, production));
  api.use(publishSpaceChanges(ctx));
  api.use(realtimeRouter(ctx));
  api.use(authRouter(ctx, rateLimit));
  api.use(storageRouter(ctx, rateLimit));
  api.use(spacesRouter(ctx));
  api.use(invitationsRouter(ctx, rateLimit));
  api.use(modulesRouter(ctx));
  api.use(notificationsRouter(ctx));
  api.use(activityRouter(ctx));
  api.use(changelogRouter(ctx));
  api.use(searchRouter(ctx, rateLimit));
  api.use(exportsRouter(ctx, rateLimit));
  api.use(homeRouter(ctx));
  api.use(referentialsRouter(ctx, rateLimit));
  // Routeurs des modules, chacun derriere sa garde [D33].
  for (const module of ctx.modules) {
    if (!module.router) continue;
    const mount = Router({ mergeParams: true });
    mount.use(requireAuth, requireModule(ctx, module), module.router(ctx));
    api.use(`/spaces/:spaceId/${module.code}`, mount);
  }
  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Application Express 5. Tout est injecte (env, base, journal) : les tests
// construisent leur propre app sur la base de test.

import { API_PREFIX, appConfigSchema } from "@fm/shared";
import cors from "cors";
import express, { Router } from "express";
import type { Logger } from "pino";

import type { Env } from "../config/env.ts";
import type { Db } from "../db/client.ts";
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
}

/** Taille maximale d'un corps JSON (comme la V1). */
const JSON_LIMIT = "50kb";

export function createApp(deps: AppDeps): express.Express {
  const { env } = deps;
  const production = env.NODE_ENV === "production";
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
    reply(res, appConfigSchema, { features: { email: Boolean(env.SMTP_URL) } });
  });
  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

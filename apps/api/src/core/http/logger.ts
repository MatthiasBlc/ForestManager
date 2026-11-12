// Journaux pino : JSON en prod, lisibles en dev, muets en test. Chaque requete
// recoit un identifiant (repris de X-Request-Id s'il est sain), renvoye en en-tete.

import { randomUUID } from "node:crypto";

import { pino, type Logger } from "pino";
import { pinoHttp } from "pino-http";

import type { Env } from "../config/env.ts";

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function createLogger(env: Env): Logger {
  const level =
    env.LOG_LEVEL ?? { production: "info", development: "debug", test: "silent" }[env.NODE_ENV];
  return pino({
    level,
    // Jamais de secret dans les journaux.
    redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
    ...(env.NODE_ENV === "development" && {
      transport: { target: "pino-pretty", options: { colorize: true } },
    }),
  });
}

export function httpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id =
        typeof incoming === "string" && REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === "/health" },
    customLogLevel: (_req, res, error) =>
      error !== undefined || res.statusCode >= 500
        ? "error"
        : res.statusCode >= 400
          ? "warn"
          : "info",
  });
}

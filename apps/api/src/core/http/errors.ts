// Erreurs metier et gestionnaire unique : toute erreur sort au format
// `{ error: { code, message, details } }` [D72]. Express 5 transmet seul les
// rejets des handlers async.

import { ERRORS, errorBody, type ErrorCode } from "@fm/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";

import type { ErrorTracking } from "../monitoring/error-tracking.ts";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, details?: unknown) {
    super(ERRORS[code].message);
    this.name = "AppError";
    this.code = code;
    this.status = ERRORS[code].status;
    this.details = details;
  }
}

/** Erreurs levees par body-parser (express.json). */
function bodyParserCode(error: unknown): ErrorCode | null {
  if (typeof error !== "object" || error === null || !("type" in error)) return null;
  if (error.type === "entity.too.large") return "COMMON_005";
  if (error.type === "entity.parse.failed" || error.type === "encoding.unsupported") {
    return "VALIDATION_001";
  }
  return null;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("COMMON_003"));
};

/**
 * Gestionnaire unique. Seules les erreurs inattendues (500) partent au suivi
 * d'erreurs, avec l'UUID de l'utilisateur et l'identifiant de requete [D196].
 */
export const errorHandler =
  (errorTracking: ErrorTracking | null): ErrorRequestHandler =>
  (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json(errorBody(error.code, error.details));
      return;
    }
    const code = bodyParserCode(error);
    if (code) {
      res.status(ERRORS[code].status).json(errorBody(code));
      return;
    }
    req.log.error({ err: error }, "unhandled error");
    errorTracking?.captureException(error, {
      // Absente sur les routes montees avant la session (tunnel, admin, tests).
      userId: (req.session as Partial<typeof req.session> | undefined)?.userId,
      requestId: typeof req.id === "string" ? req.id : undefined,
    });
    res.status(500).json(errorBody("COMMON_001"));
  };

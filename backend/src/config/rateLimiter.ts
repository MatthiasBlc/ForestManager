import rateLimit, { Options } from "express-rate-limit";
import { RequestHandler } from "express";
import env from "../util/validateEnv";

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message: string;
  skip?: Options["skip"];
}

/**
 * Factory pour creer un rate limiter avec les options standard.
 * Desactive automatiquement en mode test.
 */
export function createRateLimiter({
  windowMs,
  max,
  message,
  skip,
}: RateLimiterOptions): RequestHandler {
  if (env.NODE_ENV === "test") {
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip,
  });
}

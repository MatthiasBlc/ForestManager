import helmet from "helmet";
import { RequestHandler } from "express";
import env from "../util/validateEnv";
import { ADMIN_011 } from "../constants/errorCodes";
import { createRateLimiter } from "../config/rateLimiter";

/**
 * Helmet configuration with strict security headers
 * CSP, X-Frame-Options, X-Content-Type-Options, etc.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline pour les styles inline
      imgSrc: ["'self'", "data:"], // data: pour les QR codes base64
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"], // Equivalent de X-Frame-Options: DENY
    },
  },
  crossOriginEmbedderPolicy: false, // Desactive pour compatibilite CORS
  xFrameOptions: { action: "deny" },
  xContentTypeOptions: true, // X-Content-Type-Options: nosniff
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts:
    env.NODE_ENV === "production"
      ? {
          maxAge: 31536000, // 1 an
          includeSubDomains: true,
          preload: true,
        }
      : false,
});

/** Rate limiter user auth (signup/login) : 10 req / 15 min */
export const authRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "AUTH_002: Too many attempts, please try again later",
});

/** Rate limiter global admin (hors auth) : 30 req / min */
export const adminRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: ADMIN_011,
  skip: (req) => req.path.startsWith("/auth"),
});

/**
 * Middleware pour forcer HTTPS en production
 * Redirige les requetes HTTP vers HTTPS uniquement pour les requetes directes
 * Note: Derriere un reverse proxy (Traefik), le header x-forwarded-proto
 * doit etre passe par les proxies intermediaires pour indiquer le protocole client.
 */
export const requireHttps: RequestHandler = (req, res, next) => {
  if (env.NODE_ENV === "production") {
    const proto = req.headers["x-forwarded-proto"];
    // Rediriger seulement si explicitement HTTP (pas si header absent ou https)
    if (proto === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
};

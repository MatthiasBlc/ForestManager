import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RequestHandler } from "express";
import env from "../util/validateEnv";

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
      connectSrc: ["'self'"],
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
  hsts: env.NODE_ENV === "production" ? {
    maxAge: 31536000, // 1 an
    includeSubDomains: true,
    preload: true,
  } : false,
});

/**
 * Rate limiter global pour les routes admin (hors auth)
 * Plus permissif que le rate limiter auth (30 req/min)
 */
export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requetes par minute
  message: { error: "ADMIN_011: Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip pour les routes auth (elles ont leur propre rate limiter plus strict)
    return req.path.startsWith("/auth");
  },
});

/**
 * Middleware pour forcer HTTPS en production
 * Redirige les requetes HTTP vers HTTPS
 */
export const requireHttps: RequestHandler = (req, res, next) => {
  if (env.NODE_ENV === "production") {
    // Verifier le header x-forwarded-proto (derriere un proxy comme Traefik)
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      // Rediriger vers HTTPS
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
};

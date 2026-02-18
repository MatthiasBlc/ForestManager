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
/**
 * Rate limiter pour les routes d'authentification user (signup/login).
 * 10 tentatives par IP par fenetre de 15 minutes.
 */
export const authRateLimiter: RequestHandler = env.NODE_ENV === "test"
  ? ((_req, _res, next) => next())
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10,
      message: { error: "AUTH_002: Too many attempts, please try again later" },
      standardHeaders: true,
      legacyHeaders: false,
    });

export const adminRateLimiter: RequestHandler = env.NODE_ENV === "test"
  ? ((_req, _res, next) => next())
  : rateLimit({
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

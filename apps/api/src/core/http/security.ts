// En-tetes de securite, CSRF et limitation de debit.
//
// CSRF : double submit signe. Le cookie XSRF-TOKEN (lisible par le front)
// porte `<aleatoire>.<HMAC(secret, aleatoire)>` ; toute requete mutante doit
// renvoyer la meme valeur dans X-XSRF-TOKEN. La signature empeche d'injecter
// un cookie forge depuis un sous-domaine (faiblesse du double submit simple
// de la V1). Actif aussi en test (la V1 le coupait).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { ERRORS, errorBody, type ErrorCode } from "@fm/shared";
import type { Request, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

export const CSRF_COOKIE = "XSRF-TOKEN";
export const CSRF_HEADER = "x-xsrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** L'API ne sert que du JSON : politique la plus stricte. */
export function securityHeaders(production: boolean): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
    hsts: production ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function sign(secret: string, nonce: string): string {
  return createHmac("sha256", secret).update(`csrf:${nonce}`).digest("base64url");
}

function isSignedToken(secret: string, token: string): boolean {
  const [nonce, signature, extra] = token.split(".");
  if (!nonce || !signature || extra !== undefined) return false;
  return safeEqual(signature, sign(secret, nonce));
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function csrfProtection(secret: string, secure: boolean): RequestHandler {
  return (req, res, next) => {
    let token = readCookie(req, CSRF_COOKIE);
    if (token === undefined || !isSignedToken(secret, token)) {
      const nonce = randomBytes(32).toString("base64url");
      token = `${nonce}.${sign(secret, nonce)}`;
      res.cookie(CSRF_COOKIE, token, { httpOnly: false, secure, sameSite: "lax", path: "/" });
      // Cookie neuf : une requete mutante qui arrive sans cookie valide est refusee.
      if (!SAFE_METHODS.has(req.method)) {
        res.status(403).json(errorBody("COMMON_002"));
        return;
      }
    }
    if (!SAFE_METHODS.has(req.method)) {
      const header = req.headers[CSRF_HEADER];
      if (typeof header !== "string" || !safeEqual(header, token)) {
        res.status(403).json(errorBody("COMMON_002"));
        return;
      }
    }
    next();
  };
}

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  code?: ErrorCode;
}

/** Limiteur de debit au format d'erreur unique. `enabled: false` en test, sauf tests dedies. */
export function createRateLimiter(enabled: boolean, options: RateLimitOptions): RequestHandler {
  if (!enabled)
    return (_req, _res, next) => {
      next();
    };
  const code = options.code ?? "COMMON_004";
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(ERRORS[code].status).json(errorBody(code));
    },
  });
}

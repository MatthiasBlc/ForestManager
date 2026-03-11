import crypto from "crypto";
import { Request, RequestHandler } from "express";
import env from "../util/validateEnv";
import { CSRF_001 } from "../constants/errorCodes";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "x-xsrf-token";

/**
 * Parse un cookie specifique depuis le header Cookie de la requete.
 */
function getCookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const cookie of header.split(";")) {
    const [key, ...rest] = cookie.split("=");
    if (key.trim() === name) {
      return decodeURIComponent(rest.join("=").trim());
    }
  }
  return undefined;
}

/**
 * CSRF Protection - Double Submit Cookie Pattern
 *
 * - Sur chaque requete, s'assure qu'un cookie XSRF-TOKEN existe (le cree sinon)
 * - Sur les requetes mutantes (POST, PATCH, PUT, DELETE), verifie que le header
 *   X-XSRF-TOKEN correspond au cookie
 * - Un attaquant cross-origin ne peut pas lire le cookie (same-origin policy)
 *   donc ne peut pas forger le header
 * - Desactive en environnement de test (comme les rate limiters)
 */
export const csrfProtection: RequestHandler = (req, res, next) => {
  // Desactive en test (coherent avec les rate limiters)
  if (env.NODE_ENV === "test") {
    return next();
  }

  // S'assurer que le cookie CSRF existe
  let token = getCookieValue(req, CSRF_COOKIE_NAME);
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Le frontend JS doit pouvoir le lire
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  // Valider sur les requetes mutantes
  if (!SAFE_METHODS.includes(req.method)) {
    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
    if (!headerToken || headerToken !== token) {
      res.status(403).json({ error: CSRF_001 });
      return;
    }
  }

  next();
};

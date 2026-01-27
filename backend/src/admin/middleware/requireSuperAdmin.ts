import { RequestHandler } from "express";
import createHttpError from "http-errors";

/**
 * Middleware pour proteger les routes admin.
 * Verifie que:
 * 1. L'admin est authentifie (adminId en session)
 * 2. Le TOTP a ete verifie (totpVerified = true)
 */
export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.adminId) {
    return next(createHttpError(401, "ADMIN_001: Not authenticated"));
  }
  
  if (!req.session.totpVerified) {
    return next(createHttpError(401, "ADMIN_002: TOTP not verified"));
  }
  
  next();
};

/**
 * Middleware pour les routes d'auth admin (login, totp/verify).
 * Verifie seulement que l'admin a commence le processus de login.
 */
export const requireAdminSession: RequestHandler = (req, res, next) => {
  if (!req.session.adminId) {
    return next(createHttpError(401, "ADMIN_001: Not authenticated"));
  }
  
  next();
};

// Garde des routes connectees.
import type { Request, RequestHandler } from "express";

import { AppError } from "./errors.ts";

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) throw new AppError("AUTH_001");
  // Session ouverte par un mot de passe temporaire : rien d'autre que son remplacement [D134].
  if (req.session.passwordChoice) throw new AppError("AUTH_011");
  next();
};

/** Connecte, y compris par un mot de passe temporaire (GET /me, choix du mot de passe). */
export const requireSession: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) throw new AppError("AUTH_001");
  next();
};

/** Utilisateur de la session ; a appeler derriere requireAuth. */
export function currentUserId(req: Request): string {
  const { userId } = req.session;
  if (!userId) throw new AppError("AUTH_001");
  return userId;
}

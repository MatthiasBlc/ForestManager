import { RequestHandler } from "express";
import { VALIDATION_001 } from "../constants/errorCodes";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware qui valide que tous les params de route qui sont des UUID
 * (noms finissant par "Id" ou egal a "id") respectent le format UUID v4.
 * Retourne 400 VALIDATION_001 si invalide.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateUUID: RequestHandler<any> = (req, res, next) => {
  for (const [key, value] of Object.entries(req.params as Record<string, string>)) {
    if ((key === "id" || key.endsWith("Id")) && !UUID_V4_REGEX.test(value)) {
      res.status(400).json({
        error: VALIDATION_001(`Invalid UUID format for parameter '${key}'`),
      });
      return;
    }
  }
  next();
};

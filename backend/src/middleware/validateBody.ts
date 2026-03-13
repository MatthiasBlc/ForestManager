import { RequestHandler } from "express";
import { ZodSchema } from "zod";
import createHttpError from "http-errors";

/**
 * Middleware qui valide req.body avec un schema Zod.
 * En cas d'echec, renvoie 400 avec le premier message d'erreur.
 * En cas de succes, remplace req.body par les donnees parsees (stripping des champs inconnus).
 */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(createHttpError(400, firstIssue.message));
    }
    req.body = result.data;
    next();
  };
}

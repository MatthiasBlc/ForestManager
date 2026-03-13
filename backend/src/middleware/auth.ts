import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { AUTH_001 } from "../constants/errorCodes";

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    next(createHttpError(401, AUTH_001));
  }
};

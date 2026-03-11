import { NextFunction, Request, Response } from "express";
import { isHttpError } from "http-errors";
import logger from "../util/logger";
import { ValidationError } from "../util/validation";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (error: unknown, req: Request, res: Response, next: NextFunction) => {
  // ValidationError → 400 (input validation)
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  logger.error({ err: error, path: req.path, method: req.method }, "Unhandled error");
  let errorMessage = "An unknown error occurred";
  let statusCode = 500;
  if (isHttpError(error)) {
    statusCode = error.status;
    errorMessage = error.message;
  }
  res.status(statusCode).json({ error: errorMessage });
};

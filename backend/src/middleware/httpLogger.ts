import { Request } from "express";
import pinoHttp from "pino-http";
import logger from "../util/logger";

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => (req.url === "/health"),
  },
  customProps: (req) => {
    const userId = (req as unknown as Request).session?.userId;
    return userId ? { userId } : {};
  },
});

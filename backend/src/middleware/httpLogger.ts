import pinoHttp from "pino-http";
import logger from "../util/logger";

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => (req.url === "/health"),
  },
  customProps: (req) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (req as any).session?.userId;
    return userId ? { userId } : {};
  },
});

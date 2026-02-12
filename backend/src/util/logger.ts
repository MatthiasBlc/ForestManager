import pino from "pino";

const env = process.env.NODE_ENV || "development";

const logger = pino({
  level: env === "test" ? "silent" : env === "production" ? "info" : "debug",
  ...(env !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export default logger;

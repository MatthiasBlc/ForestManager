import { PrismaClient } from "@prisma/client";
import logger from "./logger";

const env = process.env.NODE_ENV || "development";

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log:
      env === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : env === "test"
          ? []
          : [
              { emit: "stdout", level: "warn" },
              { emit: "stdout", level: "error" },
            ],
  });

  if (env === "development") {
    client.$on("query", (e) => {
      if (e.duration > 100) {
        logger.warn({ duration: e.duration, query: e.query }, "Slow query detected");
      }
    });
  }

  return client;
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (env !== "production") globalForPrisma.prisma = prisma;

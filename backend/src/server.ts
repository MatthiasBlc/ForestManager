import http from "http";
import app, { userSession } from "./app";
import env from "./util/validateEnv";
import prisma from "./util/db";
import { initSocketServer } from "./services/socketServer";
import logger from "./util/logger";

const port = env.PORT;

async function main() {
  const server = http.createServer(app);
  initSocketServer(server, userSession);

  server.listen(port, () => {
    logger.info({ port }, "Server started");
  });
}

main()
  .catch((e) => logger.fatal({ err: e }, "Failed to start server"))
  .finally(async () => await prisma.$disconnect());

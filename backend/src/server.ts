import http from "http";
import app, { userSession } from "./app";
import env from "./util/validateEnv";
import prisma from "./util/db";
import { initSocketServer } from "./services/socketServer";

const port = env.PORT;

async function main() {
  const server = http.createServer(app);
  initSocketServer(server, userSession);

  server.listen(port, () => {
    console.log(`server running on port: ${port}!`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());

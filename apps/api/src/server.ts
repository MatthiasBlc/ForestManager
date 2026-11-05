// Point d'entree provisoire : remplace par l'app Express 5 en C1.4.
import { createServer } from "node:http";

import { API_PREFIX } from "@fm/shared";

const port = Number(process.env.PORT ?? 3001);

const server = createServer((req, res) => {
  const ok = req.url === "/health";
  res.writeHead(ok ? 200 : 404, { "content-type": "application/json" });
  res.end(JSON.stringify(ok ? { status: "ok" } : { error: { code: "COMMON_NOT_FOUND" } }));
});

server.listen(port, () => {
  process.stdout.write(`API prete sur :${port} (prefixe ${API_PREFIX})\n`);
});

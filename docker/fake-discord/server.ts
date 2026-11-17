// Faux Discord des parcours E2E [D210] : juste ce que l'API et le navigateur
// appellent. Le parcours choisit le prochain profil (POST /__profile), la page
// d'autorisation renvoie aussitot vers le callback avec un code qui le designe.
// Lance par docker/compose.e2e.yml (Node 22, types effaces nativement).
import { createServer, type IncomingMessage } from "node:http";

interface Profile {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
  avatar: string | null;
}

const PORT = 4000;
const profiles = new Map<string, Profile>();
let next: Profile | null = null;
let sequence = 0;

async function body(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };

    if (req.method === "POST" && url.pathname === "/__profile") {
      next = JSON.parse(await body(req)) as Profile;
      json(200, { ok: true });
      return;
    }
    if (req.method === "GET" && url.pathname === "/oauth2/authorize") {
      const redirect = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state") ?? "";
      if (!redirect || !next) {
        json(400, { error: "no profile or redirect_uri" });
        return;
      }
      sequence += 1;
      const code = `code-${String(sequence)}`;
      profiles.set(code, next);
      const target = new URL(redirect);
      target.searchParams.set("code", code);
      target.searchParams.set("state", state);
      res.writeHead(302, { Location: target.toString() });
      res.end();
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/v10/oauth2/token") {
      const code = new URLSearchParams(await body(req)).get("code") ?? "";
      if (!profiles.has(code)) {
        json(400, { error: "invalid_grant" });
        return;
      }
      json(200, { access_token: code, token_type: "Bearer", expires_in: 600 });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/v10/users/@me") {
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      const profile = profiles.get(token);
      if (!profile) {
        json(401, { message: "401: Unauthorized" });
        return;
      }
      json(200, profile);
      return;
    }
    if (url.pathname === "/health") {
      json(200, { status: "ok" });
      return;
    }
    json(404, { message: "not found" });
  })();
}).listen(PORT, () => {
  console.log(`fake discord on :${String(PORT)}`);
});

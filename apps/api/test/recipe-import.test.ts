// Import d'une recette par lien (C3.8) : pages de fixtures servies en local,
// anti-SSRF a chaque redirection, limites de taille et de delai.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPageFetcher, isPublicAddress } from "../src/core/net/page-fetcher.ts";
import { createTestApp, createClient, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createSpace, createUser } from "./helpers/factories.ts";
import { recipeBody } from "./helpers/recipes.ts";

const RECIPE_PAGE = `<!doctype html><html><head><title>Curry</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
{"@type":"Recipe","name":"Curry d'aubergine","recipeYield":"2 personnes","prepTime":"PT15M",
"recipeIngredient":["2 pièce(s) Aubergine","selon le goût Poivre et sel"],
"recipeInstructions":[{"@type":"HowToStep","text":"Couper l'aubergine."}]}]}</script>
</head><body>...</body></html>`;

let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const send = (status: number, body: string | Buffer, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
      res.end(body);
    };
    switch (req.url) {
      case "/recipe":
        send(200, RECIPE_PAGE);
        break;
      case "/gzip":
        send(200, gzipSync(RECIPE_PAGE), { "content-encoding": "gzip" });
        break;
      case "/moved":
        send(301, "", { location: "/recipe" });
        break;
      case "/to-private":
        send(302, "", { location: "http://10.0.0.1/recipe" });
        break;
      case "/to-metadata":
        send(302, "", { location: "http://169.254.169.254/latest/meta-data/" });
        break;
      case "/to-ipv6":
        send(302, "", { location: "http://[fd00::1]/recipe" });
        break;
      case "/to-file":
        send(302, "", { location: "file:///etc/passwd" });
        break;
      case "/loop":
        send(302, "", { location: "/loop" });
        break;
      case "/none":
        send(200, "<html><body>Pas de recette ici</body></html>");
        break;
      case "/json":
        send(200, '{"@type":"Recipe"}', { "content-type": "application/json" });
        break;
      case "/big":
        send(200, `<html>${"x".repeat(4 * 1024 * 1024)}</html>`);
        break;
      case "/bomb":
        send(200, gzipSync(`<html>${" ".repeat(20 * 1024 * 1024)}</html>`), {
          "content-encoding": "gzip",
        });
        break;
      case "/slow":
        break; // ne repond jamais
      default:
        send(404, "absent");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

// Le serveur de fixtures est local : seule l'adresse de bouclage est permise en plus.
const app = createTestApp({
  fetchPage: createPageFetcher({ allowLoopback: true, timeoutMs: 1500 }),
});

async function member() {
  const user = await createUser();
  const space = await createSpace(user.id);
  const client = await loginAs(user, app);
  const importUrl = (url: string) => client.post(`/spaces/${space.id}/recipes/import`, { url });
  return { user, space, client, importUrl };
}

describe("isPublicAddress", () => {
  it.each([
    ["93.184.216.34", true],
    ["2606:4700::6810:84e5", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.16.0.1", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["224.0.0.1", false],
    ["::1", false],
    ["::", false],
    ["fd00::1", false],
    ["fe80::1", false],
    ["::ffff:10.0.0.1", false],
    ["::ffff:93.184.216.34", true],
  ])("%s -> %s", (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe("POST /spaces/:id/recipes/import", () => {
  it("lit la recette JSON-LD de la page, sans rien enregistrer", async () => {
    const m = await member();
    const res = await m.importUrl(`${base}/recipe`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: "Curry d'aubergine",
      yieldQuantity: 2,
      prepMinutes: 15,
      sourceUrl: `${base}/recipe`,
      steps: ["Couper l'aubergine."],
    });
    expect(res.body.ingredients).toHaveLength(2);
    expect(await db.recipe.count({ where: { homeSpaceId: m.space.id } })).toBe(0);
  });

  it("suit une redirection et lit une page compressee ; garde l'adresse finale", async () => {
    const m = await member();
    expect((await m.importUrl(`${base}/moved`)).body.sourceUrl).toBe(`${base}/recipe`);
    expect((await m.importUrl(`${base}/gzip`)).body.title).toBe("Curry d'aubergine");
  });

  it.each(["/to-private", "/to-metadata", "/to-ipv6", "/to-file"])(
    "refuse une redirection vers une adresse interdite (%s)",
    async (path) => {
      const m = await member();
      const res = await m.importUrl(`${base}${path}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("RECIPE_015");
    }
  );

  it("refuse une adresse locale avec la politique par defaut", async () => {
    const strict = createTestApp();
    const user = await createUser();
    const space = await createSpace(user.id);
    const client = await loginAs(user, strict);
    const port = new URL(base).port;
    for (const url of [`${base}/recipe`, `http://localhost:${port}/recipe`]) {
      const res = await client.post(`/spaces/${space.id}/recipes/import`, { url });
      expect(res.body.error.code).toBe("RECIPE_015");
    }
  });

  it.each([
    ["trop de redirections", "/loop"],
    ["une page trop lourde", "/big"],
    ["une page qui gonfle trop une fois decompressee", "/bomb"],
    ["une page trop lente", "/slow"],
    ["une page absente", "/absent"],
  ])("signale %s (RECIPE_016)", async (_label, path) => {
    const m = await member();
    const res = await m.importUrl(`${base}${path}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RECIPE_016");
  });

  it.each(["/none", "/json"])("signale une page sans recette (%s)", async (path) => {
    const m = await member();
    expect((await m.importUrl(`${base}${path}`)).body.error.code).toBe("RECIPE_017");
  });

  it("valide le lien et l'acces a l'espace", async () => {
    const m = await member();
    expect((await m.importUrl("ftp://example.com/r")).body.error.code).toBe("VALIDATION_001");
    expect((await m.importUrl("pas un lien")).body.error.code).toBe("VALIDATION_001");

    const outsider = await loginAs(await createUser(), app);
    const res = await outsider.post(`/spaces/${m.space.id}/recipes/import`, {
      url: `${base}/recipe`,
    });
    expect(res.body.error.code).toBe("SPACE_001");
    const anonymous = await createClient(app);
    expect(
      (await anonymous.post(`/spaces/${m.space.id}/recipes/import`, { url: `${base}/recipe` })).body
        .error.code
    ).toBe("AUTH_001");
  });
});

describe("enregistrer une recette importee", () => {
  it("cree la revision 1 de source IMPORT", async () => {
    const m = await member();
    const res = await m.client.post(`/spaces/${m.space.id}/recipes`, {
      ...(await recipeBody(m.client)),
      imported: true,
    });
    expect(res.status).toBe(201);
    const revision = await db.recipeRevision.findFirstOrThrow({ where: { recipeId: res.body.id } });
    expect(revision.source).toBe("IMPORT");
  });
});

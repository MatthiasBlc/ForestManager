import { API_PREFIX, idParamsSchema, spaceSummarySchema } from "@fm/shared";
import { NOT_FOUND_UUID } from "@fm/test-utils";
import express from "express";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { errorHandler } from "../src/core/http/errors.ts";
import { httpLogger } from "../src/core/http/logger.ts";
import { createRateLimiter, CSRF_COOKIE, CSRF_HEADER } from "../src/core/http/security.ts";
import { handle, reply } from "../src/core/http/validate.ts";
import { createClient, createTestApp } from "./helpers/app.ts";
import { testEnv } from "./helpers/db.ts";

const app = createTestApp();

describe("socle HTTP", () => {
  it("GET /health repond sans cookie", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /api/v1/config expose features.email selon SMTP_URL", async () => {
    const off = await request(app).get(`${API_PREFIX}/config`);
    expect(off.body).toEqual({ features: { email: false, uploads: true } });
    const withSmtp = createTestApp({ env: { ...testEnv, SMTP_URL: "smtp://mail:25" } });
    const on = await request(withSmtp).get(`${API_PREFIX}/config`);
    expect(on.body).toEqual({ features: { email: true, uploads: true } });
  });

  it("route inconnue : COMMON_003 au format unique", async () => {
    const res = await request(app).get(`${API_PREFIX}/nope`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "COMMON_003", message: expect.any(String) } });
  });

  it("pose les en-tetes de securite et l'identifiant de requete", async () => {
    const res = await request(app).get(`${API_PREFIX}/config`).set("X-Request-Id", "abc12345-req");
    expect(res.headers["x-request-id"]).toBe("abc12345-req");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    const generated = await request(app).get("/health").set("X-Request-Id", "bad id!");
    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("CSRF", () => {
  it("refuse une requete mutante sans cookie", async () => {
    const res = await request(app).post(`${API_PREFIX}/config`).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("COMMON_002");
  });

  it("refuse un en-tete absent ou different du cookie", async () => {
    const client = await createClient(app);
    const missing = await client.agent.post(`${API_PREFIX}/config`).send({});
    expect(missing.body.error.code).toBe("COMMON_002");
    const wrong = await client.agent.post(`${API_PREFIX}/config`).set(CSRF_HEADER, "x.y").send({});
    expect(wrong.body.error.code).toBe("COMMON_002");
  });

  it("refuse un cookie forge non signe, meme recopie dans l'en-tete", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/config`)
      .set("Cookie", `${CSRF_COOKIE}=forged.token`)
      .set(CSRF_HEADER, "forged.token")
      .send({});
    expect(res.status).toBe(403);
  });

  it("laisse passer un jeton valide (puis 404 sur la route inconnue)", async () => {
    const client = await createClient(app);
    const res = await client.post("/config", {});
    expect(res.status).toBe(404);
  });
});

describe("corps JSON", () => {
  it("JSON invalide : VALIDATION_001", async () => {
    const client = await createClient(app);
    const res = await client.agent
      .post(`${API_PREFIX}/anything`)
      .set(CSRF_HEADER, client.csrf)
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_001");
  });

  it("corps trop gros : COMMON_005", async () => {
    const client = await createClient(app);
    const res = await client.post("/anything", { blob: "x".repeat(60_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("COMMON_005");
  });
});

describe("handle et reply", () => {
  const mini = express();
  mini.locals.validateResponses = true;
  mini.use(httpLogger(pino({ level: "silent" })));
  mini.use(express.json());
  mini.get(
    "/items/:id",
    handle(
      { params: idParamsSchema, query: z.strictObject({ full: z.enum(["1"]).optional() }) },
      ({ params, query }, _req, res) => {
        res.json({ id: params.id, full: query.full === "1" });
      }
    )
  );
  mini.post(
    "/items",
    handle({ body: z.strictObject({ name: z.string().min(2) }) }, ({ body }, _req, res) => {
      res.status(201).json(body);
    })
  );
  mini.get("/broken", (_req, res) => {
    reply(res, spaceSummarySchema, { id: "nope" } as never);
  });
  mini.use(errorHandler);

  it("passe les entrees validees et typees", async () => {
    const res = await request(mini).get(`/items/${NOT_FOUND_UUID}?full=1`);
    expect(res.body).toEqual({ id: NOT_FOUND_UUID, full: true });
  });

  it("refuse un UUID invalide, une query inconnue, un champ inconnu", async () => {
    const badId = await request(mini).get("/items/123");
    expect(badId.status).toBe(400);
    expect(badId.body.error.details[0]).toMatchObject({ location: "params", path: "id" });
    const badQuery = await request(mini).get(`/items/${NOT_FOUND_UUID}?other=1`);
    expect(badQuery.body.error.details[0]).toMatchObject({ location: "query" });
    const extra = await request(mini).post("/items").send({ name: "ok", role: "OWNER" });
    expect(extra.status).toBe(400);
    const missing = await request(mini).post("/items");
    expect(missing.body.error.details[0]).toMatchObject({ location: "body", path: "name" });
  });

  it("une reponse hors schema est une erreur serveur (COMMON_001)", async () => {
    const res = await request(mini).get("/broken");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("COMMON_001");
  });
});

describe("limitation de debit", () => {
  it("repond au format unique une fois la limite atteinte", async () => {
    const limited = express();
    limited.get(
      "/",
      createRateLimiter(true, { windowMs: 60_000, limit: 2, code: "AUTH_006" }),
      (_req, res) => {
        res.json({ ok: true });
      }
    );
    await request(limited).get("/");
    await request(limited).get("/");
    const res = await request(limited).get("/");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("AUTH_006");
  });
});

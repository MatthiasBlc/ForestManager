// Suivi d'erreurs, C7.5 [D75, D179, D196] : SDK Sentry cote API, tunnel du
// navigateur, test depuis A13. Un faux recepteur local remplace Bugsink : aucun
// appel a Internet.
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { API_PREFIX } from "@fm/shared";
import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadEnv, type Env } from "../src/core/config/env.ts";
import { createErrorTracking } from "../src/core/monitoring/error-tracking.ts";
import { hooksFrom } from "../src/core/modules/registry.ts";
import { MODULES } from "../src/modules/index.ts";
import { createAdmin, loginAdmin } from "./helpers/admin.ts";
import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { testEnv } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";

interface Received {
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

const PUBLIC_KEY = "c0ffee0123456789c0ffee0123456789";
let receiver: Server;
let received: Received[] = [];
let answer = 200;
let dsn = "";
let env: Env;

beforeAll(async () => {
  receiver = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        url: req.url ?? "",
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      res.writeHead(answer, { "content-type": "application/json" }).end("{}");
    });
  });
  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  const { port } = receiver.address() as AddressInfo;
  dsn = `http://${PUBLIC_KEY}@127.0.0.1:${String(port)}/7`;
  env = { ...testEnv, SENTRY_DSN: dsn, SENTRY_ENVIRONMENT: "preprod" };
});

afterAll(async () => {
  await new Promise((resolve) => receiver.close(resolve));
});

beforeEach(() => {
  received = [];
  answer = 200;
});

/** Lignes JSON d'une enveloppe : en-tete, puis paires en-tete d'item / item. */
function lines(envelope: string): Record<string, unknown>[] {
  return envelope
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function trackedApp(overrides: Parameters<typeof createTestApp>[0] = {}) {
  const errorTracking = createErrorTracking(env);
  if (!errorTracking) throw new Error("error tracking expected");
  return { errorTracking, app: createTestApp({ env, errorTracking, ...overrides }) };
}

describe("configuration publique", () => {
  it("annonce le suivi seulement avec un DSN, sans jamais le reveler", async () => {
    const off = await request(createTestApp()).get(`${API_PREFIX}/config`);
    expect(off.body.features.errorTracking).toBe(false);

    const on = await request(trackedApp().app).get(`${API_PREFIX}/config`);
    expect(on.body.features.errorTracking).toBe(true);
    expect(on.body.environment).toBe("preprod");
    expect(on.body.release).toEqual(expect.any(String));
    expect(JSON.stringify(on.body)).not.toContain(PUBLIC_KEY);
  });

  it("un DSN vide (secret absent du deploy) coupe le suivi", () => {
    const env = loadEnv({ ...process.env, SENTRY_DSN: "" });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(createErrorTracking(env)).toBeNull();
  });

  it("un DSN illisible arrete le demarrage", () => {
    expect(() => createErrorTracking({ ...testEnv, SENTRY_DSN: "http://127.0.0.1/7" })).toThrow();
  });
});

describe("erreurs de l'API", () => {
  it("une erreur 5xx part au recepteur, sans donnee personnelle", async () => {
    const owner = await createUser();
    const member = await createUser();
    const space = await createSpace(owner.id);
    await addMember(space.id, member.id);
    const hooks = hooksFrom(MODULES);
    hooks.onMemberLeft.push(() => Promise.reject(new Error("hook exploded")));
    const { app, errorTracking } = trackedApp({ hooks });
    const client = await loginAs(member, app);

    const res = await client
      .post(`/spaces/${space.id}/leave`, {})
      .set("Cookie", "secret=should-not-leak");
    expect(res.status).toBe(500);
    await errorTracking.flush(2000);

    expect(received).toHaveLength(1);
    const first = received[0];
    if (!first) throw new Error("no envelope");
    expect(first.url).toContain("/api/7/envelope/");
    expect(first.url).toContain(`sentry_key=${PUBLIC_KEY}`);
    const event = lines(first.body).find((line) => "exception" in line);
    expect(event).toMatchObject({
      level: "error",
      environment: "preprod",
      release: expect.any(String),
      user: { id: member.id },
      exception: { values: [{ type: "Error", value: "hook exploded" }] },
    });
    expect(event?.request).toBeUndefined();
    expect(first.body).not.toContain("should-not-leak");
    expect(first.body).not.toContain(member.email);
    expect(first.body).not.toContain("ip_address");
  });

  it("une erreur metier (4xx) ne part pas", async () => {
    const { app, errorTracking } = trackedApp();
    const res = await request(app).get(`${API_PREFIX}/does-not-exist`);
    expect(res.status).toBe(404);
    await errorTracking.flush(2000);
    expect(received).toHaveLength(0);
  });

  it("une erreur hors session part sans utilisateur", async () => {
    const boom = () => {
      const router = Router();
      router.get("/boom", () => {
        throw new Error("no session here");
      });
      return router;
    };
    const { app, errorTracking } = trackedApp({ testRoutes: boom });
    expect((await request(app).get(`${API_PREFIX}/__test/boom`)).status).toBe(500);
    await errorTracking.flush(2000);
    const event = lines(received[0]?.body ?? "").find((line) => "exception" in line);
    expect(event?.user).toBeUndefined();
  });
});

describe("tunnel du navigateur (POST /monitoring)", () => {
  const browserEnvelope = (header: Record<string, unknown>) =>
    [
      JSON.stringify(header),
      JSON.stringify({ type: "event" }),
      JSON.stringify({ event_id: "a".repeat(32), message: "from the browser" }),
      "",
    ].join("\n");

  it("absent sans DSN", async () => {
    const res = await request(createTestApp())
      .post(`${API_PREFIX}/monitoring`)
      .set("Content-Type", "text/plain;charset=UTF-8")
      .send(browserEnvelope({ dsn: "https://forest@monitoring.invalid/1" }));
    expect(res.status).toBe(404);
  });

  it("relaie l'enveloppe vers le vrai DSN, sans CSRF ni en-tete du navigateur", async () => {
    const res = await request(trackedApp().app)
      .post(`${API_PREFIX}/monitoring`)
      .set("Content-Type", "text/plain;charset=UTF-8")
      .set("Cookie", "fm.sid=browser-session")
      .set("X-Forwarded-For", "203.0.113.9")
      .send(browserEnvelope({ dsn: "https://forest@monitoring.invalid/1", sent_at: "now" }));
    expect(res.status).toBe(202);

    expect(received).toHaveLength(1);
    const first = received[0];
    if (!first) throw new Error("no envelope");
    expect(first.url).toContain("/api/7/envelope/");
    expect(first.url).toContain(`sentry_key=${PUBLIC_KEY}`);
    const [header, itemHeader, item] = lines(first.body);
    expect(header).toEqual({ dsn, sent_at: "now" });
    expect(itemHeader).toEqual({ type: "event" });
    expect(item).toMatchObject({ message: "from the browser" });
    expect(first.headers.cookie).toBeUndefined();
    expect(first.headers["x-forwarded-for"]).toBeUndefined();
    expect(first.body).not.toContain("203.0.113.9");
  });

  it("refuse un corps illisible ou trop gros", async () => {
    const { app } = trackedApp();
    const unreadable = await request(app)
      .post(`${API_PREFIX}/monitoring`)
      .set("Content-Type", "text/plain")
      .send("not an envelope");
    expect(unreadable.status).toBe(400);
    expect(unreadable.body.error.code).toBe("VALIDATION_001");

    const huge = await request(app)
      .post(`${API_PREFIX}/monitoring`)
      .set("Content-Type", "text/plain")
      .send(browserEnvelope({ dsn: "x" }) + "x".repeat(300_000));
    expect(huge.status).toBe(413);
    expect(received).toHaveLength(0);
  });

  it("un recepteur en panne ne remonte pas d'erreur au navigateur", async () => {
    answer = 503;
    const res = await request(trackedApp().app)
      .post(`${API_PREFIX}/monitoring`)
      .set("Content-Type", "text/plain")
      .send(browserEnvelope({}));
    expect(res.status).toBe(202);
    expect(received).toHaveLength(1);
  });
});

describe("A13 et tableau de bord", () => {
  it("affichent l'etat reel et testent l'envoi", async () => {
    const { app } = trackedApp();
    const admin = await createAdmin();
    const client = await loginAdmin(admin, app);

    const settings = await client.get("/admin/settings");
    const { port } = receiver.address() as AddressInfo;
    expect(settings.body.errorTracking).toEqual({
      configured: true,
      host: `127.0.0.1:${String(port)}`,
      environment: "preprod",
    });
    expect(JSON.stringify(settings.body)).not.toContain(PUBLIC_KEY);

    const dashboard = await client.get("/admin/dashboard");
    expect(dashboard.body.services.errorTracking).toBe(true);

    const accepted = await client.post("/admin/settings/test/errorTracking");
    expect(accepted.status).toBe(200);
    expect(accepted.body.ok).toBe(true);
    expect(accepted.body.message).toContain(`127.0.0.1:${String(port)}`);
    const event = lines(received[0]?.body ?? "").find((line) => "message" in line);
    expect(event).toMatchObject({ level: "info", environment: "preprod" });

    answer = 403;
    const refused = await client.post("/admin/settings/test/errorTracking");
    expect(refused.body.ok).toBe(false);
    expect(refused.body.message).toContain("403");
  });

  it("sans DSN : non configure, le test le dit", async () => {
    const app = createTestApp();
    const admin = await createAdmin();
    const client = await loginAdmin(admin, app);
    const settings = await client.get("/admin/settings");
    expect(settings.body.errorTracking).toEqual({
      configured: false,
      host: null,
      environment: null,
    });
    const res = await client.post("/admin/settings/test/errorTracking");
    expect(res.body).toMatchObject({ ok: false });
    expect(res.body.message).toContain("SENTRY_DSN");
    const anonymous = await createClient(app);
    expect((await anonymous.post("/admin/settings/test/errorTracking")).status).toBe(401);
  });
});

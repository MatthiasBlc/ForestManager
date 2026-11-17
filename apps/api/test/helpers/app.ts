// App de test et client HTTP qui gere le cookie de session et le jeton CSRF.
import { API_PREFIX } from "@fm/shared";
import { pino } from "pino";
import request from "supertest";

import { createApp, type AppDeps } from "../../src/core/http/app.ts";
import type { MailMessage, Mailer } from "../../src/core/mail/mailer.ts";
import { CSRF_COOKIE, CSRF_HEADER } from "../../src/core/http/security.ts";
import { MODULES } from "../../src/modules/index.ts";
import { db, testEnv } from "./db.ts";

export function createTestApp(overrides: Partial<AppDeps> = {}) {
  return createApp({
    env: testEnv,
    db,
    logger: pino({ level: "silent" }),
    rateLimit: false,
    modules: MODULES,
    ...overrides,
  });
}

function csrfFrom(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const [name, value] = (pair ?? "").split("=");
    if (name === CSRF_COOKIE && value) return decodeURIComponent(value);
  }
  throw new Error("CSRF cookie missing");
}

export type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Navigateur simule : garde ses cookies, envoie le jeton CSRF sur les requetes
 * mutantes. Les chemins sont relatifs a /api/v1.
 */
export async function createClient(app = createTestApp()) {
  const agent = request.agent(app);
  const first = await agent.get(`${API_PREFIX}/config`);
  const csrf = csrfFrom(first.headers["set-cookie"]);
  const url = (path: string) => `${API_PREFIX}${path}`;
  return {
    agent,
    csrf,
    get: (path: string) => agent.get(url(path)),
    post: (path: string, body?: object) => agent.post(url(path)).set(CSRF_HEADER, csrf).send(body),
    patch: (path: string, body?: object) =>
      agent.patch(url(path)).set(CSRF_HEADER, csrf).send(body),
    put: (path: string, body?: object) => agent.put(url(path)).set(CSRF_HEADER, csrf).send(body),
    delete: (path: string, body?: object) =>
      agent.delete(url(path)).set(CSRF_HEADER, csrf).send(body),
  };
}

/** Client deja connecte avec ce compte (mot de passe de test). */
export async function loginAs(user: { username: string; password: string }, app = createTestApp()) {
  const client = await createClient(app);
  const res = await client.post("/auth/login", {
    identifier: user.username,
    password: user.password,
  });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return client;
}

/** Faux transport : garde les emails envoyes pour les tests. */
export function fakeMailer(): Mailer & { sent: MailMessage[]; lastToken: () => string } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send: (message) => {
      sent.push(message);
      return Promise.resolve();
    },
    lastToken: () => {
      const match = /token=([A-Za-z0-9_-]+)/.exec(sent.at(-1)?.text ?? "");
      if (!match?.[1]) throw new Error("no token in last mail");
      return match[1];
    },
  };
}

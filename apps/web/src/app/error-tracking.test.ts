// Suivi d'erreurs du navigateur, C7.5 [D196] : SDK charge a la demande, seulement
// si l'API annonce le suivi ; envoi par le tunnel de l'API, sans le vrai DSN ;
// l'utilisateur n'est qu'un UUID.
import { errorBody } from "@fm/shared";
import type { ErrorEvent } from "@sentry/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { meQuery } from "../core/session/queries.ts";
import { createQueryClient } from "../lib/query.ts";
import { buildConfig, buildMe } from "../test/fixtures.ts";
import { server } from "../test/server.ts";
import { startErrorTracking, type SentryApi } from "./error-tracking.ts";

function fakeSentry() {
  return { init: vi.fn<SentryApi["init"]>(), setUser: vi.fn<SentryApi["setUser"]>() };
}

function serveConfig(errorTracking: boolean) {
  server.use(http.get("/api/v1/config", () => HttpResponse.json(buildConfig({ errorTracking }))));
}

describe("startErrorTracking", () => {
  it("ne charge rien quand le suivi est coupe", async () => {
    serveConfig(false);
    const load = vi.fn(() => Promise.resolve(fakeSentry()));
    await expect(startErrorTracking(createQueryClient(), load)).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("ne casse rien si la configuration est illisible", async () => {
    server.use(
      http.get("/api/v1/config", () => HttpResponse.json(errorBody("COMMON_001"), { status: 500 }))
    );
    const load = vi.fn(() => Promise.resolve(fakeSentry()));
    await expect(startErrorTracking(createQueryClient(), load)).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("envoie par le tunnel de l'API, avec la version et l'environnement", async () => {
    serveConfig(true);
    const sentry = fakeSentry();
    await expect(
      startErrorTracking(createQueryClient(), () => Promise.resolve(sentry))
    ).resolves.toBe(true);
    expect(sentry.init).toHaveBeenCalledOnce();
    const options = sentry.init.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      tunnel: "/api/v1/monitoring",
      release: "2.0.0",
      environment: "test",
      dataCollection: expect.objectContaining({ userInfo: false, cookies: false }),
    });
    // DSN factice : le tunnel le remplace par le vrai.
    expect(options?.dsn).toContain(".invalid");
  });

  it("ne garde que l'UUID de l'utilisateur, suit la connexion et la deconnexion", async () => {
    serveConfig(true);
    const sentry = fakeSentry();
    const client = createQueryClient();
    await startErrorTracking(client, () => Promise.resolve(sentry));
    expect(sentry.setUser).toHaveBeenLastCalledWith(null);

    const me = buildMe();
    client.setQueryData(meQuery.queryKey, me);
    expect(sentry.setUser).toHaveBeenLastCalledWith({ id: me.id });
    client.setQueryData(meQuery.queryKey, null);
    expect(sentry.setUser).toHaveBeenLastCalledWith(null);

    const beforeSend = sentry.init.mock.calls[0]?.[0]?.beforeSend;
    if (!beforeSend) throw new Error("beforeSend expected");
    const event = {
      type: undefined,
      user: { id: me.id, email: me.email, ip_address: "203.0.113.9" },
      request: { url: "https://app/recipes", cookies: { sid: "x" }, headers: { Cookie: "sid=x" } },
    } as ErrorEvent;
    const scrubbed = (await beforeSend(event, {})) as ErrorEvent;
    expect(scrubbed.user).toEqual({ id: me.id });
    expect(scrubbed.request).toEqual({ url: "https://app/recipes" });
  });
});

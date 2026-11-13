import { appConfigSchema, errorBody } from "@fm/shared";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { server } from "../test/server.ts";
import { api, ApiRequestError } from "./api.ts";
import { buildConfig } from "../test/fixtures.ts";

describe("client API", () => {
  it("lit une reponse et la valide contre son schema", async () => {
    server.use(
      http.get("/api/v1/config", () =>
        HttpResponse.json(buildConfig({ email: true, uploads: true }))
      )
    );
    await expect(api.get("/config", appConfigSchema)).resolves.toEqual(
      buildConfig({ email: true, uploads: true })
    );
  });

  it("refuse une reponse qui ne respecte pas le contrat", async () => {
    server.use(http.get("/api/v1/config", () => HttpResponse.json({ features: {} })));
    await expect(api.get("/config", appConfigSchema)).rejects.toMatchObject({ code: "CONTRACT" });
  });

  it("envoie le jeton CSRF du cookie sur les requetes mutantes, en JSON, avec les cookies", async () => {
    document.cookie = "XSRF-TOKEN=jeton-test; path=/";
    let seen: { csrf: string | null; type: string | null; body: unknown } | undefined;
    server.use(
      http.post("/api/v1/spaces", async ({ request }) => {
        seen = {
          csrf: request.headers.get("x-xsrf-token"),
          type: request.headers.get("content-type"),
          body: await request.json(),
        };
        return HttpResponse.json({ ok: true }, { status: 201 });
      })
    );
    await api.post("/spaces", { name: "Famille" }, z.object({ ok: z.boolean() }));
    expect(seen).toEqual({
      csrf: "jeton-test",
      type: "application/json",
      body: { name: "Famille" },
    });
  });

  it("demande un jeton CSRF a /config s'il n'y a pas encore de cookie", async () => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    const calls: string[] = [];
    server.use(
      http.get("/api/v1/config", () => {
        calls.push("config");
        document.cookie = "XSRF-TOKEN=neuf; path=/";
        return HttpResponse.json(buildConfig({ email: false, uploads: false }));
      }),
      http.post("/api/v1/auth/logout", ({ request }) => {
        calls.push(`logout:${request.headers.get("x-xsrf-token") ?? ""}`);
        return new HttpResponse(null, { status: 204 });
      })
    );
    await expect(api.post("/auth/logout")).resolves.toBeUndefined();
    expect(calls).toEqual(["config", "logout:neuf"]);
  });

  it("transforme une erreur de l'API en ApiRequestError avec son code", async () => {
    server.use(
      http.get("/api/v1/spaces/x", () => HttpResponse.json(errorBody("SPACE_001"), { status: 404 }))
    );
    const error = await api.get("/spaces/x", z.unknown()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: "SPACE_001", status: 404, message: "Espace introuvable." });
  });

  it("signale une coupure reseau", async () => {
    server.use(http.get("/api/v1/me", () => HttpResponse.error()));
    await expect(api.get("/me", z.unknown())).rejects.toMatchObject({ code: "NETWORK", status: 0 });
  });
});

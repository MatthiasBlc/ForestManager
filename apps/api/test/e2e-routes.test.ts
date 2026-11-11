// Routes reservees aux E2E [D79, D197] : presentes en NODE_ENV=test seulement.
import { API_PREFIX } from "@fm/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { CSRF_COOKIE, CSRF_HEADER } from "../src/core/http/security.ts";
import { adminLogin, totpFor } from "./helpers/admin.ts";
import { createClient, createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { e2eRoutes } from "./e2e/routes.ts";

const app = createTestApp({ testRoutes: e2eRoutes });
const url = (path: string) => `${API_PREFIX}/__test${path}`;

describe("routes de test des E2E", () => {
  it("scenario user : un compte utilisable, sans jeton CSRF", async () => {
    const res = await request(app).post(url("/scenario")).send({ name: "user" });
    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      username: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
      personalSpaceId: expect.any(String),
    });
    const client = await loginAs(res.body.user, app);
    const me = await client.get("/me");
    expect(me.status).toBe(200);
    expect(me.body.personalSpaceId).toBe(res.body.user.personalSpaceId);
  });

  it("scenario group : un espace, son OWNER et un membre par role demande", async () => {
    const res = await request(app)
      .post(url("/scenario"))
      .send({ name: "group", members: ["MODERATOR", "MEMBER"] });
    expect(res.status).toBe(201);
    expect(res.body.members).toHaveLength(2);
    const memberships = await db.membership.findMany({ where: { spaceId: res.body.space.id } });
    expect(memberships.map((m) => m.role).sort()).toEqual(["MEMBER", "MODERATOR", "OWNER"]);
    const client = await loginAs(res.body.members[1], app);
    const space = await client.get(`/spaces/${res.body.space.id}`);
    expect(space.status).toBe(200);
    expect(space.body.name).toBe(res.body.space.name);
  });

  it("scenario admin : un super admin dont la 2FA est deja configuree", async () => {
    const res = await request(app).post(url("/scenario")).send({ name: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.admin).toEqual({
      id: expect.any(String),
      username: expect.any(String),
      password: expect.any(String),
      totpSecret: expect.any(String),
    });
    const client = await createClient(app);
    expect((await adminLogin(client, res.body.admin)).status).toBe(200);
    const totp = await client.post("/admin/auth/totp", { code: totpFor(res.body.admin) });
    expect(totp.status).toBe(200);
  });

  it("scenario inconnu : VALIDATION_001", async () => {
    const res = await request(app).post(url("/scenario")).send({ name: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_001");
  });

  it("reset : base videe, referentiels gardes", async () => {
    await request(app).post(url("/scenario")).send({ name: "user" });
    expect(await db.user.count()).toBeGreaterThan(0);
    const res = await request(app).post(url("/reset"));
    expect(res.status).toBe(204);
    expect(await db.user.count()).toBe(0);
    expect(await db.unit.count()).toBeGreaterThan(0);
    expect(await db.module.count()).toBeGreaterThan(0);
  });

  it("absentes en production et en developpement, meme si elles sont fournies", async () => {
    const { csrf } = await createClient(app);
    for (const NODE_ENV of ["production", "development"] as const) {
      const other = createTestApp({
        env: { ...testEnv, NODE_ENV },
        testRoutes: e2eRoutes,
      });
      // Jeton CSRF valable pose a la main : en production le cookie est `Secure`,
      // l'agent HTTP des tests ne le renverrait pas.
      for (const path of ["/scenario", "/reset"]) {
        const res = await request(other)
          .post(url(path))
          .set("Cookie", `${CSRF_COOKIE}=${csrf}`)
          .set(CSRF_HEADER, csrf)
          .send({ name: "user" });
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("COMMON_003");
      }
    }
    expect(await db.user.count()).toBe(0);
  });

  it("absentes sans injection (le serveur ne les charge qu'en test)", async () => {
    const client = await createClient(createTestApp());
    expect((await client.post("/__test/reset")).status).toBe(404);
  });
});

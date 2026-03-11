import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { createTestUser, extractSessionCookie } from "../setup/testHelpers";

describe("Recipe Import API", () => {
  let sessionCookie: string | null;

  beforeEach(async () => {
    const testUser = await createTestUser();
    const loginRes = await request(app).post("/api/auth/login").send({
      username: testUser.username,
      password: testUser.password,
    });
    sessionCookie = extractSessionCookie(loginRes);
  });

  // =====================================
  // POST /api/recipes/import-url
  // =====================================
  describe("POST /api/recipes/import-url", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/recipes/import-url")
        .send({ url: "https://example.com/recipe" });

      expect(res.status).toBe(401);
    });

    it("should return 400 when url is missing", async () => {
      const res = await request(app)
        .post("/api/recipes/import-url")
        .set("Cookie", sessionCookie!)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("IMPORT_001");
    });

    it("should return 400 when url is not a string", async () => {
      const res = await request(app)
        .post("/api/recipes/import-url")
        .set("Cookie", sessionCookie!)
        .send({ url: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("IMPORT_001");
    });

    it("should return 400 for invalid URL format", async () => {
      const res = await request(app)
        .post("/api/recipes/import-url")
        .set("Cookie", sessionCookie!)
        .send({ url: "not-a-url" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("IMPORT_001");
    });

    it("should return 400 for SSRF attempt (localhost)", async () => {
      const res = await request(app)
        .post("/api/recipes/import-url")
        .set("Cookie", sessionCookie!)
        .send({ url: "http://localhost:3000/secret" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("IMPORT_001");
    });

    it("should return 400 for SSRF attempt (private IP)", async () => {
      const res = await request(app)
        .post("/api/recipes/import-url")
        .set("Cookie", sessionCookie!)
        .send({ url: "http://192.168.1.1/admin" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("IMPORT_001");
    });
  });
});

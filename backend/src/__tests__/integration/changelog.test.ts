import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import {
  createTestUser,
  createTestChangelogEntry,
  extractSessionCookie,
} from "../setup/testHelpers";

const NOT_FOUND_UUID = "00000000-0000-4000-8000-000000000000";

describe("Changelog API (User)", () => {
  let userCookie: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const loginRes = await request(app).post("/api/auth/login").send({
      username: user.username,
      password: user.password,
    });
    userCookie = extractSessionCookie(loginRes)!;
  });

  // =====================================
  // GET /api/changelog
  // =====================================
  describe("GET /api/changelog", () => {
    it("should return paginated changelog entries", async () => {
      await createTestChangelogEntry({ version: `1.0.${Date.now() % 10000}` });
      await createTestChangelogEntry({ version: `1.1.${Date.now() % 10000}` });

      const res = await request(app).get("/api/changelog").set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it("should not return soft-deleted entries", async () => {
      const deleted = await createTestChangelogEntry({
        version: `9.0.${Date.now() % 10000}`,
        deletedAt: new Date(),
      });

      const res = await request(app).get("/api/changelog").set("Cookie", userCookie);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: { id: string }) => e.id);
      expect(ids).not.toContain(deleted.id);
    });

    it("should order by publishedAt descending", async () => {
      const old = await createTestChangelogEntry({
        version: `0.1.${Date.now() % 10000}`,
        publishedAt: new Date("2025-01-01"),
      });
      const recent = await createTestChangelogEntry({
        version: `0.2.${Date.now() % 10000}`,
        publishedAt: new Date("2026-01-01"),
      });

      const res = await request(app).get("/api/changelog").set("Cookie", userCookie);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: { id: string }) => e.id);
      const recentIdx = ids.indexOf(recent.id);
      const oldIdx = ids.indexOf(old.id);
      if (recentIdx !== -1 && oldIdx !== -1) {
        expect(recentIdx).toBeLessThan(oldIdx);
      }
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).get("/api/changelog");
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/changelog/:id
  // =====================================
  describe("GET /api/changelog/:id", () => {
    it("should return a single changelog entry", async () => {
      const entry = await createTestChangelogEntry({ version: `2.0.${Date.now() % 10000}` });

      const res = await request(app).get(`/api/changelog/${entry.id}`).set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(entry.id);
      expect(res.body.data.version).toBe(entry.version);
    });

    it("should return 404 for non-existent entry", async () => {
      const res = await request(app)
        .get(`/api/changelog/${NOT_FOUND_UUID}`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(404);
    });

    it("should return 404 for soft-deleted entry", async () => {
      const deleted = await createTestChangelogEntry({
        version: `3.0.${Date.now() % 10000}`,
        deletedAt: new Date(),
      });

      const res = await request(app).get(`/api/changelog/${deleted.id}`).set("Cookie", userCookie);

      expect(res.status).toBe(404);
    });
  });
});

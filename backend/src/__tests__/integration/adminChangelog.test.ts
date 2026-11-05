import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { createTestAdmin, createTestChangelogEntry, loginAsAdmin } from "../setup/testHelpers";

const VALID_CONTENT = {
  features: [{ text: "New feature" }],
  improvements: [{ text: "Improved something" }],
  fixes: [],
};

const NOT_FOUND_UUID = "00000000-0000-4000-8000-000000000000";

describe("Admin Changelog API", () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/changelog
  // =====================================
  describe("GET /api/admin/changelog", () => {
    it("should return paginated changelog entries", async () => {
      await createTestChangelogEntry({ version: `1.0.${Date.now() % 10000}` });
      await createTestChangelogEntry({ version: `1.1.${Date.now() % 10000}` });

      const res = await request(app).get("/api/admin/changelog").set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it("should exclude soft-deleted entries by default", async () => {
      const deleted = await createTestChangelogEntry({
        version: `9.9.${Date.now() % 10000}`,
        deletedAt: new Date(),
      });

      const res = await request(app).get("/api/admin/changelog").set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: { id: string }) => e.id);
      expect(ids).not.toContain(deleted.id);
    });

    it("should include soft-deleted entries when includeDeleted=true", async () => {
      const deleted = await createTestChangelogEntry({
        version: `8.8.${Date.now() % 10000}`,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .get("/api/admin/changelog?includeDeleted=true")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: { id: string }) => e.id);
      expect(ids).toContain(deleted.id);
    });

    it("should return 401 without admin authentication", async () => {
      const res = await request(app).get("/api/admin/changelog");
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/admin/changelog
  // =====================================
  describe("POST /api/admin/changelog", () => {
    it("should create a changelog entry", async () => {
      const version = `2.0.${Date.now() % 10000}`;

      const res = await request(app).post("/api/admin/changelog").set("Cookie", adminCookie).send({
        version,
        title: "Test release",
        content: VALID_CONTENT,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.version).toBe(version);
      expect(res.body.data.title).toBe("Test release");
      expect(res.body.data.content).toEqual(VALID_CONTENT);
    });

    it("should reject duplicate version (409)", async () => {
      const version = `3.0.${Date.now() % 10000}`;
      await createTestChangelogEntry({ version });

      const res = await request(app).post("/api/admin/changelog").set("Cookie", adminCookie).send({
        version,
        title: "Duplicate",
        content: VALID_CONTENT,
      });

      expect(res.status).toBe(409);
    });

    it("should reject invalid semver version", async () => {
      const res = await request(app).post("/api/admin/changelog").set("Cookie", adminCookie).send({
        version: "not-semver",
        title: "Bad version",
        content: VALID_CONTENT,
      });

      expect(res.status).toBe(400);
    });

    it("should reject empty content (no items in any category)", async () => {
      const res = await request(app)
        .post("/api/admin/changelog")
        .set("Cookie", adminCookie)
        .send({
          version: `4.0.${Date.now() % 10000}`,
          title: "Empty",
          content: { features: [], improvements: [], fixes: [] },
        });

      expect(res.status).toBe(400);
    });

    it("should reject missing title", async () => {
      const res = await request(app)
        .post("/api/admin/changelog")
        .set("Cookie", adminCookie)
        .send({
          version: `5.0.${Date.now() % 10000}`,
          content: VALID_CONTENT,
        });

      expect(res.status).toBe(400);
    });
  });

  // =====================================
  // PATCH /api/admin/changelog/:id
  // =====================================
  describe("PATCH /api/admin/changelog/:id", () => {
    it("should update title", async () => {
      const entry = await createTestChangelogEntry({ version: `6.0.${Date.now() % 10000}` });

      const res = await request(app)
        .patch(`/api/admin/changelog/${entry.id}`)
        .set("Cookie", adminCookie)
        .send({ title: "Updated title" });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Updated title");
    });

    it("should update version if not duplicate", async () => {
      const entry = await createTestChangelogEntry({ version: `7.0.${Date.now() % 10000}` });
      const newVersion = `7.1.${Date.now() % 10000}`;

      const res = await request(app)
        .patch(`/api/admin/changelog/${entry.id}`)
        .set("Cookie", adminCookie)
        .send({ version: newVersion });

      expect(res.status).toBe(200);
      expect(res.body.data.version).toBe(newVersion);
    });

    it("should reject version update if version already exists", async () => {
      const entry1 = await createTestChangelogEntry({ version: `10.0.${Date.now() % 10000}` });
      const entry2 = await createTestChangelogEntry({ version: `10.1.${Date.now() % 10000}` });

      const res = await request(app)
        .patch(`/api/admin/changelog/${entry2.id}`)
        .set("Cookie", adminCookie)
        .send({ version: entry1.version });

      expect(res.status).toBe(409);
    });

    it("should return 404 for non-existent entry", async () => {
      const res = await request(app)
        .patch(`/api/admin/changelog/${NOT_FOUND_UUID}`)
        .set("Cookie", adminCookie)
        .send({ title: "Nope" });

      expect(res.status).toBe(404);
    });

    it("should return 404 for soft-deleted entry", async () => {
      const deleted = await createTestChangelogEntry({
        version: `11.0.${Date.now() % 10000}`,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .patch(`/api/admin/changelog/${deleted.id}`)
        .set("Cookie", adminCookie)
        .send({ title: "Nope" });

      expect(res.status).toBe(404);
    });
  });

  // =====================================
  // DELETE /api/admin/changelog/:id
  // =====================================
  describe("DELETE /api/admin/changelog/:id", () => {
    it("should soft-delete a changelog entry", async () => {
      const entry = await createTestChangelogEntry({ version: `12.0.${Date.now() % 10000}` });

      const res = await request(app)
        .delete(`/api/admin/changelog/${entry.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);

      // Verify it's excluded from normal list
      const listRes = await request(app).get("/api/admin/changelog").set("Cookie", adminCookie);
      const ids = listRes.body.data.map((e: { id: string }) => e.id);
      expect(ids).not.toContain(entry.id);
    });

    it("should return 404 for non-existent entry", async () => {
      const res = await request(app)
        .delete(`/api/admin/changelog/${NOT_FOUND_UUID}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
    });

    it("should return 404 for already soft-deleted entry", async () => {
      const deleted = await createTestChangelogEntry({
        version: `13.0.${Date.now() % 10000}`,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete(`/api/admin/changelog/${deleted.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
    });
  });
});

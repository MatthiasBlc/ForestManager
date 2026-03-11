import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import { createTestUser, createTestRecipe, extractSessionCookie } from "../setup/testHelpers";

// Mock storageService (pas de MinIO en CI)
vi.mock("../../services/storageService", () => ({
  generatePresignedUploadUrl: vi.fn().mockResolvedValue("https://minio.test/presigned"),
  validateUploadedFile: vi.fn().mockResolvedValue(null), // valide par defaut
  deleteObject: vi.fn().mockResolvedValue(undefined),
  headObject: vi.fn().mockResolvedValue({ contentType: "image/webp", contentLength: 50000 }),
}));

import { validateUploadedFile } from "../../services/storageService";

const NOT_FOUND_UUID = "00000000-0000-4000-8000-000000000000";

describe("Recipe Image API", () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let ownerCookie: string | null;
  let otherUser: Awaited<ReturnType<typeof createTestUser>>;
  let otherCookie: string | null;
  let recipe: Awaited<ReturnType<typeof createTestRecipe>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    owner = await createTestUser();
    const ownerLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: owner.username, password: owner.password });
    ownerCookie = extractSessionCookie(ownerLogin);

    otherUser = await createTestUser();
    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: otherUser.username, password: otherUser.password });
    otherCookie = extractSessionCookie(otherLogin);

    recipe = await createTestRecipe(owner.id);
  });

  // =====================================
  // POST /api/recipes/:recipeId/upload-url
  // =====================================
  describe("POST /api/recipes/:recipeId/upload-url", () => {
    it("should return presigned URL for recipe owner", async () => {
      const res = await request(app)
        .post(`/api/recipes/${recipe.id}/upload-url`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(200);
      expect(res.body.uploadUrl).toBe("https://minio.test/presigned");
      expect(res.body.imageKey).toBe(`recipes/${recipe.id}/cover.webp`);
    });

    it("should return 403 for non-owner", async () => {
      const res = await request(app)
        .post(`/api/recipes/${recipe.id}/upload-url`)
        .set("Cookie", otherCookie!);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .post(`/api/recipes/${NOT_FOUND_UUID}/upload-url`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).post(`/api/recipes/${recipe.id}/upload-url`);

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/recipes/:recipeId/confirm-upload
  // =====================================
  describe("POST /api/recipes/:recipeId/confirm-upload", () => {
    it("should confirm upload and save imageKey", async () => {
      const res = await request(app)
        .post(`/api/recipes/${recipe.id}/confirm-upload`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(200);
      expect(res.body.imageKey).toBe(`recipes/${recipe.id}/cover.webp`);
      expect(res.body.imageUrl).toBeDefined();
    });

    it("should return 400 when file validation fails", async () => {
      vi.mocked(validateUploadedFile).mockResolvedValueOnce("File too large");

      const res = await request(app)
        .post(`/api/recipes/${recipe.id}/confirm-upload`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_005");
    });

    it("should return 403 for non-owner", async () => {
      const res = await request(app)
        .post(`/api/recipes/${recipe.id}/confirm-upload`)
        .set("Cookie", otherCookie!);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .post(`/api/recipes/${NOT_FOUND_UUID}/confirm-upload`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(404);
    });
  });

  // =====================================
  // DELETE /api/recipes/:recipeId/image
  // =====================================
  describe("DELETE /api/recipes/:recipeId/image", () => {
    it("should delete image and return 204", async () => {
      // D'abord confirmer un upload pour avoir un imageKey en DB
      await request(app)
        .post(`/api/recipes/${recipe.id}/confirm-upload`)
        .set("Cookie", ownerCookie!);

      const res = await request(app)
        .delete(`/api/recipes/${recipe.id}/image`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(204);
    });

    it("should return 204 even if no image exists (idempotent)", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipe.id}/image`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(204);
    });

    it("should return 403 for non-owner", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipe.id}/image`)
        .set("Cookie", otherCookie!);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${NOT_FOUND_UUID}/image`)
        .set("Cookie", ownerCookie!);

      expect(res.status).toBe(404);
    });
  });
});

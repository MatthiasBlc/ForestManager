import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import {
  createTestUser,
  createTestCommunity,
  extractSessionCookie,
} from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

// Mock storageService (pas de MinIO en CI)
vi.mock("../../services/storageService", () => ({
  generatePresignedUploadUrl: vi.fn().mockResolvedValue("https://minio.test/presigned"),
  validateUploadedFile: vi.fn().mockResolvedValue(null),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  headObject: vi.fn().mockResolvedValue({ contentType: "image/webp", contentLength: 50000 }),
}));

import { validateUploadedFile } from "../../services/storageService";

const NOT_FOUND_UUID = "00000000-0000-4000-8000-000000000000";

describe("Community Image API", () => {
  let moderator: Awaited<ReturnType<typeof createTestUser>>;
  let moderatorCookie: string | null;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let memberCookie: string | null;
  let nonMember: Awaited<ReturnType<typeof createTestUser>>;
  let nonMemberCookie: string | null;
  let community: Awaited<ReturnType<typeof createTestCommunity>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Moderateur (createur de la communaute)
    moderator = await createTestUser();
    const modLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: moderator.username, password: moderator.password });
    moderatorCookie = extractSessionCookie(modLogin);

    // Membre simple
    member = await createTestUser();
    const memLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: member.username, password: member.password });
    memberCookie = extractSessionCookie(memLogin);

    // Non-membre
    nonMember = await createTestUser();
    const nmLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: nonMember.username, password: nonMember.password });
    nonMemberCookie = extractSessionCookie(nmLogin);

    // Communaute avec moderateur
    community = await createTestCommunity(moderator.id);

    // Ajouter le membre simple
    await testPrisma.userCommunity.create({
      data: {
        userId: member.id,
        communityId: community.id,
        role: "MEMBER",
      },
    });
  });

  // =====================================
  // POST /api/communities/:communityId/upload-url
  // =====================================
  describe("POST /api/communities/:communityId/upload-url", () => {
    it("should return presigned URL for moderator", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/upload-url`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(200);
      expect(res.body.uploadUrl).toBe("https://minio.test/presigned");
      expect(res.body.imageKey).toBe(`communities/${community.id}/avatar.webp`);
    });

    it("should return 403 for simple member", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/upload-url`)
        .set("Cookie", memberCookie!);

      expect(res.status).toBe(403);
    });

    it("should return 403 for non-member", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/upload-url`)
        .set("Cookie", nonMemberCookie!);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent community", async () => {
      const res = await request(app)
        .post(`/api/communities/${NOT_FOUND_UUID}/upload-url`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/upload-url`);

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/communities/:communityId/confirm-upload
  // =====================================
  describe("POST /api/communities/:communityId/confirm-upload", () => {
    it("should confirm upload and save imageKey", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/confirm-upload`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(200);
      expect(res.body.imageKey).toBe(`communities/${community.id}/avatar.webp`);
      expect(res.body.imageUrl).toBeDefined();
    });

    it("should return 400 when file validation fails", async () => {
      vi.mocked(validateUploadedFile).mockResolvedValueOnce("Invalid file type");

      const res = await request(app)
        .post(`/api/communities/${community.id}/confirm-upload`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("COMMUNITY_006");
    });

    it("should return 403 for simple member", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/confirm-upload`)
        .set("Cookie", memberCookie!);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent community", async () => {
      const res = await request(app)
        .post(`/api/communities/${NOT_FOUND_UUID}/confirm-upload`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(404);
    });
  });

  // =====================================
  // DELETE /api/communities/:communityId/image
  // =====================================
  describe("DELETE /api/communities/:communityId/image", () => {
    it("should delete image and return 204", async () => {
      // Confirmer un upload d'abord
      await request(app)
        .post(`/api/communities/${community.id}/confirm-upload`)
        .set("Cookie", moderatorCookie!);

      const res = await request(app)
        .delete(`/api/communities/${community.id}/image`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(204);
    });

    it("should return 204 even if no image exists (idempotent)", async () => {
      const res = await request(app)
        .delete(`/api/communities/${community.id}/image`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(204);
    });

    it("should return 403 for simple member", async () => {
      const res = await request(app)
        .delete(`/api/communities/${community.id}/image`)
        .set("Cookie", memberCookie!);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent community", async () => {
      const res = await request(app)
        .delete(`/api/communities/${NOT_FOUND_UUID}/image`)
        .set("Cookie", moderatorCookie!);

      expect(res.status).toBe(404);
    });
  });
});

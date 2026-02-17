import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Community Tags API", () => {
  let _moderator: { id: string };
  let moderatorCookie: string;
  let member: { id: string };
  let memberCookie: string;
  let community: { id: string; name: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create moderator
    const modSignup = await request(app).post("/api/auth/signup").send({
      username: `ctmod_${suffix}`,
      email: `ctmod_${suffix}@example.com`,
      password: "Test123!Password",
    });
    moderatorCookie = extractSessionCookie(modSignup)!;
    _moderator = (await testPrisma.user.findFirst({
      where: { email: `ctmod_${suffix}@example.com` },
    }))!;

    // Create community (moderator becomes MODERATOR)
    const createRes = await request(app)
      .post("/api/communities")
      .set("Cookie", moderatorCookie)
      .send({ name: `Tags Community ${suffix}` });
    community = createRes.body;

    // Create member
    const memSignup = await request(app).post("/api/auth/signup").send({
      username: `ctmem_${suffix}`,
      email: `ctmem_${suffix}@example.com`,
      password: "Test123!Password",
    });
    memberCookie = extractSessionCookie(memSignup)!;
    member = (await testPrisma.user.findFirst({
      where: { email: `ctmem_${suffix}@example.com` },
    }))!;

    await testPrisma.userCommunity.create({
      data: { userId: member.id, communityId: community.id, role: "MEMBER" },
    });
  });

  // =====================================
  // GET /api/communities/:communityId/tags
  // =====================================
  describe("GET /api/communities/:communityId/tags", () => {
    it("should list community tags for moderator", async () => {
      // Creer des tags communaute
      await testPrisma.tag.create({
        data: { name: "approved_tag", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });
      await testPrisma.tag.create({
        data: { name: "pending_tag", scope: "COMMUNITY", status: "PENDING", communityId: community.id, createdById: member.id },
      });

      const res = await request(app)
        .get(`/api/communities/${community.id}/tags`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("should filter by status", async () => {
      await testPrisma.tag.create({
        data: { name: "approved_only", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });
      await testPrisma.tag.create({
        data: { name: "pending_only", scope: "COMMUNITY", status: "PENDING", communityId: community.id },
      });

      const res = await request(app)
        .get(`/api/communities/${community.id}/tags?status=PENDING`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("pending_only");
    });

    it("should filter by search", async () => {
      await testPrisma.tag.create({
        data: { name: "chocolate", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });
      await testPrisma.tag.create({
        data: { name: "vanilla", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      const res = await request(app)
        .get(`/api/communities/${community.id}/tags?search=choc`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("chocolate");
    });

    it("should return 403 for non-moderator member", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/tags`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // POST /api/communities/:communityId/tags
  // =====================================
  describe("POST /api/communities/:communityId/tags", () => {
    it("should create an APPROVED community tag", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/tags`)
        .set("Cookie", moderatorCookie)
        .send({ name: "New Tag" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("new tag");
      expect(res.body.scope).toBe("COMMUNITY");
      expect(res.body.status).toBe("APPROVED");
      expect(res.body.communityId).toBe(community.id);
    });

    it("should reject duplicate name in same community", async () => {
      await testPrisma.tag.create({
        data: { name: "existing", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags`)
        .set("Cookie", moderatorCookie)
        .send({ name: "Existing" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("TAG_002");
    });

    it("should reject name conflicting with global tag", async () => {
      await testPrisma.tag.create({
        data: { name: "global_conflict", scope: "GLOBAL", status: "APPROVED" },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags`)
        .set("Cookie", moderatorCookie)
        .send({ name: "global_conflict" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("TAG_002");
    });

    it("should reject empty name", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/tags`)
        .set("Cookie", moderatorCookie)
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_001");
    });

    it("should reject name shorter than 2 chars", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/tags`)
        .set("Cookie", moderatorCookie)
        .send({ name: "a" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_001");
    });

    it("should return 403 for non-moderator", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/tags`)
        .set("Cookie", memberCookie)
        .send({ name: "nope" });

      expect(res.status).toBe(403);
    });

    it("should create activity log entry", async () => {
      await request(app)
        .post(`/api/communities/${community.id}/tags`)
        .set("Cookie", moderatorCookie)
        .send({ name: "logged tag" });

      const log = await testPrisma.activityLog.findFirst({
        where: { type: "TAG_CREATED", communityId: community.id },
      });
      expect(log).not.toBeNull();
    });
  });

  // =====================================
  // PATCH /api/communities/:communityId/tags/:tagId
  // =====================================
  describe("PATCH /api/communities/:communityId/tags/:tagId", () => {
    it("should rename a community tag", async () => {
      const tag = await testPrisma.tag.create({
        data: { name: "oldname", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      const res = await request(app)
        .patch(`/api/communities/${community.id}/tags/${tag.id}`)
        .set("Cookie", moderatorCookie)
        .send({ name: "newname" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("newname");
    });

    it("should reject renaming to existing name", async () => {
      const tag1 = await testPrisma.tag.create({
        data: { name: "first_tag", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });
      await testPrisma.tag.create({
        data: { name: "second_tag", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      const res = await request(app)
        .patch(`/api/communities/${community.id}/tags/${tag1.id}`)
        .set("Cookie", moderatorCookie)
        .send({ name: "second_tag" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("TAG_002");
    });

    it("should reject modifying a tag from another community", async () => {
      // Creer une autre communaute
      const otherRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `Other ${uniqueSuffix()}` });
      const otherCommunity = otherRes.body;

      const otherTag = await testPrisma.tag.create({
        data: { name: "other_comm_tag", scope: "COMMUNITY", status: "APPROVED", communityId: otherCommunity.id },
      });

      const res = await request(app)
        .patch(`/api/communities/${community.id}/tags/${otherTag.id}`)
        .set("Cookie", moderatorCookie)
        .send({ name: "hijack" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("TAG_005");
    });

    it("should return 404 for non-existent tag", async () => {
      const res = await request(app)
        .patch(`/api/communities/${community.id}/tags/00000000-0000-0000-0000-000000000000`)
        .set("Cookie", moderatorCookie)
        .send({ name: "nope" });

      expect(res.status).toBe(404);
    });
  });

  // =====================================
  // DELETE /api/communities/:communityId/tags/:tagId
  // =====================================
  describe("DELETE /api/communities/:communityId/tags/:tagId", () => {
    it("should delete a community tag (hard delete + cascade RecipeTag)", async () => {
      const tag = await testPrisma.tag.create({
        data: { name: "to_delete", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      // Attacher a une recette
      const recipeRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", moderatorCookie)
        .send({ title: "R", content: "c" });
      const recipeId = recipeRes.body.community.id;

      await testPrisma.recipeTag.create({
        data: { recipeId, tagId: tag.id },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/tags/${tag.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);

      // Tag supprime
      const deleted = await testPrisma.tag.findUnique({ where: { id: tag.id } });
      expect(deleted).toBeNull();

      // RecipeTag cascade
      const rt = await testPrisma.recipeTag.findFirst({ where: { tagId: tag.id } });
      expect(rt).toBeNull();
    });

    it("should return 403 when deleting tag from another community", async () => {
      const otherRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `Other ${uniqueSuffix()}` });
      const otherTag = await testPrisma.tag.create({
        data: { name: "other_del", scope: "COMMUNITY", status: "APPROVED", communityId: otherRes.body.id },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/tags/${otherTag.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(403);
    });

    it("should return 403 for non-moderator", async () => {
      const tag = await testPrisma.tag.create({
        data: { name: "nodelete", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/tags/${tag.id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // POST /api/communities/:communityId/tags/:tagId/approve
  // =====================================
  describe("POST /:communityId/tags/:tagId/approve", () => {
    it("should approve a PENDING tag", async () => {
      const tag = await testPrisma.tag.create({
        data: {
          name: "pending_approve",
          scope: "COMMUNITY",
          status: "PENDING",
          communityId: community.id,
          createdById: member.id,
        },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/approve`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("APPROVED");
      expect(res.body.name).toBe("pending_approve");

      // Verifier en DB
      const updated = await testPrisma.tag.findUnique({ where: { id: tag.id } });
      expect(updated?.status).toBe("APPROVED");
    });

    it("should create activity log on approve", async () => {
      const tag = await testPrisma.tag.create({
        data: {
          name: "log_approve",
          scope: "COMMUNITY",
          status: "PENDING",
          communityId: community.id,
        },
      });

      await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/approve`)
        .set("Cookie", moderatorCookie);

      const log = await testPrisma.activityLog.findFirst({
        where: { type: "TAG_APPROVED", communityId: community.id },
      });
      expect(log).not.toBeNull();
    });

    it("should reject approving an already APPROVED tag", async () => {
      const tag = await testPrisma.tag.create({
        data: { name: "already_approved", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/approve`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_004");
    });

    it("should return 403 for non-moderator", async () => {
      const tag = await testPrisma.tag.create({
        data: { name: "noapprove", scope: "COMMUNITY", status: "PENDING", communityId: community.id },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/approve`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // POST /api/communities/:communityId/tags/:tagId/reject
  // =====================================
  describe("POST /:communityId/tags/:tagId/reject", () => {
    it("should reject a PENDING tag (hard delete + cascade)", async () => {
      const tag = await testPrisma.tag.create({
        data: {
          name: "pending_reject",
          scope: "COMMUNITY",
          status: "PENDING",
          communityId: community.id,
          createdById: member.id,
        },
      });

      // Attacher a une recette
      const recipeRes = await request(app)
        .post(`/api/communities/${community.id}/recipes`)
        .set("Cookie", moderatorCookie)
        .send({ title: "R", content: "c" });
      await testPrisma.recipeTag.create({
        data: { recipeId: recipeRes.body.community.id, tagId: tag.id },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/reject`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);

      // Tag hard deleted
      const deleted = await testPrisma.tag.findUnique({ where: { id: tag.id } });
      expect(deleted).toBeNull();

      // RecipeTag cascade deleted
      const rt = await testPrisma.recipeTag.findFirst({ where: { tagId: tag.id } });
      expect(rt).toBeNull();
    });

    it("should create activity log on reject", async () => {
      const tag = await testPrisma.tag.create({
        data: {
          name: "log_reject",
          scope: "COMMUNITY",
          status: "PENDING",
          communityId: community.id,
        },
      });

      await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/reject`)
        .set("Cookie", moderatorCookie);

      const log = await testPrisma.activityLog.findFirst({
        where: { type: "TAG_REJECTED", communityId: community.id },
      });
      expect(log).not.toBeNull();
    });

    it("should reject rejecting an APPROVED tag", async () => {
      const tag = await testPrisma.tag.create({
        data: { name: "no_reject_approved", scope: "COMMUNITY", status: "APPROVED", communityId: community.id },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/reject`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("TAG_004");
    });

    it("should return 403 for non-moderator", async () => {
      const tag = await testPrisma.tag.create({
        data: { name: "noreject", scope: "COMMUNITY", status: "PENDING", communityId: community.id },
      });

      const res = await request(app)
        .post(`/api/communities/${community.id}/tags/${tag.id}/reject`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
    });
  });
});

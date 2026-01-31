import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import {
  createTestUser,
  createTestCommunity,
  extractSessionCookie,
} from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

describe("Communities API", () => {
  // =====================================
  // POST /api/communities
  // =====================================
  describe("POST /api/communities", () => {
    let userCookie: string;

    beforeEach(async () => {
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: "communityuser",
        email: "community@example.com",
        password: "Test123!Password",
      });
      userCookie = extractSessionCookie(signupRes)!;
    });

    it("should create a new community with valid data", async () => {
      const res = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "Test Community",
          description: "A test community description",
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Test Community");
      expect(res.body.description).toBe("A test community description");
      expect(res.body.visibility).toBe("INVITE_ONLY");
    });

    it("should create a community without description", async () => {
      const res = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "No Description Community",
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("No Description Community");
      expect(res.body.description).toBeNull();
    });

    it("should add creator as MODERATOR", async () => {
      const res = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "Creator Test Community",
        });

      expect(res.status).toBe(201);

      // Check that creator is a member with MODERATOR role
      const membership = await testPrisma.userCommunity.findFirst({
        where: {
          communityId: res.body.id,
        },
      });

      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("MODERATOR");
    });

    it("should return 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 400 when name is too short", async () => {
      const res = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "AB",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("at least 3");
    });

    it("should return 400 when name is too long", async () => {
      const res = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "A".repeat(101),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("at most 100");
    });

    it("should return 400 when description is too long", async () => {
      const res = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "Valid Name",
          description: "A".repeat(1001),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("at most 1000");
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).post("/api/communities").send({
        name: "Test Community",
      });

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/communities
  // =====================================
  describe("GET /api/communities", () => {
    let user: Awaited<ReturnType<typeof createTestUser>>;
    let userCookie: string;

    beforeEach(async () => {
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: "listuser",
        email: "list@example.com",
        password: "Test123!Password",
      });
      userCookie = extractSessionCookie(signupRes)!;

      user = await testPrisma.user.findFirst({
        where: { email: "list@example.com" },
      }) as any;
    });

    it("should return empty list when user has no communities", async () => {
      const res = await request(app)
        .get("/api/communities")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("should return user's communities with role and counts", async () => {
      // Create a community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "My Community",
          description: "My community description",
        });

      const res = await request(app)
        .get("/api/communities")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(createRes.body.id);
      expect(res.body.data[0].name).toBe("My Community");
      expect(res.body.data[0].description).toBe("My community description");
      expect(res.body.data[0].role).toBe("MODERATOR");
      expect(res.body.data[0].membersCount).toBe(1);
      expect(res.body.data[0].recipesCount).toBe(0);
      expect(res.body.data[0].joinedAt).toBeDefined();
    });

    it("should not return deleted communities", async () => {
      // Create and then soft-delete a community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "To Delete" });

      await testPrisma.community.update({
        where: { id: createRes.body.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .get("/api/communities")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get("/api/communities");

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/communities/:communityId
  // =====================================
  describe("GET /api/communities/:communityId", () => {
    let user: Awaited<ReturnType<typeof createTestUser>>;
    let otherUser: Awaited<ReturnType<typeof createTestUser>>;
    let userCookie: string;
    let otherUserCookie: string;

    beforeEach(async () => {
      // Create two users
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: "detailuser",
        email: "detail@example.com",
        password: "Test123!Password",
      });
      userCookie = extractSessionCookie(signupRes)!;

      const signupRes2 = await request(app).post("/api/auth/signup").send({
        username: "otherdetailuser",
        email: "otherdetail@example.com",
        password: "Test123!Password",
      });
      otherUserCookie = extractSessionCookie(signupRes2)!;
    });

    it("should return community details for a member", async () => {
      // Create a community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({
          name: "Detail Community",
          description: "Community for detail tests",
        });

      const res = await request(app)
        .get(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.name).toBe("Detail Community");
      expect(res.body.description).toBe("Community for detail tests");
      expect(res.body.visibility).toBe("INVITE_ONLY");
      expect(res.body.membersCount).toBe(1);
      expect(res.body.recipesCount).toBe(0);
      expect(res.body.currentUserRole).toBe("MODERATOR");
    });

    it("should return 403 for non-member", async () => {
      // Create a community as first user
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Private Community" });

      // Try to access as second user
      const res = await request(app)
        .get(`/api/communities/${createRes.body.id}`)
        .set("Cookie", otherUserCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_001");
    });

    it("should return 404 for non-existent community", async () => {
      const res = await request(app)
        .get("/api/communities/00000000-0000-0000-0000-000000000000")
        .set("Cookie", userCookie);

      expect(res.status).toBe(404);
    });

    it("should return 404 for deleted community", async () => {
      // Create and delete a community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Deleted Community" });

      await testPrisma.community.update({
        where: { id: createRes.body.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .get(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(404);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get(
        "/api/communities/00000000-0000-0000-0000-000000000000"
      );

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // PATCH /api/communities/:communityId
  // =====================================
  describe("PATCH /api/communities/:communityId", () => {
    let userCookie: string;
    let memberCookie: string;

    beforeEach(async () => {
      // Create admin user
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: "updateadmin",
        email: "updateadmin@example.com",
        password: "Test123!Password",
      });
      userCookie = extractSessionCookie(signupRes)!;

      // Create member user
      const signupRes2 = await request(app).post("/api/auth/signup").send({
        username: "updatemember",
        email: "updatemember@example.com",
        password: "Test123!Password",
      });
      memberCookie = extractSessionCookie(signupRes2)!;
    });

    it("should update community name", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Original Name" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Name");
    });

    it("should update community description", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Test Community" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie)
        .send({ description: "New description" });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe("New description");
    });

    it("should update both name and description", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Original", description: "Original desc" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie)
        .send({ name: "Updated", description: "Updated desc" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated");
      expect(res.body.description).toBe("Updated desc");
    });

    it("should return 403 for non-MODERATOR member", async () => {
      // Create community as admin
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Admin Community" });

      // Add member user
      const member = await testPrisma.user.findFirst({
        where: { email: "updatemember@example.com" },
      });

      await testPrisma.userCommunity.create({
        data: {
          userId: member!.id,
          communityId: createRes.body.id,
          role: "MEMBER",
        },
      });

      // Try to update as member
      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", memberCookie)
        .send({ name: "Hacked Name" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_002");
    });

    it("should return 403 for non-member", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Private Community" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", memberCookie)
        .send({ name: "Hacked Name" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_001");
    });

    it("should return 400 when no fields provided", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Test Community" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 400 when name is too short", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Test Community" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie)
        .send({ name: "AB" });

      expect(res.status).toBe(400);
    });

    it("should return 400 when description is too long", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Test Community" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie)
        .send({ description: "A".repeat(1001) });

      expect(res.status).toBe(400);
    });

    it("should allow setting description to empty string (null)", async () => {
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", userCookie)
        .send({ name: "Test", description: "Some description" });

      const res = await request(app)
        .patch(`/api/communities/${createRes.body.id}`)
        .set("Cookie", userCookie)
        .send({ description: "" });

      expect(res.status).toBe(200);
      expect(res.body.description).toBeNull();
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .patch("/api/communities/00000000-0000-0000-0000-000000000000")
        .send({ name: "Test" });

      expect(res.status).toBe(401);
    });
  });
});

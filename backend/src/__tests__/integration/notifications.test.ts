import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Notifications API", () => {
  let user: { id: string };
  let userCookie: string;
  let actor: { id: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create user
    const userSignup = await request(app).post("/api/auth/signup").send({
      username: `nuser_${suffix}`,
      email: `nuser_${suffix}@example.com`,
      password: "Test123!Password",
    });
    userCookie = extractSessionCookie(userSignup)!;
    user = (await testPrisma.user.findFirst({
      where: { email: `nuser_${suffix}@example.com` },
    }))!;

    // Create actor (for notification source)
    const actorSignup = await request(app).post("/api/auth/signup").send({
      username: `nactor_${suffix}`,
      email: `nactor_${suffix}@example.com`,
      password: "Test123!Password",
    });
    extractSessionCookie(actorSignup);
    actor = (await testPrisma.user.findFirst({
      where: { email: `nactor_${suffix}@example.com` },
    }))!;
  });

  // Helper to create notifications directly in DB
  async function createNotif(overrides: Record<string, unknown> = {}) {
    return testPrisma.notification.create({
      data: {
        userId: user.id,
        type: "INVITE_SENT",
        category: "INVITATION",
        title: "Test notification",
        message: "Test message",
        actorId: actor.id,
        ...overrides,
      },
    });
  }

  // =====================================
  // GET /api/notifications
  // =====================================
  describe("GET /api/notifications", () => {
    it("should return empty list when no notifications", async () => {
      const res = await request(app)
        .get("/api/notifications")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
      expect(res.body.unreadCount).toBe(0);
    });

    it("should return notifications for the authenticated user", async () => {
      await createNotif();
      await createNotif({ type: "PROPOSAL_ACCEPTED", category: "RECIPE_PROPOSAL", title: "Proposal" });

      const res = await request(app)
        .get("/api/notifications")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.unreadCount).toBe(2);
    });

    it("should not return notifications belonging to other users", async () => {
      // Create notification for another user
      const otherUser = await testPrisma.user.create({
        data: { username: `other_${uniqueSuffix()}`, email: `other_${uniqueSuffix()}@example.com`, password: "h" },
      });
      await testPrisma.notification.create({
        data: {
          userId: otherUser.id,
          type: "INVITE_SENT",
          category: "INVITATION",
          title: "Other",
          message: "Other",
        },
      });

      const res = await request(app)
        .get("/api/notifications")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it("should paginate correctly", async () => {
      for (let i = 0; i < 5; i++) {
        await createNotif({ title: `Notif ${i}` });
      }

      const res = await request(app)
        .get("/api/notifications?page=1&limit=2")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(5);
      expect(res.body.pagination.totalPages).toBe(3);
      expect(res.body.pagination.page).toBe(1);
    });

    it("should filter by category", async () => {
      await createNotif({ category: "INVITATION", type: "INVITE_SENT" });
      await createNotif({ category: "RECIPE_PROPOSAL", type: "PROPOSAL_ACCEPTED" });

      const res = await request(app)
        .get("/api/notifications?category=INVITATION")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].category).toBe("INVITATION");
    });

    it("should filter unread only", async () => {
      await createNotif();
      await createNotif({ readAt: new Date() });

      const res = await request(app)
        .get("/api/notifications?unreadOnly=true")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].readAt).toBeNull();
    });

    it("should return 400 for invalid category", async () => {
      const res = await request(app)
        .get("/api/notifications?category=INVALID")
        .set("Cookie", userCookie);

      expect(res.status).toBe(400);
    });

    it("should include actor info in response", async () => {
      await createNotif();

      const res = await request(app)
        .get("/api/notifications")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data[0].actor).not.toBeNull();
      expect(res.body.data[0].actor.id).toBe(actor.id);
    });

    it("should group notifications with same groupKey within 60min", async () => {
      const community = await testPrisma.community.create({
        data: { name: `GrpComm ${uniqueSuffix()}` },
      });

      const now = new Date();
      const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000);

      await createNotif({
        type: "RECIPE_CREATED",
        category: "RECIPE_PROPOSAL",
        communityId: community.id,
        groupKey: `community:${community.id}:RECIPE_CREATED`,
        createdAt: now,
        message: "R1",
      });
      await createNotif({
        type: "RECIPE_CREATED",
        category: "RECIPE_PROPOSAL",
        communityId: community.id,
        groupKey: `community:${community.id}:RECIPE_CREATED`,
        createdAt: tenMinAgo,
        message: "R2",
      });
      await createNotif({
        type: "RECIPE_CREATED",
        category: "RECIPE_PROPOSAL",
        communityId: community.id,
        groupKey: `community:${community.id}:RECIPE_CREATED`,
        createdAt: twentyMinAgo,
        message: "R3",
      });

      const res = await request(app)
        .get("/api/notifications")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      // Should be grouped into 1 entry
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].group).not.toBeNull();
      expect(res.body.data[0].group.count).toBe(3);
      expect(res.body.data[0].group.items.length).toBe(3);
    });

    it("should not group when grouped=false", async () => {
      const community = await testPrisma.community.create({
        data: { name: `NoGrp ${uniqueSuffix()}` },
      });

      await createNotif({
        type: "RECIPE_CREATED",
        category: "RECIPE_PROPOSAL",
        communityId: community.id,
        groupKey: `community:${community.id}:RECIPE_CREATED`,
      });
      await createNotif({
        type: "RECIPE_CREATED",
        category: "RECIPE_PROPOSAL",
        communityId: community.id,
        groupKey: `community:${community.id}:RECIPE_CREATED`,
      });

      const res = await request(app)
        .get("/api/notifications?grouped=false")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].group).toBeNull();
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/notifications/unread-count
  // =====================================
  describe("GET /api/notifications/unread-count", () => {
    it("should return 0 when no notifications", async () => {
      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.byCategory.INVITATION).toBe(0);
    });

    it("should count unread by category", async () => {
      await createNotif({ category: "INVITATION" });
      await createNotif({ category: "INVITATION" });
      await createNotif({ category: "TAG", type: "tag:approved" });
      await createNotif({ category: "INVITATION", readAt: new Date() }); // read

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
      expect(res.body.byCategory.INVITATION).toBe(2);
      expect(res.body.byCategory.TAG).toBe(1);
      expect(res.body.byCategory.RECIPE_PROPOSAL).toBe(0);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get("/api/notifications/unread-count");
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // PATCH /api/notifications/:id/read
  // =====================================
  describe("PATCH /api/notifications/:id/read", () => {
    it("should mark a notification as read", async () => {
      const notif = await createNotif();

      const res = await request(app)
        .patch(`/api/notifications/${notif.id}/read`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(notif.id);
      expect(res.body.readAt).not.toBeNull();
    });

    it("should be idempotent (already read)", async () => {
      const notif = await createNotif({ readAt: new Date() });

      const res = await request(app)
        .patch(`/api/notifications/${notif.id}/read`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
    });

    it("should return 404 for non-existent notification", async () => {
      const res = await request(app)
        .patch("/api/notifications/00000000-0000-0000-0000-000000000000/read")
        .set("Cookie", userCookie);

      expect(res.status).toBe(404);
    });

    it("should return 403 for notification of another user", async () => {
      const otherUser = await testPrisma.user.create({
        data: { username: `oth_${uniqueSuffix()}`, email: `oth_${uniqueSuffix()}@example.com`, password: "h" },
      });
      const notif = await testPrisma.notification.create({
        data: {
          userId: otherUser.id,
          type: "INVITE_SENT",
          category: "INVITATION",
          title: "T",
          message: "M",
        },
      });

      const res = await request(app)
        .patch(`/api/notifications/${notif.id}/read`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(403);
    });
  });

  // =====================================
  // PATCH /api/notifications/read (batch)
  // =====================================
  describe("PATCH /api/notifications/read (batch)", () => {
    it("should mark multiple notifications as read", async () => {
      const n1 = await createNotif({ title: "N1" });
      const n2 = await createNotif({ title: "N2" });

      const res = await request(app)
        .patch("/api/notifications/read")
        .set("Cookie", userCookie)
        .send({ ids: [n1.id, n2.id] });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);

      // Verify in DB
      const updated = await testPrisma.notification.findMany({
        where: { id: { in: [n1.id, n2.id] } },
      });
      expect(updated.every((n) => n.readAt !== null)).toBe(true);
    });

    it("should return 400 for empty ids", async () => {
      const res = await request(app)
        .patch("/api/notifications/read")
        .set("Cookie", userCookie)
        .send({ ids: [] });

      expect(res.status).toBe(400);
    });

    it("should return 400 for missing ids", async () => {
      const res = await request(app)
        .patch("/api/notifications/read")
        .set("Cookie", userCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 403 if any notification belongs to another user", async () => {
      const n1 = await createNotif();
      const otherUser = await testPrisma.user.create({
        data: { username: `oth2_${uniqueSuffix()}`, email: `oth2_${uniqueSuffix()}@example.com`, password: "h" },
      });
      const n2 = await testPrisma.notification.create({
        data: {
          userId: otherUser.id,
          type: "INVITE_SENT",
          category: "INVITATION",
          title: "T",
          message: "M",
        },
      });

      const res = await request(app)
        .patch("/api/notifications/read")
        .set("Cookie", userCookie)
        .send({ ids: [n1.id, n2.id] });

      expect(res.status).toBe(403);
    });

    it("should skip already read notifications (count only new reads)", async () => {
      const n1 = await createNotif();
      const n2 = await createNotif({ readAt: new Date() });

      const res = await request(app)
        .patch("/api/notifications/read")
        .set("Cookie", userCookie)
        .send({ ids: [n1.id, n2.id] });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);
    });
  });

  // =====================================
  // PATCH /api/notifications/read-all
  // =====================================
  describe("PATCH /api/notifications/read-all", () => {
    it("should mark all unread notifications as read", async () => {
      await createNotif();
      await createNotif();
      await createNotif({ readAt: new Date() });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Cookie", userCookie)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);
    });

    it("should filter by category when provided", async () => {
      await createNotif({ category: "INVITATION" });
      await createNotif({ category: "TAG", type: "tag:approved" });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Cookie", userCookie)
        .send({ category: "INVITATION" });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);

      // TAG notification should still be unread
      const remaining = await testPrisma.notification.count({
        where: { userId: user.id, readAt: null },
      });
      expect(remaining).toBe(1);
    });

    it("should return 400 for invalid category", async () => {
      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Cookie", userCookie)
        .send({ category: "INVALID" });

      expect(res.status).toBe(400);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app)
        .patch("/api/notifications/read-all")
        .send({});

      expect(res.status).toBe(401);
    });
  });
});

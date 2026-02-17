import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Tag Preferences API", () => {
  let moderator: { id: string };
  let moderatorCookie: string;
  let member: { id: string };
  let memberCookie: string;
  let community: { id: string };
  let community2: { id: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create moderator (creates community)
    const modSignup = await request(app).post("/api/auth/signup").send({
      username: `tpmod_${suffix}`,
      email: `tpmod_${suffix}@example.com`,
      password: "Test123!Password",
    });
    moderatorCookie = extractSessionCookie(modSignup)!;
    moderator = (await testPrisma.user.findFirst({
      where: { email: `tpmod_${suffix}@example.com` },
    }))!;

    // Create community
    const createRes = await request(app)
      .post("/api/communities")
      .set("Cookie", moderatorCookie)
      .send({ name: `TagPref Community ${suffix}` });
    community = createRes.body;

    // Create second community
    const createRes2 = await request(app)
      .post("/api/communities")
      .set("Cookie", moderatorCookie)
      .send({ name: `TagPref Community2 ${suffix}` });
    community2 = createRes2.body;

    // Create member
    const memberSignup = await request(app).post("/api/auth/signup").send({
      username: `tpmem_${suffix}`,
      email: `tpmem_${suffix}@example.com`,
      password: "Test123!Password",
    });
    memberCookie = extractSessionCookie(memberSignup)!;
    member = (await testPrisma.user.findFirst({
      where: { email: `tpmem_${suffix}@example.com` },
    }))!;
    await testPrisma.userCommunity.create({
      data: { userId: member.id, communityId: community.id, role: "MEMBER" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: member.id, communityId: community2.id, role: "MEMBER" },
    });
  });

  // =====================================
  // GET /api/users/me/tag-preferences
  // =====================================
  describe("GET /api/users/me/tag-preferences", () => {
    it("should return tag preferences for all communities (default showTags=true)", async () => {
      const res = await request(app)
        .get("/api/users/me/tag-preferences")
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0]).toHaveProperty("communityId");
      expect(res.body.data[0]).toHaveProperty("communityName");
      expect(res.body.data[0]).toHaveProperty("showTags");
      // Default is true
      res.body.data.forEach((pref: { showTags: boolean }) => {
        expect(pref.showTags).toBe(true);
      });
    });

    it("should reflect updated preferences", async () => {
      // Set one to false
      await request(app)
        .put(`/api/users/me/tag-preferences/${community.id}`)
        .set("Cookie", memberCookie)
        .send({ showTags: false });

      const res = await request(app)
        .get("/api/users/me/tag-preferences")
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      const pref = res.body.data.find(
        (p: { communityId: string }) => p.communityId === community.id
      );
      expect(pref.showTags).toBe(false);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get("/api/users/me/tag-preferences");
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // PUT /api/users/me/tag-preferences/:communityId
  // =====================================
  describe("PUT /api/users/me/tag-preferences/:communityId", () => {
    it("should toggle showTags to false", async () => {
      const res = await request(app)
        .put(`/api/users/me/tag-preferences/${community.id}`)
        .set("Cookie", memberCookie)
        .send({ showTags: false });

      expect(res.status).toBe(200);
      expect(res.body.communityId).toBe(community.id);
      expect(res.body.showTags).toBe(false);
    });

    it("should toggle showTags back to true", async () => {
      await request(app)
        .put(`/api/users/me/tag-preferences/${community.id}`)
        .set("Cookie", memberCookie)
        .send({ showTags: false });

      const res = await request(app)
        .put(`/api/users/me/tag-preferences/${community.id}`)
        .set("Cookie", memberCookie)
        .send({ showTags: true });

      expect(res.status).toBe(200);
      expect(res.body.showTags).toBe(true);
    });

    it("should return 400 if showTags is not a boolean", async () => {
      const res = await request(app)
        .put(`/api/users/me/tag-preferences/${community.id}`)
        .set("Cookie", memberCookie)
        .send({ showTags: "yes" });

      expect(res.status).toBe(400);
    });

    it("should return 403 if not a member", async () => {
      const suffix = uniqueSuffix();
      const outsiderSignup = await request(app).post("/api/auth/signup").send({
        username: `tpout_${suffix}`,
        email: `tpout_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const outsiderCookie = extractSessionCookie(outsiderSignup)!;

      const res = await request(app)
        .put(`/api/users/me/tag-preferences/${community.id}`)
        .set("Cookie", outsiderCookie)
        .send({ showTags: false });

      expect(res.status).toBe(403);
    });

    it("should create preference on first toggle (upsert)", async () => {
      // No preference exists yet, first PUT should create it
      const res = await request(app)
        .put(`/api/users/me/tag-preferences/${community.id}`)
        .set("Cookie", memberCookie)
        .send({ showTags: false });

      expect(res.status).toBe(200);
      expect(res.body.showTags).toBe(false);

      // Verify in DB
      const pref = await testPrisma.userCommunityTagPreference.findUnique({
        where: {
          userId_communityId: { userId: member.id, communityId: community.id },
        },
      });
      expect(pref).toBeTruthy();
      expect(pref!.showTags).toBe(false);
    });
  });

  // =====================================
  // GET /api/users/me/notification-preferences
  // =====================================
  describe("GET /api/users/me/notification-preferences", () => {
    it("should return notification preferences for moderator", async () => {
      const res = await request(app)
        .get("/api/users/me/notification-preferences")
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.global).toHaveProperty("tagNotifications");
      expect(res.body.global.tagNotifications).toBe(true); // default
      expect(res.body.communities).toBeInstanceOf(Array);
      expect(res.body.communities.length).toBe(2); // 2 communities
    });

    it("should return empty communities for non-moderator", async () => {
      const res = await request(app)
        .get("/api/users/me/notification-preferences")
        .set("Cookie", memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.communities).toEqual([]);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get(
        "/api/users/me/notification-preferences"
      );
      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // PUT /api/users/me/notification-preferences/tags
  // =====================================
  describe("PUT /api/users/me/notification-preferences/tags", () => {
    it("should toggle global tagNotifications", async () => {
      const res = await request(app)
        .put("/api/users/me/notification-preferences/tags")
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: false });

      expect(res.status).toBe(200);
      expect(res.body.tagNotifications).toBe(false);
    });

    it("should toggle back to true", async () => {
      await request(app)
        .put("/api/users/me/notification-preferences/tags")
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: false });

      const res = await request(app)
        .put("/api/users/me/notification-preferences/tags")
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: true });

      expect(res.status).toBe(200);
      expect(res.body.tagNotifications).toBe(true);
    });

    it("should return 400 if tagNotifications is not a boolean", async () => {
      const res = await request(app)
        .put("/api/users/me/notification-preferences/tags")
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: "yes" });

      expect(res.status).toBe(400);
    });

    it("should return 403 for non-moderator", async () => {
      const res = await request(app)
        .put("/api/users/me/notification-preferences/tags")
        .set("Cookie", memberCookie)
        .send({ tagNotifications: false });

      expect(res.status).toBe(403);
    });

    it("should reflect in GET after update", async () => {
      await request(app)
        .put("/api/users/me/notification-preferences/tags")
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: false });

      const res = await request(app)
        .get("/api/users/me/notification-preferences")
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.global.tagNotifications).toBe(false);
    });
  });

  // =====================================
  // PUT /api/users/me/notification-preferences/tags/:communityId
  // =====================================
  describe("PUT /api/users/me/notification-preferences/tags/:communityId", () => {
    it("should toggle tagNotifications per community", async () => {
      const res = await request(app)
        .put(
          `/api/users/me/notification-preferences/tags/${community.id}`
        )
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: false });

      expect(res.status).toBe(200);
      expect(res.body.communityId).toBe(community.id);
      expect(res.body.tagNotifications).toBe(false);
    });

    it("should return 400 if tagNotifications is not a boolean", async () => {
      const res = await request(app)
        .put(
          `/api/users/me/notification-preferences/tags/${community.id}`
        )
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: 123 });

      expect(res.status).toBe(400);
    });

    it("should return 403 for non-moderator of that community", async () => {
      const res = await request(app)
        .put(
          `/api/users/me/notification-preferences/tags/${community.id}`
        )
        .set("Cookie", memberCookie)
        .send({ tagNotifications: false });

      expect(res.status).toBe(403);
    });

    it("should return 403 for non-member", async () => {
      const suffix = uniqueSuffix();
      const outsiderSignup = await request(app).post("/api/auth/signup").send({
        username: `tpout2_${suffix}`,
        email: `tpout2_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const outsiderCookie = extractSessionCookie(outsiderSignup)!;

      const res = await request(app)
        .put(
          `/api/users/me/notification-preferences/tags/${community.id}`
        )
        .set("Cookie", outsiderCookie)
        .send({ tagNotifications: false });

      expect(res.status).toBe(403);
    });

    it("community preference should override global in GET response", async () => {
      // Set global to true, community to false
      await request(app)
        .put("/api/users/me/notification-preferences/tags")
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: true });

      await request(app)
        .put(
          `/api/users/me/notification-preferences/tags/${community.id}`
        )
        .set("Cookie", moderatorCookie)
        .send({ tagNotifications: false });

      const res = await request(app)
        .get("/api/users/me/notification-preferences")
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.global.tagNotifications).toBe(true);

      const comm = res.body.communities.find(
        (c: { communityId: string }) => c.communityId === community.id
      );
      expect(comm.tagNotifications).toBe(false);

      // community2 should inherit global (true)
      const comm2 = res.body.communities.find(
        (c: { communityId: string }) => c.communityId === community2.id
      );
      expect(comm2.tagNotifications).toBe(true);
    });
  });
});

describe("Notification Service - getModeratorIdsForTagNotification", () => {
  let moderator1: { id: string };
  let moderator2: { id: string };
  let community: { id: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    // Create moderator1
    const mod1Signup = await request(app).post("/api/auth/signup").send({
      username: `nsmod1_${suffix}`,
      email: `nsmod1_${suffix}@example.com`,
      password: "Test123!Password",
    });
    extractSessionCookie(mod1Signup);
    moderator1 = (await testPrisma.user.findFirst({
      where: { email: `nsmod1_${suffix}@example.com` },
    }))!;

    // Create moderator2
    const mod2Signup = await request(app).post("/api/auth/signup").send({
      username: `nsmod2_${suffix}`,
      email: `nsmod2_${suffix}@example.com`,
      password: "Test123!Password",
    });
    extractSessionCookie(mod2Signup);
    moderator2 = (await testPrisma.user.findFirst({
      where: { email: `nsmod2_${suffix}@example.com` },
    }))!;

    // Create community with both as moderators
    community = await testPrisma.community.create({
      data: { name: `NotifSvc Community ${suffix}` },
    });
    await testPrisma.userCommunity.create({
      data: { userId: moderator1.id, communityId: community.id, role: "MODERATOR" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: moderator2.id, communityId: community.id, role: "MODERATOR" },
    });
  });

  it("should return all moderators by default (no preferences set)", async () => {
    const { getModeratorIdsForTagNotification } = await import(
      "../../services/notificationService"
    );
    const ids = await getModeratorIdsForTagNotification(community.id);
    expect(ids).toContain(moderator1.id);
    expect(ids).toContain(moderator2.id);
  });

  it("should exclude moderator with global notifications disabled", async () => {
    await testPrisma.moderatorNotificationPreference.create({
      data: { userId: moderator1.id, communityId: null, tagNotifications: false },
    });

    const { getModeratorIdsForTagNotification } = await import(
      "../../services/notificationService"
    );
    const ids = await getModeratorIdsForTagNotification(community.id);
    expect(ids).not.toContain(moderator1.id);
    expect(ids).toContain(moderator2.id);
  });

  it("should respect community preference over global", async () => {
    // Global disabled but community enabled
    await testPrisma.moderatorNotificationPreference.create({
      data: { userId: moderator1.id, communityId: null, tagNotifications: false },
    });
    await testPrisma.moderatorNotificationPreference.create({
      data: { userId: moderator1.id, communityId: community.id, tagNotifications: true },
    });

    const { getModeratorIdsForTagNotification } = await import(
      "../../services/notificationService"
    );
    const ids = await getModeratorIdsForTagNotification(community.id);
    expect(ids).toContain(moderator1.id);
    expect(ids).toContain(moderator2.id);
  });

  it("should exclude moderator with community notifications disabled", async () => {
    // Global enabled but community disabled
    await testPrisma.moderatorNotificationPreference.create({
      data: { userId: moderator1.id, communityId: null, tagNotifications: true },
    });
    await testPrisma.moderatorNotificationPreference.create({
      data: { userId: moderator1.id, communityId: community.id, tagNotifications: false },
    });

    const { getModeratorIdsForTagNotification } = await import(
      "../../services/notificationService"
    );
    const ids = await getModeratorIdsForTagNotification(community.id);
    expect(ids).not.toContain(moderator1.id);
    expect(ids).toContain(moderator2.id);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import {
  createTestUser,
  createTestCommunity,
  createTestInvite,
  extractSessionCookie,
} from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

// Helper to generate unique suffix
const uniqueSuffix = () => `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Invitations API", () => {
  // =====================================
  // POST /api/communities/:communityId/invites
  // =====================================
  describe("POST /api/communities/:communityId/invites", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let moderatorCookie: string;
    let member: Awaited<ReturnType<typeof createTestUser>>;
    let memberCookie: string;
    let userToInvite: Awaited<ReturnType<typeof createTestUser>>;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator and get cookie
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `invitemoderator_${suffix}`,
        email: `invitemoderator_${suffix}@example.com`,
        password: "Test123!Password",
      });
      moderatorCookie = extractSessionCookie(signupRes)!;
      moderator = (await testPrisma.user.findFirst({
        where: { email: `invitemoderator_${suffix}@example.com` },
      }))!;

      // Create a community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `Invite Test Community ${suffix}` });
      community = createRes.body;

      // Create member user
      const memberSignupRes = await request(app).post("/api/auth/signup").send({
        username: `invitemember_${suffix}`,
        email: `invitemember_${suffix}@example.com`,
        password: "Test123!Password",
      });
      memberCookie = extractSessionCookie(memberSignupRes)!;
      member = (await testPrisma.user.findFirst({
        where: { email: `invitemember_${suffix}@example.com` },
      }))!;

      // Add member to community with MEMBER role
      await testPrisma.userCommunity.create({
        data: {
          userId: member.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      // Create user to invite
      userToInvite = await createTestUser({
        username: `usertoinvite_${suffix}`,
        email: `usertoinvite_${suffix}@example.com`,
      });
    });

    it("should create an invitation by email", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ email: userToInvite.email });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe("PENDING");
      expect(res.body.invitee.id).toBe(userToInvite.id);
      expect(res.body.invitee.username).toBe(userToInvite.username);
    });

    it("should create an invitation by username", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ username: userToInvite.username });

      expect(res.status).toBe(201);
      expect(res.body.invitee.id).toBe(userToInvite.id);
    });

    it("should create an invitation by userId", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ userId: userToInvite.id });

      expect(res.status).toBe(201);
      expect(res.body.invitee.id).toBe(userToInvite.id);
    });

    it("should log INVITE_SENT activity", async () => {
      await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ userId: userToInvite.id });

      const activity = await testPrisma.activityLog.findFirst({
        where: {
          type: "INVITE_SENT",
          communityId: community.id,
        },
      });

      expect(activity).not.toBeNull();
      expect(activity!.userId).toBe(moderator.id);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .send({ userId: userToInvite.id });

      expect(res.status).toBe(401);
    });

    it("should return 403 when user is not a member", async () => {
      const suffix2 = uniqueSuffix();
      const outsiderRes = await request(app).post("/api/auth/signup").send({
        username: `outsider_${suffix2}`,
        email: `outsider_${suffix2}@example.com`,
        password: "Test123!Password",
      });
      const outsiderCookie = extractSessionCookie(outsiderRes)!;

      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", outsiderCookie)
        .send({ userId: userToInvite.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_001");
    });

    it("should return 403 when user is MEMBER not MODERATOR", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", memberCookie)
        .send({ userId: userToInvite.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_002");
    });

    it("should return 404 when user to invite not found (INVITE_003)", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ email: "nonexistent@example.com" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("INVITE_003");
    });

    it("should return 409 when user is already a member (COMMUNITY_004)", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ userId: member.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("COMMUNITY_004");
    });

    it("should return 409 when invitation already pending (COMMUNITY_005)", async () => {
      // First invitation
      await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ userId: userToInvite.id });

      // Second invitation should fail
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ userId: userToInvite.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("COMMUNITY_005");
    });

    it("should return 400 when no search field provided", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 400 when multiple search fields provided", async () => {
      const res = await request(app)
        .post(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie)
        .send({ email: userToInvite.email, username: userToInvite.username });

      expect(res.status).toBe(400);
    });
  });

  // =====================================
  // GET /api/communities/:communityId/invites
  // =====================================
  describe("GET /api/communities/:communityId/invites", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let moderatorCookie: string;
    let memberCookie: string;
    let invitee: Awaited<ReturnType<typeof createTestUser>>;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `listmoderator_${suffix}`,
        email: `listmoderator_${suffix}@example.com`,
        password: "Test123!Password",
      });
      moderatorCookie = extractSessionCookie(signupRes)!;
      moderator = (await testPrisma.user.findFirst({
        where: { email: `listmoderator_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `List Invites Community ${suffix}` });
      community = createRes.body;

      // Create member
      const memberRes = await request(app).post("/api/auth/signup").send({
        username: `listmember_${suffix}`,
        email: `listmember_${suffix}@example.com`,
        password: "Test123!Password",
      });
      memberCookie = extractSessionCookie(memberRes)!;
      const member = (await testPrisma.user.findFirst({
        where: { email: `listmember_${suffix}@example.com` },
      }))!;
      await testPrisma.userCommunity.create({
        data: {
          userId: member!.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      // Create invitee
      invitee = await createTestUser({
        username: `listinvitee_${suffix}`,
        email: `listinvitee_${suffix}@example.com`,
      });
    });

    it("should return PENDING invites by default", async () => {
      // Create a pending invite
      await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app)
        .get(`/api/communities/${community.id}/invites`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe("PENDING");
      expect(res.body.data[0].invitee.id).toBe(invitee.id);
    });

    it("should filter by status", async () => {
      const suffix2 = uniqueSuffix();

      // Create invites with different statuses
      await createTestInvite(community.id, moderator.id, invitee.id, "ACCEPTED");

      const invitee2 = await createTestUser({
        username: `listinvitee2_${suffix2}`,
        email: `listinvitee2_${suffix2}@example.com`,
      });
      await createTestInvite(community.id, moderator.id, invitee2.id, "PENDING");

      // Get only accepted
      const res = await request(app)
        .get(`/api/communities/${community.id}/invites?status=ACCEPTED`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe("ACCEPTED");
    });

    it("should return all invites when status=all", async () => {
      const suffix2 = uniqueSuffix();

      await createTestInvite(community.id, moderator.id, invitee.id, "ACCEPTED");

      const invitee2 = await createTestUser({
        username: `allinvitee_${suffix2}`,
        email: `allinvitee_${suffix2}@example.com`,
      });
      await createTestInvite(community.id, moderator.id, invitee2.id, "PENDING");

      const res = await request(app)
        .get(`/api/communities/${community.id}/invites?status=all`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("should return 403 when user is not MODERATOR", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/invites`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_002");
    });
  });

  // =====================================
  // DELETE /api/communities/:communityId/invites/:inviteId
  // =====================================
  describe("DELETE /api/communities/:communityId/invites/:inviteId", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let moderatorCookie: string;
    let invitee: Awaited<ReturnType<typeof createTestUser>>;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `cancelmoderator_${suffix}`,
        email: `cancelmoderator_${suffix}@example.com`,
        password: "Test123!Password",
      });
      moderatorCookie = extractSessionCookie(signupRes)!;
      moderator = (await testPrisma.user.findFirst({
        where: { email: `cancelmoderator_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `Cancel Invites Community ${suffix}` });
      community = createRes.body;

      // Create invitee
      invitee = await createTestUser({
        username: `cancelinvitee_${suffix}`,
        email: `cancelinvitee_${suffix}@example.com`,
      });
    });

    it("should cancel a pending invitation", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app)
        .delete(`/api/communities/${community.id}/invites/${invite.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation cancelled");

      // Verify invite is cancelled
      const updatedInvite = await testPrisma.communityInvite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite!.status).toBe("CANCELLED");
    });

    it("should log INVITE_CANCELLED activity", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      await request(app)
        .delete(`/api/communities/${community.id}/invites/${invite.id}`)
        .set("Cookie", moderatorCookie);

      const activity = await testPrisma.activityLog.findFirst({
        where: {
          type: "INVITE_CANCELLED",
          communityId: community.id,
        },
      });

      expect(activity).not.toBeNull();
    });

    it("should return 404 when invite not found (INVITE_001)", async () => {
      const res = await request(app)
        .delete(`/api/communities/${community.id}/invites/00000000-0000-0000-0000-000000000000`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("INVITE_001");
    });

    it("should return 400 when invite already processed (INVITE_002)", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "ACCEPTED");

      const res = await request(app)
        .delete(`/api/communities/${community.id}/invites/${invite.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("INVITE_002");
    });
  });

  // =====================================
  // GET /api/users/me/invites
  // =====================================
  describe("GET /api/users/me/invites", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let invitee: Awaited<ReturnType<typeof createTestUser>>;
    let inviteeCookie: string;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      moderator = await createTestUser({
        username: `myinvitesmoderator_${suffix}`,
        email: `myinvitesmoderator_${suffix}@example.com`,
      });

      // Create community
      community = await createTestCommunity(moderator.id, {
        name: `My Invites Community ${suffix}`,
      });

      // Create invitee and login
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `myinvitesinvitee_${suffix}`,
        email: `myinvitesinvitee_${suffix}@example.com`,
        password: "Test123!Password",
      });
      inviteeCookie = extractSessionCookie(signupRes)!;
      invitee = (await testPrisma.user.findFirst({
        where: { email: `myinvitesinvitee_${suffix}@example.com` },
      }))!;
    });

    it("should return PENDING invites by default", async () => {
      await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app)
        .get("/api/users/me/invites")
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe("PENDING");
      expect(res.body.data[0].community.id).toBe(community.id);
      expect(res.body.data[0].inviter.id).toBe(moderator.id);
    });

    it("should filter by status", async () => {
      await createTestInvite(community.id, moderator.id, invitee.id, "ACCEPTED");

      const res = await request(app)
        .get("/api/users/me/invites?status=ACCEPTED")
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe("ACCEPTED");
    });

    it("should not return invites from deleted communities", async () => {
      await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      // Soft delete the community
      await testPrisma.community.update({
        where: { id: community.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .get("/api/users/me/invites")
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get("/api/users/me/invites");

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/invites/:inviteId/accept
  // =====================================
  describe("POST /api/invites/:inviteId/accept", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let invitee: Awaited<ReturnType<typeof createTestUser>>;
    let inviteeCookie: string;
    let otherUserCookie: string;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      moderator = await createTestUser({
        username: `acceptmoderator_${suffix}`,
        email: `acceptmoderator_${suffix}@example.com`,
      });

      // Create community
      community = await createTestCommunity(moderator.id, {
        name: `Accept Invite Community ${suffix}`,
      });

      // Create invitee and login
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `acceptinvitee_${suffix}`,
        email: `acceptinvitee_${suffix}@example.com`,
        password: "Test123!Password",
      });
      inviteeCookie = extractSessionCookie(signupRes)!;
      invitee = (await testPrisma.user.findFirst({
        where: { email: `acceptinvitee_${suffix}@example.com` },
      }))!;

      // Create other user
      const otherRes = await request(app).post("/api/auth/signup").send({
        username: `acceptotheruser_${suffix}`,
        email: `acceptotheruser_${suffix}@example.com`,
        password: "Test123!Password",
      });
      otherUserCookie = extractSessionCookie(otherRes)!;
    });

    it("should accept an invitation and create membership", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app)
        .post(`/api/invites/${invite.id}/accept`)
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation accepted");
      expect(res.body.community.id).toBe(community.id);

      // Verify invite is accepted
      const updatedInvite = await testPrisma.communityInvite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite!.status).toBe("ACCEPTED");

      // Verify membership is created
      const membership = await testPrisma.userCommunity.findFirst({
        where: {
          userId: invitee.id,
          communityId: community.id,
        },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("MEMBER");
    });

    it("should log INVITE_ACCEPTED and USER_JOINED activities", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      await request(app)
        .post(`/api/invites/${invite.id}/accept`)
        .set("Cookie", inviteeCookie);

      const acceptedActivity = await testPrisma.activityLog.findFirst({
        where: {
          type: "INVITE_ACCEPTED",
          userId: invitee.id,
          communityId: community.id,
        },
      });
      expect(acceptedActivity).not.toBeNull();

      const joinedActivity = await testPrisma.activityLog.findFirst({
        where: {
          type: "USER_JOINED",
          userId: invitee.id,
          communityId: community.id,
        },
      });
      expect(joinedActivity).not.toBeNull();
    });

    it("should return 403 when user is not the invitee", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app)
        .post(`/api/invites/${invite.id}/accept`)
        .set("Cookie", otherUserCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 when invite not found (INVITE_001)", async () => {
      const res = await request(app)
        .post("/api/invites/00000000-0000-0000-0000-000000000000/accept")
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("INVITE_001");
    });

    it("should return 400 when invite already processed (INVITE_002)", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "REJECTED");

      const res = await request(app)
        .post(`/api/invites/${invite.id}/accept`)
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("INVITE_002");
    });

    it("should return 404 when community is deleted", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      // Soft delete the community
      await testPrisma.community.update({
        where: { id: community.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .post(`/api/invites/${invite.id}/accept`)
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("Community not found");
    });

    it("should return 401 when not authenticated", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app).post(`/api/invites/${invite.id}/accept`);

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/invites/:inviteId/reject
  // =====================================
  describe("POST /api/invites/:inviteId/reject", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let invitee: Awaited<ReturnType<typeof createTestUser>>;
    let inviteeCookie: string;
    let otherUserCookie: string;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      moderator = await createTestUser({
        username: `rejectmoderator_${suffix}`,
        email: `rejectmoderator_${suffix}@example.com`,
      });

      // Create community
      community = await createTestCommunity(moderator.id, {
        name: `Reject Invite Community ${suffix}`,
      });

      // Create invitee and login
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `rejectinvitee_${suffix}`,
        email: `rejectinvitee_${suffix}@example.com`,
        password: "Test123!Password",
      });
      inviteeCookie = extractSessionCookie(signupRes)!;
      invitee = (await testPrisma.user.findFirst({
        where: { email: `rejectinvitee_${suffix}@example.com` },
      }))!;

      // Create other user
      const otherRes = await request(app).post("/api/auth/signup").send({
        username: `rejectotheruser_${suffix}`,
        email: `rejectotheruser_${suffix}@example.com`,
        password: "Test123!Password",
      });
      otherUserCookie = extractSessionCookie(otherRes)!;
    });

    it("should reject an invitation", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app)
        .post(`/api/invites/${invite.id}/reject`)
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Invitation rejected");

      // Verify invite is rejected
      const updatedInvite = await testPrisma.communityInvite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite!.status).toBe("REJECTED");

      // Verify no membership is created
      const membership = await testPrisma.userCommunity.findFirst({
        where: {
          userId: invitee.id,
          communityId: community.id,
        },
      });
      expect(membership).toBeNull();
    });

    it("should log INVITE_REJECTED activity", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      await request(app)
        .post(`/api/invites/${invite.id}/reject`)
        .set("Cookie", inviteeCookie);

      const activity = await testPrisma.activityLog.findFirst({
        where: {
          type: "INVITE_REJECTED",
          userId: invitee.id,
          communityId: community.id,
        },
      });
      expect(activity).not.toBeNull();
    });

    it("should return 403 when user is not the invitee", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "PENDING");

      const res = await request(app)
        .post(`/api/invites/${invite.id}/reject`)
        .set("Cookie", otherUserCookie);

      expect(res.status).toBe(403);
    });

    it("should return 400 when invite already processed (INVITE_002)", async () => {
      const invite = await createTestInvite(community.id, moderator.id, invitee.id, "ACCEPTED");

      const res = await request(app)
        .post(`/api/invites/${invite.id}/reject`)
        .set("Cookie", inviteeCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("INVITE_002");
    });
  });
});

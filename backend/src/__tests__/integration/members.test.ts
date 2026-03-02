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
const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Members API", () => {
  // =====================================
  // GET /api/communities/:communityId/members
  // =====================================
  describe("GET /api/communities/:communityId/members", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let moderatorCookie: string;
    let member: Awaited<ReturnType<typeof createTestUser>>;
    let _memberCookie: string;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator and get cookie
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `getmembermod_${suffix}`,
        email: `getmembermod_${suffix}@example.com`,
        password: "Test123!Password",
      });
      moderatorCookie = extractSessionCookie(signupRes)!;
      moderator = (await testPrisma.user.findFirst({
        where: { email: `getmembermod_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `Members Test Community ${suffix}` });
      community = createRes.body;

      // Create member user and add to community
      const memberSignupRes = await request(app)
        .post("/api/auth/signup")
        .send({
          username: `getmembermem_${suffix}`,
          email: `getmembermem_${suffix}@example.com`,
          password: "Test123!Password",
        });
      _memberCookie = extractSessionCookie(memberSignupRes)!;
      member = (await testPrisma.user.findFirst({
        where: { email: `getmembermem_${suffix}@example.com` },
      }))!;

      await testPrisma.userCommunity.create({
        data: {
          userId: member.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });
    });

    it("should return all active members with roles", async () => {
      const res = await request(app)
        .get(`/api/communities/${community.id}/members`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);

      // Ordered by joinedAt asc, moderator first
      const modEntry = res.body.data.find(
        (m: { id: string }) => m.id === moderator.id
      );
      const memEntry = res.body.data.find(
        (m: { id: string }) => m.id === member.id
      );

      expect(modEntry.role).toBe("MODERATOR");
      expect(modEntry.username).toBe(moderator.username);
      expect(modEntry.joinedAt).toBeDefined();

      expect(memEntry.role).toBe("MEMBER");
      expect(memEntry.username).toBe(member.username);
    });

    it("should exclude soft-deleted members", async () => {
      // Soft delete the member
      await testPrisma.userCommunity.updateMany({
        where: { userId: member.id, communityId: community.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .get(`/api/communities/${community.id}/members`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(moderator.id);
    });

    it("should return 403 for non-member", async () => {
      const suffix2 = uniqueSuffix();
      const outsiderRes = await request(app).post("/api/auth/signup").send({
        username: `outsider_${suffix2}`,
        email: `outsider_${suffix2}@example.com`,
        password: "Test123!Password",
      });
      const outsiderCookie = extractSessionCookie(outsiderRes)!;

      const res = await request(app)
        .get(`/api/communities/${community.id}/members`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_001");
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).get(
        `/api/communities/${community.id}/members`
      );

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // PATCH /api/communities/:communityId/members/:userId
  // =====================================
  describe("PATCH /api/communities/:communityId/members/:userId", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let moderatorCookie: string;
    let member: Awaited<ReturnType<typeof createTestUser>>;
    let memberCookie: string;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      const signupRes = await request(app).post("/api/auth/signup").send({
        username: `promotemod_${suffix}`,
        email: `promotemod_${suffix}@example.com`,
        password: "Test123!Password",
      });
      moderatorCookie = extractSessionCookie(signupRes)!;
      moderator = (await testPrisma.user.findFirst({
        where: { email: `promotemod_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `Promote Test Community ${suffix}` });
      community = createRes.body;

      // Create member
      const memberSignupRes = await request(app)
        .post("/api/auth/signup")
        .send({
          username: `promotemem_${suffix}`,
          email: `promotemem_${suffix}@example.com`,
          password: "Test123!Password",
        });
      memberCookie = extractSessionCookie(memberSignupRes)!;
      member = (await testPrisma.user.findFirst({
        where: { email: `promotemem_${suffix}@example.com` },
      }))!;

      await testPrisma.userCommunity.create({
        data: {
          userId: member.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });
    });

    it("should promote MEMBER to MODERATOR", async () => {
      const res = await request(app)
        .patch(`/api/communities/${community.id}/members/${member.id}`)
        .set("Cookie", moderatorCookie)
        .send({ role: "MODERATOR" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("User promoted to MODERATOR");

      // Verify in DB
      const updated = await testPrisma.userCommunity.findFirst({
        where: { userId: member.id, communityId: community.id, deletedAt: null },
      });
      expect(updated!.role).toBe("MODERATOR");
    });

    it("should create USER_PROMOTED activity log", async () => {
      await request(app)
        .patch(`/api/communities/${community.id}/members/${member.id}`)
        .set("Cookie", moderatorCookie)
        .send({ role: "MODERATOR" });

      const activity = await testPrisma.activityLog.findFirst({
        where: {
          type: "USER_PROMOTED",
          communityId: community.id,
        },
      });

      expect(activity).not.toBeNull();
      expect(activity!.userId).toBe(moderator.id);
      expect((activity!.metadata as { promotedUserId: string }).promotedUserId).toBe(
        member.id
      );
    });

    it("should return 400 when role is missing", async () => {
      const res = await request(app)
        .patch(`/api/communities/${community.id}/members/${member.id}`)
        .set("Cookie", moderatorCookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid role (demotion)", async () => {
      const res = await request(app)
        .patch(`/api/communities/${community.id}/members/${member.id}`)
        .set("Cookie", moderatorCookie)
        .send({ role: "MEMBER" });

      expect(res.status).toBe(400);
    });

    it("should return 400 when target is already MODERATOR", async () => {
      // Promote first
      await testPrisma.userCommunity.updateMany({
        where: { userId: member.id, communityId: community.id },
        data: { role: "MODERATOR" },
      });

      const res = await request(app)
        .patch(`/api/communities/${community.id}/members/${member.id}`)
        .set("Cookie", moderatorCookie)
        .send({ role: "MODERATOR" });

      expect(res.status).toBe(400);
    });

    it("should return 404 when target is not a member", async () => {
      const res = await request(app)
        .patch(
          `/api/communities/${community.id}/members/00000000-0000-0000-0000-000000000000`
        )
        .set("Cookie", moderatorCookie)
        .send({ role: "MODERATOR" });

      expect(res.status).toBe(404);
    });

    it("should return 403 when requester is MEMBER", async () => {
      const suffix2 = uniqueSuffix();
      const target = await createTestUser({
        username: `promotetarget_${suffix2}`,
        email: `promotetarget_${suffix2}@example.com`,
      });
      await testPrisma.userCommunity.create({
        data: {
          userId: target.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      const res = await request(app)
        .patch(`/api/communities/${community.id}/members/${target.id}`)
        .set("Cookie", memberCookie)
        .send({ role: "MODERATOR" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_002");
    });
  });

  // =====================================
  // DELETE /api/communities/:communityId/members/:userId (LEAVE)
  // =====================================
  describe("DELETE /api/communities/:communityId/members/:userId (leave)", () => {
    it("should allow MEMBER to leave", async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      const modRes = await request(app).post("/api/auth/signup").send({
        username: `leavemod_${suffix}`,
        email: `leavemod_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const modCookie = extractSessionCookie(modRes)!;
      const _moderator = (await testPrisma.user.findFirst({
        where: { email: `leavemod_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", modCookie)
        .send({ name: `Leave Test Community ${suffix}` });
      const community = createRes.body;

      // Create member
      const memRes = await request(app).post("/api/auth/signup").send({
        username: `leavemem_${suffix}`,
        email: `leavemem_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const memCookie = extractSessionCookie(memRes)!;
      const member = (await testPrisma.user.findFirst({
        where: { email: `leavemem_${suffix}@example.com` },
      }))!;

      await testPrisma.userCommunity.create({
        data: {
          userId: member.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/members/${member.id}`)
        .set("Cookie", memCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Left community successfully");

      // Verify soft-deleted
      const membership = await testPrisma.userCommunity.findFirst({
        where: { userId: member.id, communityId: community.id },
      });
      expect(membership!.deletedAt).not.toBeNull();

      // Verify activity log
      const activity = await testPrisma.activityLog.findFirst({
        where: {
          type: "USER_LEFT",
          userId: member.id,
          communityId: community.id,
        },
      });
      expect(activity).not.toBeNull();
    });

    it("should allow MODERATOR to leave when other moderators exist", async () => {
      const suffix = uniqueSuffix();

      // Create first moderator
      const mod1Res = await request(app).post("/api/auth/signup").send({
        username: `leavemod1_${suffix}`,
        email: `leavemod1_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const mod1Cookie = extractSessionCookie(mod1Res)!;
      const mod1 = (await testPrisma.user.findFirst({
        where: { email: `leavemod1_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", mod1Cookie)
        .send({ name: `Leave Mod Test ${suffix}` });
      const community = createRes.body;

      // Create second moderator
      const mod2 = await createTestUser({
        username: `leavemod2_${suffix}`,
        email: `leavemod2_${suffix}@example.com`,
      });
      await testPrisma.userCommunity.create({
        data: {
          userId: mod2.id,
          communityId: community.id,
          role: "MODERATOR",
        },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/members/${mod1.id}`)
        .set("Cookie", mod1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Left community successfully");
    });

    it("should return 403 when last MODERATOR tries to leave with other members", async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      const modRes = await request(app).post("/api/auth/signup").send({
        username: `lastmod_${suffix}`,
        email: `lastmod_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const modCookie = extractSessionCookie(modRes)!;
      const moderator = (await testPrisma.user.findFirst({
        where: { email: `lastmod_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", modCookie)
        .send({ name: `Last Mod Community ${suffix}` });
      const community = createRes.body;

      // Add a regular member
      const member = await createTestUser({
        username: `lastmodmem_${suffix}`,
        email: `lastmodmem_${suffix}@example.com`,
      });
      await testPrisma.userCommunity.create({
        data: {
          userId: member.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/members/${moderator.id}`)
        .set("Cookie", modCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_003");
    });

    it("should return 410 and delete community when last member leaves", async () => {
      const suffix = uniqueSuffix();

      // Create moderator (sole member)
      const modRes = await request(app).post("/api/auth/signup").send({
        username: `solemem_${suffix}`,
        email: `solemem_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const modCookie = extractSessionCookie(modRes)!;
      const moderator = (await testPrisma.user.findFirst({
        where: { email: `solemem_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", modCookie)
        .send({ name: `Solo Community ${suffix}` });
      const community = createRes.body;

      const res = await request(app)
        .delete(`/api/communities/${community.id}/members/${moderator.id}`)
        .set("Cookie", modCookie);

      expect(res.status).toBe(410);

      // Verify community is soft-deleted
      const deletedCommunity = await testPrisma.community.findUnique({
        where: { id: community.id },
      });
      expect(deletedCommunity!.deletedAt).not.toBeNull();
    });

    it("should cancel pending invitations when community is deleted", async () => {
      const suffix = uniqueSuffix();

      // Create moderator (sole member)
      const modRes = await request(app).post("/api/auth/signup").send({
        username: `invcancel_${suffix}`,
        email: `invcancel_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const modCookie = extractSessionCookie(modRes)!;
      const moderator = (await testPrisma.user.findFirst({
        where: { email: `invcancel_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", modCookie)
        .send({ name: `InvCancel Community ${suffix}` });
      const community = createRes.body;

      // Create a pending invite
      const invitee = await createTestUser({
        username: `invcancelinv_${suffix}`,
        email: `invcancelinv_${suffix}@example.com`,
      });
      const invite = await createTestInvite(
        community.id,
        moderator.id,
        invitee.id,
        "PENDING"
      );

      // Last member leaves
      await request(app)
        .delete(`/api/communities/${community.id}/members/${moderator.id}`)
        .set("Cookie", modCookie);

      // Verify invite is cancelled
      const updatedInvite = await testPrisma.communityInvite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite!.status).toBe("CANCELLED");
    });

    it("should soft-delete community recipes when community is deleted", async () => {
      const suffix = uniqueSuffix();

      // Create moderator (sole member)
      const modRes = await request(app).post("/api/auth/signup").send({
        username: `recdelete_${suffix}`,
        email: `recdelete_${suffix}@example.com`,
        password: "Test123!Password",
      });
      const modCookie = extractSessionCookie(modRes)!;
      const moderator = (await testPrisma.user.findFirst({
        where: { email: `recdelete_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", modCookie)
        .send({ name: `RecDelete Community ${suffix}` });
      const community = createRes.body;

      // Create a community recipe
      const recipe = await testPrisma.recipe.create({
        data: {
          title: `Community Recipe ${suffix}`,
          servings: 4,
          creatorId: moderator.id,
          communityId: community.id,
          steps: { create: [{ order: 0, instruction: "Test content" }] },
        },
      });

      // Last member leaves
      await request(app)
        .delete(`/api/communities/${community.id}/members/${moderator.id}`)
        .set("Cookie", modCookie);

      // Verify recipe is soft-deleted
      const updatedRecipe = await testPrisma.recipe.findUnique({
        where: { id: recipe.id },
      });
      expect(updatedRecipe!.deletedAt).not.toBeNull();
    });
  });

  // =====================================
  // DELETE /api/communities/:communityId/members/:userId (KICK)
  // =====================================
  describe("DELETE /api/communities/:communityId/members/:userId (kick)", () => {
    let moderator: Awaited<ReturnType<typeof createTestUser>>;
    let moderatorCookie: string;
    let member: Awaited<ReturnType<typeof createTestUser>>;
    let memberCookie: string;
    let community: Awaited<ReturnType<typeof createTestCommunity>>;

    beforeEach(async () => {
      const suffix = uniqueSuffix();

      // Create moderator
      const modRes = await request(app).post("/api/auth/signup").send({
        username: `kickmod_${suffix}`,
        email: `kickmod_${suffix}@example.com`,
        password: "Test123!Password",
      });
      moderatorCookie = extractSessionCookie(modRes)!;
      moderator = (await testPrisma.user.findFirst({
        where: { email: `kickmod_${suffix}@example.com` },
      }))!;

      // Create community
      const createRes = await request(app)
        .post("/api/communities")
        .set("Cookie", moderatorCookie)
        .send({ name: `Kick Test Community ${suffix}` });
      community = createRes.body;

      // Create member
      const memRes = await request(app).post("/api/auth/signup").send({
        username: `kickmem_${suffix}`,
        email: `kickmem_${suffix}@example.com`,
        password: "Test123!Password",
      });
      memberCookie = extractSessionCookie(memRes)!;
      member = (await testPrisma.user.findFirst({
        where: { email: `kickmem_${suffix}@example.com` },
      }))!;

      await testPrisma.userCommunity.create({
        data: {
          userId: member.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });
    });

    it("should allow MODERATOR to kick MEMBER", async () => {
      const res = await request(app)
        .delete(`/api/communities/${community.id}/members/${member.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Member removed successfully");

      // Verify soft-deleted
      const membership = await testPrisma.userCommunity.findFirst({
        where: { userId: member.id, communityId: community.id },
      });
      expect(membership!.deletedAt).not.toBeNull();

      // Verify activity log
      const activity = await testPrisma.activityLog.findFirst({
        where: {
          type: "USER_KICKED",
          communityId: community.id,
        },
      });
      expect(activity).not.toBeNull();
      expect(activity!.userId).toBe(moderator.id);
      expect(
        (activity!.metadata as { kickedUserId: string }).kickedUserId
      ).toBe(member.id);
    });

    it("should return 403 when trying to kick a MODERATOR (COMMUNITY_006)", async () => {
      const suffix2 = uniqueSuffix();

      // Create another moderator
      const otherMod = await createTestUser({
        username: `kickothermod_${suffix2}`,
        email: `kickothermod_${suffix2}@example.com`,
      });
      await testPrisma.userCommunity.create({
        data: {
          userId: otherMod.id,
          communityId: community.id,
          role: "MODERATOR",
        },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/members/${otherMod.id}`)
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_006");
    });

    it("should return 403 when MEMBER tries to kick", async () => {
      const suffix2 = uniqueSuffix();
      const target = await createTestUser({
        username: `kicktarget_${suffix2}`,
        email: `kicktarget_${suffix2}@example.com`,
      });
      await testPrisma.userCommunity.create({
        data: {
          userId: target.id,
          communityId: community.id,
          role: "MEMBER",
        },
      });

      const res = await request(app)
        .delete(`/api/communities/${community.id}/members/${target.id}`)
        .set("Cookie", memberCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("COMMUNITY_002");
    });

    it("should return 404 when target is not a member", async () => {
      const res = await request(app)
        .delete(
          `/api/communities/${community.id}/members/00000000-0000-0000-0000-000000000000`
        )
        .set("Cookie", moderatorCookie);

      expect(res.status).toBe(404);
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).delete(
        `/api/communities/${community.id}/members/${member.id}`
      );

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // Orphan Handling Tests
  // =====================================
  describe("Orphan Handling", () => {
    describe("when member leaves with pending proposals on their recipes", () => {
      it("should auto-reject pending proposals and create variants", async () => {
        const suffix = uniqueSuffix();

        // Create moderator (recipe owner who will leave)
        const ownerRes = await request(app).post("/api/auth/signup").send({
          username: `orphanowner_${suffix}`,
          email: `orphanowner_${suffix}@example.com`,
          password: "Test123!Password",
        });
        const ownerCookie = extractSessionCookie(ownerRes)!;
        const owner = (await testPrisma.user.findFirst({
          where: { email: `orphanowner_${suffix}@example.com` },
        }))!;

        // Create community
        const createRes = await request(app)
          .post("/api/communities")
          .set("Cookie", ownerCookie)
          .send({ name: `Orphan Test Community ${suffix}` });
        const community = createRes.body;

        // Create another moderator (so owner can leave)
        const otherMod = await createTestUser({
          username: `orphanmod_${suffix}`,
          email: `orphanmod_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.create({
          data: {
            userId: otherMod.id,
            communityId: community.id,
            role: "MODERATOR",
          },
        });

        // Create proposer
        const proposer = await createTestUser({
          username: `orphanproposer_${suffix}`,
          email: `orphanproposer_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.create({
          data: {
            userId: proposer.id,
            communityId: community.id,
            role: "MEMBER",
          },
        });

        // Create a community recipe owned by owner
        const recipe = await testPrisma.recipe.create({
          data: {
            title: `Orphan Recipe ${suffix}`,
            servings: 4,
            creatorId: owner.id,
            communityId: community.id,
            steps: { create: [{ order: 0, instruction: "Original content" }] },
          },
        });

        // Create pending proposal
        const proposal = await testPrisma.recipeUpdateProposal.create({
          data: {
            proposedTitle: `Modified Title ${suffix}`,
            status: "PENDING",
            recipeId: recipe.id,
            proposerId: proposer.id,
            proposedSteps: { create: [{ order: 0, instruction: "Modified content" }] },
          },
        });

        // Owner leaves
        const res = await request(app)
          .delete(`/api/communities/${community.id}/members/${owner.id}`)
          .set("Cookie", ownerCookie);

        expect(res.status).toBe(200);

        // Verify proposal was auto-rejected
        const updatedProposal = await testPrisma.recipeUpdateProposal.findUnique({
          where: { id: proposal.id },
        });
        expect(updatedProposal!.status).toBe("REJECTED");
        expect(updatedProposal!.decidedAt).not.toBeNull();

        // Verify variant was created for proposer
        const variant = await testPrisma.recipe.findFirst({
          where: {
            originRecipeId: recipe.id,
            isVariant: true,
            creatorId: proposer.id,
          },
        });
        expect(variant).not.toBeNull();
        expect(variant!.title).toBe(`Modified Title ${suffix}`);
        expect(variant!.communityId).toBe(community.id);

        // Verify ActivityLog VARIANT_CREATED
        const activity = await testPrisma.activityLog.findFirst({
          where: {
            type: "VARIANT_CREATED",
            recipeId: variant!.id,
            communityId: community.id,
          },
        });
        expect(activity).not.toBeNull();
        expect(activity!.userId).toBe(proposer.id);
        expect((activity!.metadata as { reason: string }).reason).toBe("ORPHAN_AUTO_REJECT");
      });

      it("should handle multiple pending proposals on multiple recipes", async () => {
        const suffix = uniqueSuffix();

        // Create owner
        const ownerRes = await request(app).post("/api/auth/signup").send({
          username: `multiorphan_${suffix}`,
          email: `multiorphan_${suffix}@example.com`,
          password: "Test123!Password",
        });
        const ownerCookie = extractSessionCookie(ownerRes)!;
        const owner = (await testPrisma.user.findFirst({
          where: { email: `multiorphan_${suffix}@example.com` },
        }))!;

        // Create community
        const createRes = await request(app)
          .post("/api/communities")
          .set("Cookie", ownerCookie)
          .send({ name: `Multi Orphan Community ${suffix}` });
        const community = createRes.body;

        // Create another moderator
        const otherMod = await createTestUser({
          username: `multiorphanmod_${suffix}`,
          email: `multiorphanmod_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.create({
          data: {
            userId: otherMod.id,
            communityId: community.id,
            role: "MODERATOR",
          },
        });

        // Create two proposers
        const proposer1 = await createTestUser({
          username: `multiproposer1_${suffix}`,
          email: `multiproposer1_${suffix}@example.com`,
        });
        const proposer2 = await createTestUser({
          username: `multiproposer2_${suffix}`,
          email: `multiproposer2_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.createMany({
          data: [
            { userId: proposer1.id, communityId: community.id, role: "MEMBER" },
            { userId: proposer2.id, communityId: community.id, role: "MEMBER" },
          ],
        });

        // Create two recipes
        const recipe1 = await testPrisma.recipe.create({
          data: {
            title: `Recipe 1 ${suffix}`,
            servings: 4,
            creatorId: owner.id,
            communityId: community.id,
            steps: { create: [{ order: 0, instruction: "Content 1" }] },
          },
        });
        const recipe2 = await testPrisma.recipe.create({
          data: {
            title: `Recipe 2 ${suffix}`,
            servings: 4,
            creatorId: owner.id,
            communityId: community.id,
            steps: { create: [{ order: 0, instruction: "Content 2" }] },
          },
        });

        // Create proposals
        await testPrisma.recipeUpdateProposal.create({
          data: {
            proposedTitle: "Prop 1",
            status: "PENDING",
            recipeId: recipe1.id,
            proposerId: proposer1.id,
            proposedSteps: { create: [{ order: 0, instruction: "Prop content 1" }] },
          },
        });
        await testPrisma.recipeUpdateProposal.create({
          data: {
            proposedTitle: "Prop 2",
            status: "PENDING",
            recipeId: recipe1.id,
            proposerId: proposer2.id,
            proposedSteps: { create: [{ order: 0, instruction: "Prop content 2" }] },
          },
        });
        await testPrisma.recipeUpdateProposal.create({
          data: {
            proposedTitle: "Prop 3",
            status: "PENDING",
            recipeId: recipe2.id,
            proposerId: proposer1.id,
            proposedSteps: { create: [{ order: 0, instruction: "Prop content 3" }] },
          },
        });

        // Owner leaves
        await request(app)
          .delete(`/api/communities/${community.id}/members/${owner.id}`)
          .set("Cookie", ownerCookie);

        // Verify all proposals are rejected
        const rejectedProposals = await testPrisma.recipeUpdateProposal.findMany({
          where: {
            recipeId: { in: [recipe1.id, recipe2.id] },
            status: "REJECTED",
          },
        });
        expect(rejectedProposals).toHaveLength(3);

        // Verify 3 variants created
        const variants = await testPrisma.recipe.findMany({
          where: {
            originRecipeId: { in: [recipe1.id, recipe2.id] },
            isVariant: true,
          },
        });
        expect(variants).toHaveLength(3);
      });

      it("should not affect already decided proposals", async () => {
        const suffix = uniqueSuffix();

        // Create owner
        const ownerRes = await request(app).post("/api/auth/signup").send({
          username: `decidedorphan_${suffix}`,
          email: `decidedorphan_${suffix}@example.com`,
          password: "Test123!Password",
        });
        const ownerCookie = extractSessionCookie(ownerRes)!;
        const owner = (await testPrisma.user.findFirst({
          where: { email: `decidedorphan_${suffix}@example.com` },
        }))!;

        // Create community
        const createRes = await request(app)
          .post("/api/communities")
          .set("Cookie", ownerCookie)
          .send({ name: `Decided Orphan Community ${suffix}` });
        const community = createRes.body;

        // Create another moderator
        const otherMod = await createTestUser({
          username: `decidedorphanmod_${suffix}`,
          email: `decidedorphanmod_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.create({
          data: {
            userId: otherMod.id,
            communityId: community.id,
            role: "MODERATOR",
          },
        });

        // Create proposer
        const proposer = await createTestUser({
          username: `decidedproposer_${suffix}`,
          email: `decidedproposer_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.create({
          data: {
            userId: proposer.id,
            communityId: community.id,
            role: "MEMBER",
          },
        });

        // Create recipe
        const recipe = await testPrisma.recipe.create({
          data: {
            title: `Decided Recipe ${suffix}`,
            servings: 4,
            creatorId: owner.id,
            communityId: community.id,
            steps: { create: [{ order: 0, instruction: "Original" }] },
          },
        });

        // Create already accepted proposal
        const acceptedProposal = await testPrisma.recipeUpdateProposal.create({
          data: {
            proposedTitle: "Accepted",
            status: "ACCEPTED",
            decidedAt: new Date(),
            recipeId: recipe.id,
            proposerId: proposer.id,
            proposedSteps: { create: [{ order: 0, instruction: "Accepted content" }] },
          },
        });

        // Owner leaves
        await request(app)
          .delete(`/api/communities/${community.id}/members/${owner.id}`)
          .set("Cookie", ownerCookie);

        // Verify accepted proposal unchanged
        const unchanged = await testPrisma.recipeUpdateProposal.findUnique({
          where: { id: acceptedProposal.id },
        });
        expect(unchanged!.status).toBe("ACCEPTED");

        // Verify no variant created (since proposal was already decided)
        const variants = await testPrisma.recipe.findMany({
          where: {
            originRecipeId: recipe.id,
            isVariant: true,
          },
        });
        expect(variants).toHaveLength(0);
      });
    });

    describe("when member is kicked with pending proposals on their recipes", () => {
      it("should auto-reject pending proposals and create variants", async () => {
        const suffix = uniqueSuffix();

        // Create moderator
        const modRes = await request(app).post("/api/auth/signup").send({
          username: `kickorphanmod_${suffix}`,
          email: `kickorphanmod_${suffix}@example.com`,
          password: "Test123!Password",
        });
        const modCookie = extractSessionCookie(modRes)!;

        // Create community
        const createRes = await request(app)
          .post("/api/communities")
          .set("Cookie", modCookie)
          .send({ name: `Kick Orphan Community ${suffix}` });
        const community = createRes.body;

        // Create member (recipe owner who will be kicked)
        const member = await createTestUser({
          username: `kickorphanmem_${suffix}`,
          email: `kickorphanmem_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.create({
          data: {
            userId: member.id,
            communityId: community.id,
            role: "MEMBER",
          },
        });

        // Create proposer
        const proposer = await createTestUser({
          username: `kickorphanprop_${suffix}`,
          email: `kickorphanprop_${suffix}@example.com`,
        });
        await testPrisma.userCommunity.create({
          data: {
            userId: proposer.id,
            communityId: community.id,
            role: "MEMBER",
          },
        });

        // Create recipe owned by member
        const recipe = await testPrisma.recipe.create({
          data: {
            title: `Kick Orphan Recipe ${suffix}`,
            servings: 4,
            creatorId: member.id,
            communityId: community.id,
            steps: { create: [{ order: 0, instruction: "Original content" }] },
          },
        });

        // Create pending proposal
        const proposal = await testPrisma.recipeUpdateProposal.create({
          data: {
            proposedTitle: `Kick Modified ${suffix}`,
            status: "PENDING",
            recipeId: recipe.id,
            proposerId: proposer.id,
            proposedSteps: { create: [{ order: 0, instruction: "Kick modified content" }] },
          },
        });

        // Moderator kicks member
        const res = await request(app)
          .delete(`/api/communities/${community.id}/members/${member.id}`)
          .set("Cookie", modCookie);

        expect(res.status).toBe(200);

        // Verify proposal was auto-rejected
        const updatedProposal = await testPrisma.recipeUpdateProposal.findUnique({
          where: { id: proposal.id },
        });
        expect(updatedProposal!.status).toBe("REJECTED");

        // Verify variant was created
        const variant = await testPrisma.recipe.findFirst({
          where: {
            originRecipeId: recipe.id,
            isVariant: true,
            creatorId: proposer.id,
          },
        });
        expect(variant).not.toBeNull();
        expect(variant!.title).toBe(`Kick Modified ${suffix}`);
      });
    });
  });
});

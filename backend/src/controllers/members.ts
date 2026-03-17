import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { handleOrphanedRecipes } from "../services/orphanHandling";
import appEvents from "../services/eventEmitter";
import {
  MEMBER_003,
  MEMBER_004,
  COMMUNITY_002,
  COMMUNITY_003,
  COMMUNITY_006,
} from "../constants/errorCodes";
import { PromoteMemberInput } from "../schemas/member.schema";

// =====================================
// GET /api/communities/:communityId/members
// List community members (any member)
// =====================================
export const getMembers: RequestHandler<{ communityId: string }> = async (req, res, next) => {
  const communityId = req.params.communityId;
  const userCommunity = req.userCommunity;

  try {
    if (!userCommunity) {
      throw createHttpError(500, "Middleware memberOf required");
    }

    const members = await prisma.userCommunity.findMany({
      where: {
        communityId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    res.status(200).json({
      data: members.map((m) => ({
        id: m.user.id,
        username: m.user.username,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// PATCH /api/communities/:communityId/members/:userId
// Promote a member (MODERATOR only)
// =====================================

export const promoteMember: RequestHandler<
  { communityId: string; userId: string },
  unknown,
  PromoteMemberInput
> = async (req, res, next) => {
  const communityId = req.params.communityId;
  const targetUserId = req.params.userId;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    // Find the target membership
    const targetMembership = await prisma.userCommunity.findFirst({
      where: {
        userId: targetUserId,
        communityId,
        deletedAt: null,
      },
    });

    if (!targetMembership) {
      throw createHttpError(404, MEMBER_003);
    }

    if (targetMembership.role === "MODERATOR") {
      throw createHttpError(400, MEMBER_004);
    }

    // Promote and log in a transaction
    await prisma.$transaction([
      prisma.userCommunity.update({
        where: { id: targetMembership.id },
        data: { role: "MODERATOR" },
      }),
      prisma.activityLog.create({
        data: {
          type: "USER_PROMOTED",
          userId,
          communityId,
          metadata: {
            promotedUserId: targetUserId,
          },
        },
      }),
    ]);

    appEvents.emitActivity({
      type: "USER_PROMOTED",
      userId,
      communityId,
      targetUserIds: [targetUserId],
    });

    res.status(200).json({ message: "User promoted to MODERATOR" });
  } catch (error) {
    next(error);
  }
};

// =====================================
// DELETE /api/communities/:communityId/members/:userId
// Leave community (self) or kick member (moderator)
// =====================================
export const removeMember: RequestHandler<{ communityId: string; userId: string }> = async (
  req,
  res,
  next
) => {
  const communityId = req.params.communityId;
  const targetUserId = req.params.userId;
  const userId = req.session.userId;
  const userCommunity = req.userCommunity;

  try {
    assertIsDefine(userId);

    if (!userCommunity) {
      throw createHttpError(500, "Middleware memberOf required");
    }

    const isSelf = userId === targetUserId;

    if (isSelf) {
      // === LEAVE ===
      await handleLeave(userId, communityId, userCommunity.role, res);
    } else {
      // === KICK ===
      await handleKick(userId, targetUserId, communityId, userCommunity.role, res);
    }
  } catch (error) {
    next(error);
  }
};

async function handleLeave(
  userId: string,
  communityId: string,
  role: string,
  res: Parameters<RequestHandler>[1]
) {
  // Count active members and moderators
  const [totalMembers, totalModerators] = await Promise.all([
    prisma.userCommunity.count({
      where: { communityId, deletedAt: null },
    }),
    prisma.userCommunity.count({
      where: { communityId, deletedAt: null, role: "MODERATOR" },
    }),
  ]);

  const isLastMember = totalMembers === 1;
  const isLastModerator = role === "MODERATOR" && totalModerators === 1;

  if (isLastMember) {
    // Cascade delete the community
    await cascadeDeleteCommunity(userId, communityId);
    res.status(410).json({ message: "Community deleted (last member left)" });
    return;
  }

  if (isLastModerator) {
    // Cannot leave as last moderator when other members exist
    throw createHttpError(403, COMMUNITY_003);
  }

  // Regular leave - use interactive transaction for orphan handling
  await prisma.$transaction(async (tx) => {
    // Handle orphaned recipes first (auto-reject pending proposals)
    await handleOrphanedRecipes(userId, communityId, tx);

    // Soft delete membership
    await tx.userCommunity.updateMany({
      where: {
        userId,
        communityId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        type: "USER_LEFT",
        userId,
        communityId,
      },
    });
  });

  appEvents.emitActivity({
    type: "USER_LEFT",
    userId,
    communityId,
  });

  res.status(200).json({ message: "Left community successfully" });
}

async function handleKick(
  requesterId: string,
  targetUserId: string,
  communityId: string,
  requesterRole: string,
  res: Parameters<RequestHandler>[1]
) {
  // Only MODERATOR can kick
  if (requesterRole !== "MODERATOR") {
    throw createHttpError(403, COMMUNITY_002);
  }

  // Find the target membership
  const targetMembership = await prisma.userCommunity.findFirst({
    where: {
      userId: targetUserId,
      communityId,
      deletedAt: null,
    },
  });

  if (!targetMembership) {
    throw createHttpError(404, "Member not found");
  }

  // Cannot kick another MODERATOR
  if (targetMembership.role === "MODERATOR") {
    throw createHttpError(403, COMMUNITY_006);
  }

  // Kick the member - use interactive transaction for orphan handling
  await prisma.$transaction(async (tx) => {
    // Handle orphaned recipes first (auto-reject pending proposals)
    await handleOrphanedRecipes(targetUserId, communityId, tx);

    // Soft delete membership
    await tx.userCommunity.update({
      where: { id: targetMembership.id },
      data: { deletedAt: new Date() },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        type: "USER_KICKED",
        userId: requesterId,
        communityId,
        metadata: {
          kickedUserId: targetUserId,
        },
      },
    });
  });

  appEvents.emitActivity({
    type: "USER_KICKED",
    userId: requesterId,
    communityId,
    targetUserIds: [targetUserId],
  });

  res.status(200).json({ message: "Member removed successfully" });
}

async function cascadeDeleteCommunity(userId: string, communityId: string) {
  const now = new Date();

  await prisma.$transaction([
    // 1. Soft delete all memberships
    prisma.userCommunity.updateMany({
      where: { communityId, deletedAt: null },
      data: { deletedAt: now },
    }),
    // 2. Soft delete all community recipes
    prisma.recipe.updateMany({
      where: { communityId, deletedAt: null },
      data: { deletedAt: now },
    }),
    // 3. Cancel all pending invitations
    prisma.communityInvite.updateMany({
      where: { communityId, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: now },
    }),
    // 4. Soft delete the community
    prisma.community.update({
      where: { id: communityId },
      data: { deletedAt: now },
    }),
    // 5. Log the leave activity
    prisma.activityLog.create({
      data: {
        type: "USER_LEFT",
        userId,
        communityId,
      },
    }),
  ]);
}

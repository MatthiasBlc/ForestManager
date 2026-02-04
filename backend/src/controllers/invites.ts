import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { InviteStatus } from "@prisma/client";

// =====================================
// Types
// =====================================

interface CreateInviteBody {
  email?: string;
  username?: string;
  userId?: string;
}

interface GetInvitesQuery {
  status?: string;
}

interface GetMyInvitesQuery {
  status?: string;
}

// =====================================
// POST /api/communities/:communityId/invites
// Create an invitation (MODERATOR only)
// =====================================
export const createInvite: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const { email, username, userId } = req.body as CreateInviteBody;
  const inviterId = req.session.userId;
  const userCommunity = req.userCommunity;

  try {
    assertIsDefine(inviterId);

    if (!userCommunity) {
      throw createHttpError(500, "Middleware memberOf required");
    }

    // Validate that exactly one search field is provided
    const providedFields = [email, username, userId].filter(Boolean);
    if (providedFields.length === 0) {
      throw createHttpError(
        400,
        "One of email, username, or userId is required"
      );
    }
    if (providedFields.length > 1) {
      throw createHttpError(
        400,
        "Only one of email, username, or userId should be provided"
      );
    }

    // Find the user to invite
    const invitee = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        ...(email && { email }),
        ...(username && { username }),
        ...(userId && { id: userId }),
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!invitee) {
      throw createHttpError(404, "INVITE_003: User not found");
    }

    // Check if user is already a member
    const existingMembership = await prisma.userCommunity.findFirst({
      where: {
        userId: invitee.id,
        communityId,
        deletedAt: null,
      },
    });

    if (existingMembership) {
      throw createHttpError(409, "COMMUNITY_004: User already member");
    }

    // Check if there's already a pending invite
    const existingInvite = await prisma.communityInvite.findFirst({
      where: {
        communityId,
        inviteeId: invitee.id,
        status: "PENDING",
        deletedAt: null,
      },
    });

    if (existingInvite) {
      throw createHttpError(409, "COMMUNITY_005: Invitation already pending");
    }

    // Create the invite and log activity in a transaction
    const [invite] = await prisma.$transaction([
      prisma.communityInvite.create({
        data: {
          communityId,
          inviterId,
          inviteeId: invitee.id,
          status: "PENDING",
        },
        include: {
          invitee: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          inviter: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          type: "INVITE_SENT",
          userId: inviterId,
          communityId,
          metadata: {
            inviteeId: invitee.id,
            inviteeUsername: invitee.username,
          },
        },
      }),
    ]);

    res.status(201).json({
      id: invite.id,
      status: invite.status,
      createdAt: invite.createdAt,
      invitee: invite.invitee,
      inviter: invite.inviter,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// GET /api/communities/:communityId/invites
// List invitations for a community (MODERATOR only)
// =====================================
export const getInvites: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const { status } = req.query as GetInvitesQuery;
  const userCommunity = req.userCommunity;

  try {
    if (!userCommunity) {
      throw createHttpError(500, "Middleware memberOf required");
    }

    // Build status filter
    let statusFilter: { status?: InviteStatus } = {};
    if (status && status !== "all") {
      const validStatuses: InviteStatus[] = [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "CANCELLED",
      ];
      if (validStatuses.includes(status as InviteStatus)) {
        statusFilter = { status: status as InviteStatus };
      }
    } else if (!status) {
      // Default to PENDING
      statusFilter = { status: "PENDING" };
    }

    const invites = await prisma.communityInvite.findMany({
      where: {
        communityId,
        deletedAt: null,
        ...statusFilter,
      },
      include: {
        invitee: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      data: invites.map((invite) => ({
        id: invite.id,
        status: invite.status,
        createdAt: invite.createdAt,
        respondedAt: invite.respondedAt,
        invitee: invite.invitee,
        inviter: invite.inviter,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// DELETE /api/communities/:communityId/invites/:inviteId
// Cancel an invitation (MODERATOR only)
// =====================================
export const cancelInvite: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const inviteId = req.params.inviteId;
  const userId = req.session.userId;
  const userCommunity = req.userCommunity;

  try {
    assertIsDefine(userId);

    if (!userCommunity) {
      throw createHttpError(500, "Middleware memberOf required");
    }

    // Find the invite
    const invite = await prisma.communityInvite.findFirst({
      where: {
        id: inviteId,
        communityId,
        deletedAt: null,
      },
      include: {
        invitee: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!invite) {
      throw createHttpError(404, "INVITE_001: Invite not found");
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      throw createHttpError(400, "INVITE_002: Invite already processed");
    }

    // Cancel the invite and log activity in a transaction
    await prisma.$transaction([
      prisma.communityInvite.update({
        where: { id: inviteId },
        data: {
          status: "CANCELLED",
          respondedAt: new Date(),
        },
      }),
      prisma.activityLog.create({
        data: {
          type: "INVITE_CANCELLED",
          userId,
          communityId,
          metadata: {
            inviteId,
            inviteeId: invite.inviteeId,
            inviteeUsername: invite.invitee.username,
          },
        },
      }),
    ]);

    res.status(200).json({ message: "Invitation cancelled" });
  } catch (error) {
    next(error);
  }
};

// =====================================
// GET /api/users/me/invites
// Get my received invitations
// =====================================
export const getMyInvites: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  const { status } = req.query as GetMyInvitesQuery;

  try {
    assertIsDefine(userId);

    // Build status filter
    let statusFilter: { status?: InviteStatus } = {};
    if (status && status !== "all") {
      const validStatuses: InviteStatus[] = ["PENDING", "ACCEPTED", "REJECTED"];
      if (validStatuses.includes(status as InviteStatus)) {
        statusFilter = { status: status as InviteStatus };
      }
    } else if (!status) {
      // Default to PENDING
      statusFilter = { status: "PENDING" };
    }

    const invites = await prisma.communityInvite.findMany({
      where: {
        inviteeId: userId,
        deletedAt: null,
        ...statusFilter,
        community: {
          deletedAt: null,
        },
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      data: invites.map((invite) => ({
        id: invite.id,
        status: invite.status,
        createdAt: invite.createdAt,
        respondedAt: invite.respondedAt,
        community: invite.community,
        inviter: invite.inviter,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// POST /api/invites/:inviteId/accept
// Accept an invitation
// =====================================
export const acceptInvite: RequestHandler = async (req, res, next) => {
  const inviteId = req.params.inviteId;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    // Find the invite
    const invite = await prisma.communityInvite.findFirst({
      where: {
        id: inviteId,
        deletedAt: null,
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            description: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!invite) {
      throw createHttpError(404, "INVITE_001: Invite not found");
    }

    // Check if user is the invitee
    if (invite.inviteeId !== userId) {
      throw createHttpError(403, "Not authorized to accept this invitation");
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      throw createHttpError(400, "INVITE_002: Invite already processed");
    }

    // Check if community is not deleted
    if (invite.community.deletedAt) {
      throw createHttpError(404, "Community not found");
    }

    // Accept invite, create membership, and log activities in a transaction
    await prisma.$transaction([
      // Update invite status
      prisma.communityInvite.update({
        where: { id: inviteId },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      }),
      // Create membership
      prisma.userCommunity.create({
        data: {
          userId,
          communityId: invite.communityId,
          role: "MEMBER",
        },
      }),
      // Log invite accepted
      prisma.activityLog.create({
        data: {
          type: "INVITE_ACCEPTED",
          userId,
          communityId: invite.communityId,
          metadata: {
            inviteId,
            inviterId: invite.inviterId,
          },
        },
      }),
      // Log user joined
      prisma.activityLog.create({
        data: {
          type: "USER_JOINED",
          userId,
          communityId: invite.communityId,
          metadata: {
            method: "invitation",
            inviteId,
          },
        },
      }),
    ]);

    res.status(200).json({
      message: "Invitation accepted",
      community: {
        id: invite.community.id,
        name: invite.community.name,
        description: invite.community.description,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =====================================
// POST /api/invites/:inviteId/reject
// Reject an invitation
// =====================================
export const rejectInvite: RequestHandler = async (req, res, next) => {
  const inviteId = req.params.inviteId;
  const userId = req.session.userId;

  try {
    assertIsDefine(userId);

    // Find the invite
    const invite = await prisma.communityInvite.findFirst({
      where: {
        id: inviteId,
        deletedAt: null,
      },
    });

    if (!invite) {
      throw createHttpError(404, "INVITE_001: Invite not found");
    }

    // Check if user is the invitee
    if (invite.inviteeId !== userId) {
      throw createHttpError(403, "Not authorized to reject this invitation");
    }

    // Check if invite is still pending
    if (invite.status !== "PENDING") {
      throw createHttpError(400, "INVITE_002: Invite already processed");
    }

    // Reject invite and log activity in a transaction
    await prisma.$transaction([
      prisma.communityInvite.update({
        where: { id: inviteId },
        data: {
          status: "REJECTED",
          respondedAt: new Date(),
        },
      }),
      prisma.activityLog.create({
        data: {
          type: "INVITE_REJECTED",
          userId,
          communityId: invite.communityId,
          metadata: {
            inviteId,
            inviterId: invite.inviterId,
          },
        },
      }),
    ]);

    res.status(200).json({ message: "Invitation rejected" });
  } catch (error) {
    next(error);
  }
};

// Espaces (F-SPC-1), membres (F-SPC-4, F-SPC-5), transfert de propriete [D92],
// suppression, restauration et purge [D22].

import {
  MAX_OWNED_SPACES,
  SPACE_RESTORE_DAYS,
  type CreateSpaceBody,
  type Member,
  type OwnershipTransfer,
  type SpaceDetail,
  type SpaceSummary,
  type UpdateSpaceBody,
} from "@fm/shared";

import { recordActivity } from "../activity/service.ts";
import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";
import type { MemberLeftReason } from "../modules/hooks.ts";
import { activeMembers, managersOf } from "../notifications/recipients.ts";
import { notify } from "../notifications/service.ts";
import { authorize, loadAccess, requireSpacePermission } from "./access.ts";
import { imageUrl, toUserSummary } from "../storage/images.ts";
import { grantDefaultModules } from "./defaults.ts";

type Tx = Prisma.TransactionClient;
const DAY_MS = 24 * 60 * 60 * 1000;

// --- Lecture ---

const summarySelect = {
  id: true,
  kind: true,
  name: true,
  description: true,
  tintIndex: true,
  avatarKey: true,
  createdAt: true,
  deletedAt: true,
  purgeAfter: true,
  _count: { select: { memberships: { where: { leftAt: null } } } },
} as const;

type SummaryRow = Prisma.SpaceGetPayload<{ select: typeof summarySelect }>;

function toSummary(ctx: Context, row: SummaryRow, myRole: SpaceSummary["myRole"]): SpaceSummary {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    tintIndex: row.tintIndex,
    avatarUrl: imageUrl(ctx, row.avatarKey),
    myRole,
    memberCount: row._count.memberships,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    purgeAfter: row.purgeAfter?.toISOString() ?? null,
  };
}

/** Espaces actifs, plus ceux que je possede et qui sont encore restaurables. */
export async function listSpaces(ctx: Context, userId: string): Promise<SpaceSummary[]> {
  const memberships = await ctx.db.membership.findMany({
    where: {
      userId,
      leftAt: null,
      OR: [
        { space: { deletedAt: null } },
        { role: "OWNER", space: { purgeAfter: { gt: new Date() } } },
      ],
    },
    select: { role: true, space: { select: summarySelect } },
  });
  return memberships
    .map((m) => toSummary(ctx, m.space, m.role))
    .sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "PERSONAL" ? -1 : 1
    );
}

/** Modules accordes, actifs et proposes par la plateforme, dans l'ordre choisi [D131]. */
export async function activeModules(db: Context["db"] | Tx, spaceId: string) {
  const rows = await db.spaceModule.findMany({
    where: {
      spaceId,
      enabled: true,
      revokedAt: null,
      module: { status: { in: ["AVAILABLE", "BETA"] } },
    },
    orderBy: [{ sortOrder: "asc" }, { moduleCode: "asc" }],
    select: { moduleCode: true, sortOrder: true },
  });
  return rows.map((row) => ({ code: row.moduleCode, sortOrder: row.sortOrder }));
}

export async function getSpace(
  ctx: Context,
  spaceId: string,
  userId: string
): Promise<SpaceDetail> {
  const access = await requireSpacePermission(ctx.db, spaceId, userId, "space.view");
  const row = await ctx.db.space.findUniqueOrThrow({
    where: { id: spaceId },
    select: summarySelect,
  });
  return { ...toSummary(ctx, row, access.role), modules: await activeModules(ctx.db, spaceId) };
}

// --- Creation, modification ---

export async function ownedGroupCount(db: Context["db"] | Tx, userId: string): Promise<number> {
  return db.membership.count({
    where: { userId, role: "OWNER", leftAt: null, space: { kind: "GROUP", deletedAt: null } },
  });
}

async function assertCanOwnAnother(db: Context["db"] | Tx, userId: string): Promise<void> {
  if ((await ownedGroupCount(db, userId)) >= MAX_OWNED_SPACES) throw new AppError("SPACE_009");
}

export async function createSpace(
  ctx: Context,
  userId: string,
  body: CreateSpaceBody
): Promise<string> {
  return ctx.db.$transaction(async (tx) => {
    await assertCanOwnAnother(tx, userId);
    const space = await tx.space.create({
      data: {
        kind: "GROUP",
        name: body.name,
        description: body.description ?? null,
        tintIndex: body.tintIndex,
        memberships: { create: { userId, role: "OWNER" } },
      },
    });
    await grantDefaultModules(tx, space.id);
    return space.id;
  });
}

export async function updateSpace(
  ctx: Context,
  spaceId: string,
  userId: string,
  body: UpdateSpaceBody
): Promise<void> {
  const access = await requireSpacePermission(ctx.db, spaceId, userId, "space.update");
  // Espace perso : seule la teinte change (le nom suit le compte).
  if (
    access.space.kind === "PERSONAL" &&
    (body.name !== undefined || body.description !== undefined)
  ) {
    throw new AppError("SPACE_003");
  }
  await ctx.db.space.update({ where: { id: spaceId }, data: body });
}

// --- Suppression, restauration, purge [D22] ---

export async function softDelete(tx: Tx, spaceId: string): Promise<void> {
  const now = new Date();
  await tx.space.update({
    where: { id: spaceId },
    data: { deletedAt: now, purgeAfter: new Date(now.getTime() + SPACE_RESTORE_DAYS * DAY_MS) },
  });
  // Plus rien d'ouvert sur un espace masque.
  await tx.spaceInvitation.updateMany({
    where: { spaceId, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: now },
  });
  await tx.spaceOwnershipTransfer.updateMany({
    where: { spaceId, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: now },
  });
  await tx.spaceInviteLink.updateMany({
    where: { spaceId, revokedAt: null },
    data: { revokedAt: now },
  });
}

export async function deleteSpace(ctx: Context, spaceId: string, userId: string): Promise<void> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.delete");
  const recipients = await activeMembers(ctx.db, spaceId);
  const space = await ctx.db.space.findUniqueOrThrow({ where: { id: spaceId } });
  await ctx.db.$transaction((tx) => softDelete(tx, spaceId));
  // Espace masque : l'avis garde son nom sans pointer dessus (P14).
  await notify(ctx, {
    type: "core.space.deleted",
    recipients,
    actorId: userId,
    data: { spaceName: space.name },
  });
}

export async function restoreSpace(ctx: Context, spaceId: string, userId: string): Promise<void> {
  const access = await requireSpacePermission(ctx.db, spaceId, userId, "space.restore", {
    includeDeleted: true,
  });
  if (!access.space.deletedAt) throw new AppError("SPACE_016");
  if (!access.space.purgeAfter || access.space.purgeAfter.getTime() <= Date.now()) {
    throw new AppError("SPACE_017");
  }
  await ctx.db.$transaction(async (tx) => {
    await assertCanOwnAnother(tx, userId);
    await tx.space.update({ where: { id: spaceId }, data: { deletedAt: null, purgeAfter: null } });
  });
  await notify(ctx, {
    type: "core.space.restored",
    recipients: await activeMembers(ctx.db, spaceId),
    spaceId,
    actorId: userId,
  });
}

/** Purge definitive des espaces dont le delai est passe ; renvoie leur nombre. */
export async function purgeDeletedSpaces(ctx: Context): Promise<number> {
  const due = await ctx.db.space.findMany({
    where: { purgeAfter: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of due) {
    await ctx.db.$transaction(async (tx) => {
      for (const hook of ctx.hooks.onSpaceDeleted) await hook(tx, id);
      const bySpace = { where: { spaceId: id } };
      await tx.spaceOwnershipTransfer.deleteMany(bySpace);
      await tx.spaceInvitation.deleteMany(bySpace);
      await tx.spaceInviteLink.deleteMany(bySpace);
      await tx.moduleAccessRequest.deleteMany(bySpace);
      await tx.spaceModule.deleteMany(bySpace);
      await tx.membership.deleteMany(bySpace);
      await tx.space.delete({ where: { id } });
    });
  }
  return due.length;
}

// --- Membres ---

const userSummary = {
  select: { id: true, username: true, avatarKey: true, deletedAt: true },
} as const;

function toUser(ctx: Context, user: { id: string; username: string; avatarKey: string | null }) {
  return toUserSummary(ctx, user);
}

export async function listMembers(
  ctx: Context,
  spaceId: string,
  userId: string
): Promise<Member[]> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.members.view");
  const rows = await ctx.db.membership.findMany({
    where: { spaceId, leftAt: null },
    select: { role: true, joinedAt: true, user: userSummary },
    orderBy: [{ joinedAt: "asc" }],
  });
  const rank = { OWNER: 0, MODERATOR: 1, MEMBER: 2 } as const;
  return rows
    .sort((a, b) => rank[a.role] - rank[b.role])
    .map((row) => ({
      user: toUser(ctx, row.user),
      role: row.role,
      joinedAt: row.joinedAt.toISOString(),
    }));
}

async function activeMember(db: Context["db"] | Tx, spaceId: string, userId: string) {
  const membership = await db.membership.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
  });
  if (!membership || membership.leftAt) throw new AppError("SPACE_007");
  return membership;
}

/** Depart d'un membre : la ligne reste (historique, retour [D59]) ; ses offres en cours tombent. */
export async function endMembership(
  ctx: Context,
  tx: Tx,
  spaceId: string,
  userId: string,
  reason: MemberLeftReason
): Promise<void> {
  const now = new Date();
  await tx.membership.update({
    where: { spaceId_userId: { spaceId, userId } },
    data: { leftAt: now, role: "MEMBER", excludedAt: reason === "EXCLUDED" ? now : null },
  });
  await tx.spaceOwnershipTransfer.updateMany({
    where: { spaceId, status: "PENDING", OR: [{ toUserId: userId }, { fromUserId: userId }] },
    data: { status: "CANCELLED", respondedAt: now },
  });
  for (const hook of ctx.hooks.onMemberLeft) await hook(tx, { spaceId, userId, reason });
}

export async function changeRole(
  ctx: Context,
  spaceId: string,
  actorId: string,
  targetId: string,
  role: "MEMBER" | "MODERATOR"
): Promise<void> {
  await requireSpacePermission(ctx.db, spaceId, actorId, "space.members.role");
  if (targetId === actorId) throw new AppError("SPACE_019");
  const target = await activeMember(ctx.db, spaceId, targetId);
  // L'OWNER change seulement par transfert ; pas de "changement" vers le meme role.
  if (target.role === "OWNER" || target.role === role) throw new AppError("SPACE_008");
  await ctx.db.membership.update({ where: { id: target.id }, data: { role } });
}

/** Exclure [D53] : un moderateur exclut des MEMBER, seul l'OWNER exclut un MODERATOR. */
export async function excludeMember(
  ctx: Context,
  spaceId: string,
  actorId: string,
  targetId: string
): Promise<void> {
  const access = await loadAccess(ctx.db, spaceId, actorId);
  authorize(access, "space.members.exclude.member");
  if (targetId === actorId) throw new AppError("SPACE_019");
  const target = await activeMember(ctx.db, spaceId, targetId);
  if (target.role === "OWNER") throw new AppError("SPACE_002");
  if (target.role === "MODERATOR") authorize(access, "space.members.exclude.moderator");
  await ctx.db.$transaction((tx) => endMembership(ctx, tx, spaceId, targetId, "EXCLUDED"));
  // Il ne voit plus l'espace : l'avis en garde le nom sans pointer dessus.
  const space = await ctx.db.space.findUniqueOrThrow({ where: { id: spaceId } });
  await notify(ctx, {
    type: "core.member.excluded",
    recipients: [targetId],
    data: { spaceName: space.name },
  });
}

/**
 * Quitter [D06, D22] : l'OWNER transfere d'abord la propriete ; seul membre
 * restant, il confirme et l'espace est supprime (restaurable 30 jours).
 */
export async function leaveSpace(
  ctx: Context,
  spaceId: string,
  userId: string,
  confirmDeletion: boolean
): Promise<"left" | "deleted"> {
  const access = await requireSpacePermission(ctx.db, spaceId, userId, "space.leave");
  if (access.role === "OWNER") {
    const others = await ctx.db.membership.count({
      where: { spaceId, leftAt: null, NOT: { userId } },
    });
    if (others > 0) throw new AppError("SPACE_004");
    if (!confirmDeletion) throw new AppError("SPACE_005");
    // L'OWNER reste rattache a l'espace supprime pour pouvoir le restaurer.
    await ctx.db.$transaction((tx) => softDelete(tx, spaceId));
    return "deleted";
  }
  await ctx.db.$transaction((tx) => endMembership(ctx, tx, spaceId, userId, "LEFT"));
  await recordActivity(ctx, { spaceId, type: "core.member.left", actorId: userId });
  await notify(ctx, {
    type: "core.member.left",
    recipients: await managersOf(ctx.db, spaceId),
    spaceId,
    actorId: userId,
    groupKey: `core.member.left:${spaceId}`,
  });
  return "left";
}

// --- Transfert de propriete [D92] ---

const transferSelect = {
  id: true,
  spaceId: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  fromUser: userSummary,
  toUser: userSummary,
} as const;

type TransferRow = Prisma.SpaceOwnershipTransferGetPayload<{ select: typeof transferSelect }>;

function toTransfer(ctx: Context, row: TransferRow): OwnershipTransfer {
  return {
    id: row.id,
    spaceId: row.spaceId,
    fromUser: toUser(ctx, row.fromUser),
    toUser: toUser(ctx, row.toUser),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
  };
}

/** Transfert en attente de l'espace, visible par ses membres. */
export async function pendingTransfer(
  ctx: Context,
  spaceId: string,
  userId: string
): Promise<OwnershipTransfer | null> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.members.view");
  const row = await ctx.db.spaceOwnershipTransfer.findFirst({
    where: { spaceId, status: "PENDING" },
    select: transferSelect,
  });
  return row ? toTransfer(ctx, row) : null;
}

/** Transferts recus en attente (pour l'ecran des invitations, avant les notifications de C6). */
export async function myPendingTransfers(
  ctx: Context,
  userId: string
): Promise<OwnershipTransfer[]> {
  const rows = await ctx.db.spaceOwnershipTransfer.findMany({
    where: { toUserId: userId, status: "PENDING", space: { deletedAt: null } },
    select: transferSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toTransfer(ctx, row));
}

export async function proposeTransfer(
  ctx: Context,
  spaceId: string,
  ownerId: string,
  toUserId: string
): Promise<OwnershipTransfer> {
  await requireSpacePermission(ctx.db, spaceId, ownerId, "space.ownership.transfer");
  if (toUserId === ownerId) throw new AppError("SPACE_019");
  await activeMember(ctx.db, spaceId, toUserId);
  const existing = await ctx.db.spaceOwnershipTransfer.findFirst({
    where: { spaceId, status: "PENDING" },
  });
  if (existing) throw new AppError("SPACE_010");
  try {
    const row = await ctx.db.spaceOwnershipTransfer.create({
      data: { spaceId, fromUserId: ownerId, toUserId },
      select: transferSelect,
    });
    await notify(ctx, {
      type: "core.transfer.proposed",
      recipients: [toUserId],
      spaceId,
      actorId: ownerId,
      targetType: "transfer",
      targetId: row.id,
    });
    return toTransfer(ctx, row);
  } catch (error) {
    // Index partiel : une seule proposition en attente par espace (requetes concurrentes).
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("SPACE_010");
    }
    throw error;
  }
}

async function pendingTransferFor(db: Context["db"] | Tx, spaceId: string, transferId: string) {
  const transfer = await db.spaceOwnershipTransfer.findFirst({
    where: { id: transferId, spaceId, space: { deletedAt: null } },
  });
  if (!transfer) throw new AppError("SPACE_011");
  if (transfer.status !== "PENDING") throw new AppError("COMMON_006");
  return transfer;
}

export async function respondToTransfer(
  ctx: Context,
  spaceId: string,
  transferId: string,
  userId: string,
  accept: boolean
): Promise<void> {
  const ownerId = await ctx.db.$transaction(async (tx) => {
    const transfer = await pendingTransferFor(tx, spaceId, transferId);
    // Seul le destinataire repond ; pour les autres, la proposition n'existe pas.
    if (transfer.toUserId !== userId) throw new AppError("SPACE_011");
    const now = new Date();
    if (!accept) {
      await tx.spaceOwnershipTransfer.update({
        where: { id: transfer.id },
        data: { status: "DECLINED", respondedAt: now },
      });
      return transfer.fromUserId;
    }
    const owner = await activeMember(tx, spaceId, transfer.fromUserId);
    await activeMember(tx, spaceId, userId);
    if (owner.role !== "OWNER") throw new AppError("COMMON_006");
    await assertCanOwnAnother(tx, userId);
    // L'ancien OWNER devient MODERATOR avant la promotion (un seul OWNER actif).
    await tx.membership.update({ where: { id: owner.id }, data: { role: "MODERATOR" } });
    await tx.membership.update({
      where: { spaceId_userId: { spaceId, userId } },
      data: { role: "OWNER" },
    });
    await tx.spaceOwnershipTransfer.update({
      where: { id: transfer.id },
      data: { status: "ACCEPTED", respondedAt: now },
    });
    return transfer.fromUserId;
  });
  await notify(ctx, {
    type: accept ? "core.transfer.accepted" : "core.transfer.declined",
    recipients: [ownerId],
    spaceId,
    actorId: userId,
  });
}

export async function cancelTransfer(
  ctx: Context,
  spaceId: string,
  transferId: string,
  ownerId: string
): Promise<void> {
  await requireSpacePermission(ctx.db, spaceId, ownerId, "space.ownership.transfer");
  const transfer = await pendingTransferFor(ctx.db, spaceId, transferId);
  await ctx.db.spaceOwnershipTransfer.update({
    where: { id: transfer.id },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
}

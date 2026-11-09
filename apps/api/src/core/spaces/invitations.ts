// Invitations (F-SPC-2, F-SPC-3) : liens d'invitation [D07, D94, D62] et
// invitations par username exact [D07, D50].
//
// Non-enumeration : inviter un username renvoie la meme reponse que le compte
// existe, soit deja membre ou deja invite, ou n'existe pas. Un code de lien
// inconnu, expire, revoque ou epuise repond SPACE_014 sans rien montrer.

import {
  type CreateInviteLinkBody,
  type CreatedInviteLink,
  type Invitation,
  type InviteLink,
  type InviteLinkPreview,
} from "@fm/shared";
import { randomBytes } from "node:crypto";

import { hashToken } from "../auth/tokens.ts";
import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";
import { recordActivity } from "../activity/service.ts";
import { managersOf } from "../notifications/recipients.ts";
import { notify } from "../notifications/service.ts";
import { imageUrl, toUserSummary } from "../storage/images.ts";
import { requireSpacePermission } from "./access.ts";

type Tx = Prisma.TransactionClient;
const DAY_MS = 24 * 60 * 60 * 1000;

const userSummary = { select: { id: true, username: true, avatarKey: true } } as const;

function toUser(ctx: Context, user: { id: string; username: string; avatarKey: string | null }) {
  return toUserSummary(ctx, user);
}

// --- Rejoindre (commun aux liens et aux invitations) ---

/**
 * Fait entrer un utilisateur dans un espace groupe. Un ancien membre retrouve
 * sa ligne (et ses droits d'auteur [D59]) ; l'exclusion est effacee. Les
 * invitations directes en attente pour cet espace sont considerees acceptees.
 */
async function addToSpace(tx: Tx, spaceId: string, userId: string): Promise<void> {
  const now = new Date();
  const existing = await tx.membership.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
  });
  if (existing && !existing.leftAt) throw new AppError("SPACE_006");
  if (existing) {
    await tx.membership.update({
      where: { id: existing.id },
      data: { leftAt: null, excludedAt: null, role: "MEMBER", joinedAt: now },
    });
  } else {
    await tx.membership.create({ data: { spaceId, userId, role: "MEMBER" } });
  }
  await tx.spaceInvitation.updateMany({
    where: { spaceId, inviteeId: userId, status: "PENDING" },
    data: { status: "ACCEPTED", respondedAt: now },
  });
}

// --- Liens d'invitation ---

const linkSelect = {
  id: true,
  expiresAt: true,
  maxUses: true,
  useCount: true,
  revokedAt: true,
  createdAt: true,
  createdBy: userSummary,
} as const;

type LinkRow = Prisma.SpaceInviteLinkGetPayload<{ select: typeof linkSelect }>;

function toLink(ctx: Context, row: LinkRow): InviteLink {
  return {
    id: row.id,
    createdBy: toUser(ctx, row.createdBy),
    expiresAt: row.expiresAt.toISOString(),
    maxUses: row.maxUses,
    useCount: row.useCount,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Liens encore utilisables de l'espace (ni revoques, ni expires, ni epuises). */
export async function listInviteLinks(
  ctx: Context,
  spaceId: string,
  userId: string
): Promise<InviteLink[]> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.invites.manage");
  const rows = await ctx.db.spaceInviteLink.findMany({
    where: { spaceId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: linkSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows
    .filter((row) => row.maxUses === null || row.useCount < row.maxUses)
    .map((row) => toLink(ctx, row));
}

/** Cree un lien ; le code (128 bits) n'est renvoye qu'ici, seul son hash est stocke. */
export async function createInviteLink(
  ctx: Context,
  spaceId: string,
  userId: string,
  body: CreateInviteLinkBody
): Promise<CreatedInviteLink> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.invites.manage");
  const code = randomBytes(16).toString("base64url");
  const row = await ctx.db.spaceInviteLink.create({
    data: {
      spaceId,
      createdById: userId,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + body.expiresInDays * DAY_MS),
      maxUses: body.maxUses,
    },
    select: linkSelect,
  });
  return { ...toLink(ctx, row), code };
}

export async function revokeInviteLink(
  ctx: Context,
  spaceId: string,
  linkId: string,
  userId: string
): Promise<void> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.invites.manage");
  const { count } = await ctx.db.spaceInviteLink.updateMany({
    where: { id: linkId, spaceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) {
    const exists = await ctx.db.spaceInviteLink.count({ where: { id: linkId, spaceId } });
    throw new AppError(exists > 0 ? "COMMON_006" : "SPACE_018");
  }
}

/** Lien utilisable par son code, sinon SPACE_014 (sans distinguer pourquoi). */
async function usableLink(db: Context["db"] | Tx, code: string) {
  const link = await db.spaceInviteLink.findUnique({
    where: { codeHash: hashToken(code) },
    select: {
      id: true,
      spaceId: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      revokedAt: true,
      space: { select: { kind: true, deletedAt: true } },
    },
  });
  if (
    !link ||
    link.revokedAt ||
    link.expiresAt.getTime() <= Date.now() ||
    (link.maxUses !== null && link.useCount >= link.maxUses) ||
    link.space.deletedAt ||
    link.space.kind !== "GROUP"
  ) {
    throw new AppError("SPACE_014");
  }
  return link;
}

/** Apercu public avant de rejoindre [D62] : nom, teinte, nombre de membres. */
export async function previewInviteLink(ctx: Context, code: string): Promise<InviteLinkPreview> {
  const link = await usableLink(ctx.db, code);
  const space = await ctx.db.space.findUniqueOrThrow({
    where: { id: link.spaceId },
    select: {
      name: true,
      tintIndex: true,
      avatarKey: true,
      _count: { select: { memberships: { where: { leftAt: null } } } },
    },
  });
  return {
    space: {
      name: space.name,
      tintIndex: space.tintIndex,
      avatarUrl: imageUrl(ctx, space.avatarKey),
      memberCount: space._count.memberships,
    },
    expiresAt: link.expiresAt.toISOString(),
  };
}

/** Rejoindre par un lien ; renvoie l'espace. Un membre exclu ne revient pas par un lien [D149]. */
export async function joinByLink(ctx: Context, code: string, userId: string): Promise<string> {
  const spaceId = await ctx.db.$transaction(async (tx) => {
    const link = await usableLink(tx, code);
    const membership = await tx.membership.findUnique({
      where: { spaceId_userId: { spaceId: link.spaceId, userId } },
      select: { leftAt: true, excludedAt: true },
    });
    if (membership && !membership.leftAt) throw new AppError("SPACE_006");
    if (membership?.excludedAt) throw new AppError("SPACE_015");
    // Compteur incremente sous condition : deux arrivees simultanees ne depassent pas maxUses.
    const consumed = await tx.$executeRaw`
      UPDATE "SpaceInviteLink" SET "useCount" = "useCount" + 1
      WHERE "id" = ${link.id} AND "revokedAt" IS NULL AND "expiresAt" > now()
        AND ("maxUses" IS NULL OR "useCount" < "maxUses")`;
    if (consumed !== 1) throw new AppError("SPACE_014");
    await addToSpace(tx, link.spaceId, userId);
    return link.spaceId;
  });
  await memberJoined(ctx, spaceId, userId);
  return spaceId;
}

// --- Invitations par username ---

const invitationSelect = {
  id: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  space: { select: { id: true, name: true, tintIndex: true, avatarKey: true } },
  inviter: userSummary,
  invitee: userSummary,
} as const;

type InvitationRow = Prisma.SpaceInvitationGetPayload<{ select: typeof invitationSelect }>;

function toInvitation(ctx: Context, row: InvitationRow): Invitation {
  return {
    id: row.id,
    space: {
      id: row.space.id,
      name: row.space.name,
      tintIndex: row.space.tintIndex,
      avatarUrl: imageUrl(ctx, row.space.avatarKey),
    },
    inviter: toUser(ctx, row.inviter),
    invitee: toUser(ctx, row.invitee),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
  };
}

/**
 * Invite par username exact (sans tenir compte de la casse). Meme issue pour un
 * compte inconnu, supprime, deja membre ou deja invite : rien n'est revele.
 * Un membre exclu peut etre invite : c'est sa seule voie de retour [D53].
 */
export async function inviteByUsername(
  ctx: Context,
  spaceId: string,
  inviterId: string,
  username: string
): Promise<void> {
  await requireSpacePermission(ctx.db, spaceId, inviterId, "space.invites.manage");
  const invitee = await ctx.db.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, deletedAt: null },
    select: { id: true },
  });
  if (!invitee) return;
  const membership = await ctx.db.membership.findUnique({
    where: { spaceId_userId: { spaceId, userId: invitee.id } },
    select: { leftAt: true },
  });
  if (membership && !membership.leftAt) return;
  // Index partiel : une seule invitation PENDING par (espace, invite) ; un doublon est ignore.
  const inserted = await ctx.db.$executeRaw`
    INSERT INTO "SpaceInvitation" ("id", "spaceId", "inviterId", "inviteeId")
    VALUES (gen_random_uuid(), ${spaceId}, ${inviterId}, ${invitee.id})
    ON CONFLICT ("spaceId", "inviteeId") WHERE "status" = 'PENDING' DO NOTHING`;
  if (inserted === 0) return;
  // Pas encore membre : l'avis ne pointe pas sur l'espace, il en garde le nom (P02).
  const space = await ctx.db.space.findUniqueOrThrow({ where: { id: spaceId } });
  await notify(ctx, {
    type: "core.invitation.received",
    recipients: [invitee.id],
    actorId: inviterId,
    data: { spaceName: space.name },
  });
}

/** Invitations en attente envoyees par l'espace (pour les annuler). */
export async function listSpaceInvitations(
  ctx: Context,
  spaceId: string,
  userId: string
): Promise<Invitation[]> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.invites.manage");
  const rows = await ctx.db.spaceInvitation.findMany({
    where: { spaceId, status: "PENDING" },
    select: invitationSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toInvitation(ctx, row));
}

export async function cancelInvitation(
  ctx: Context,
  spaceId: string,
  invitationId: string,
  userId: string
): Promise<void> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.invites.manage");
  const invitation = await ctx.db.spaceInvitation.findFirst({
    where: { id: invitationId, spaceId },
    select: { status: true },
  });
  if (!invitation) throw new AppError("SPACE_012");
  const { count } = await ctx.db.spaceInvitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
  if (count === 0) throw new AppError("COMMON_006");
}

/** Invitations recues en attente (avant le centre de notifications de C6). */
export async function myInvitations(ctx: Context, userId: string): Promise<Invitation[]> {
  const rows = await ctx.db.spaceInvitation.findMany({
    where: { inviteeId: userId, status: "PENDING", space: { deletedAt: null } },
    select: invitationSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toInvitation(ctx, row));
}

/** Accepter (renvoie l'espace) ou refuser ; seul l'invite voit son invitation. */
export async function respondToInvitation(
  ctx: Context,
  invitationId: string,
  userId: string,
  accept: boolean
): Promise<string> {
  const result = await ctx.db.$transaction(async (tx) => {
    const invitation = await tx.spaceInvitation.findFirst({
      where: { id: invitationId, inviteeId: userId, space: { deletedAt: null } },
      select: { status: true, spaceId: true },
    });
    if (!invitation) throw new AppError("SPACE_012");
    if (invitation.status !== "PENDING") throw new AppError("COMMON_006");
    if (accept) {
      // addToSpace marque l'invitation acceptee.
      await addToSpace(tx, invitation.spaceId, userId);
    } else {
      await tx.spaceInvitation.update({
        where: { id: invitationId },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
    }
    return invitation.spaceId;
  });
  if (accept) await memberJoined(ctx, result, userId);
  return result;
}

/** Arrivee (lien ou invitation) : OWNER et moderateurs prevenus, activite de l'espace (P03). */
async function memberJoined(ctx: Context, spaceId: string, userId: string): Promise<void> {
  await recordActivity(ctx, { spaceId, type: "core.member.joined", actorId: userId });
  await notify(ctx, {
    type: "core.member.joined",
    recipients: await managersOf(ctx.db, spaceId),
    spaceId,
    actorId: userId,
    groupKey: `core.member.joined:${spaceId}`,
  });
}

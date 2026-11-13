// Suppression du compte (F-ACC-5) : anonymisation [D20], depart de tous les
// espaces, transfert automatique de propriete [D51], espace perso supprime.
// Les consequences sont calculees avant, pour l'ecran de confirmation [D116].

import { MAX_OWNED_SPACES, type AccountDeletionPreview, type DeleteAccountBody } from "@fm/shared";

import type { Context } from "../context.ts";
import { Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";
import { imageUrl } from "../storage/images.ts";
import { endMembership, ownedGroupCount, softDelete } from "../spaces/service.ts";
import { destroyUserSessions } from "./session.ts";

type Tx = Context["db"] | Prisma.TransactionClient;
type Plan = AccountDeletionPreview["spaces"][number];

/**
 * Futur OWNER : MODERATOR le plus ancien, sinon MEMBER le plus ancien [D51],
 * en sautant ceux qui possedent deja le maximum d'espaces. Si tous sont au
 * plafond, le premier herite quand meme (le plafond freine les abus, il ne doit
 * pas faire disparaitre l'espace de ses membres).
 */
async function findSuccessor(db: Tx, spaceId: string, ownerId: string) {
  const candidates = await db.membership.findMany({
    where: { spaceId, leftAt: null, NOT: { userId: ownerId } },
    select: { role: true, user: { select: { id: true, username: true, avatarKey: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const ordered = [
    ...candidates.filter((c) => c.role === "MODERATOR"),
    ...candidates.filter((c) => c.role === "MEMBER"),
  ];
  for (const candidate of ordered) {
    if ((await ownedGroupCount(db, candidate.user.id)) < MAX_OWNED_SPACES) return candidate.user;
  }
  return ordered[0]?.user ?? null;
}

/** `url` : URL d'une image (aucune pendant la suppression elle-meme). */
async function plan(
  db: Tx,
  userId: string,
  url: (key: string | null) => string | null = () => null
): Promise<Plan[]> {
  const memberships = await db.membership.findMany({
    where: { userId, leftAt: null, space: { kind: "GROUP", deletedAt: null } },
    select: {
      role: true,
      space: { select: { id: true, name: true, tintIndex: true, avatarKey: true } },
    },
    orderBy: { space: { name: "asc" } },
  });
  const plans: Plan[] = [];
  for (const { role, space } of memberships) {
    const successor = role === "OWNER" ? await findSuccessor(db, space.id, userId) : null;
    plans.push({
      space: {
        id: space.id,
        name: space.name,
        tintIndex: space.tintIndex,
        avatarUrl: url(space.avatarKey),
      },
      role,
      outcome: role !== "OWNER" ? "LEFT" : successor ? "TRANSFERRED" : "DELETED",
      newOwner: successor
        ? { id: successor.id, username: successor.username, avatarUrl: url(successor.avatarKey) }
        : null,
    });
  }
  return plans;
}

export async function previewDeletion(
  ctx: Context,
  userId: string
): Promise<AccountDeletionPreview> {
  return { spaces: await plan(ctx.db, userId, (key) => imageUrl(ctx, key)) };
}

/**
 * Confirmation : le mot de passe ; un compte sans mot de passe (Discord) tape
 * son nom d'utilisateur, sans tenir compte de la casse [D210].
 */
export async function deleteAccount(
  ctx: Context,
  userId: string,
  confirmation: DeleteAccountBody
): Promise<void> {
  const user = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError("AUTH_001");
  if (user.passwordHash) {
    if (!(await ctx.hasher.verify(user.passwordHash, confirmation.password ?? ""))) {
      throw new AppError("AUTH_005");
    }
  } else if (confirmation.username?.toLowerCase() !== user.username.toLowerCase()) {
    throw new AppError("AUTH_018");
  }

  await ctx.db.$transaction(async (tx) => {
    const now = new Date();
    for (const item of await plan(tx, userId)) {
      const spaceId = item.space.id;
      if (item.outcome === "DELETED") await softDelete(tx, spaceId);
      // Le depart rend l'ancien OWNER MEMBER : l'heritier peut ensuite etre promu (un seul OWNER).
      await endMembership(ctx, tx, spaceId, userId, "ACCOUNT_DELETED");
      if (item.newOwner) {
        await tx.membership.update({
          where: { spaceId_userId: { spaceId, userId: item.newOwner.id } },
          data: { role: "OWNER" },
        });
      }
    }
    // Espaces groupe deja supprimes : plus personne pour les restaurer.
    await tx.membership.updateMany({
      where: { userId, leftAt: null, space: { kind: "GROUP" } },
      data: { leftAt: now, role: "MEMBER" },
    });
    // Espace perso : purge a la prochaine tache horaire (crochets des modules [D83]).
    await tx.space.updateMany({
      where: { personalUserId: userId },
      data: { deletedAt: now, purgeAfter: now },
    });
    // Plus rien d'ouvert a son nom.
    await tx.spaceInvitation.updateMany({
      where: { status: "PENDING", OR: [{ inviterId: userId }, { inviteeId: userId }] },
      data: { status: "CANCELLED", respondedAt: now },
    });
    await tx.spaceOwnershipTransfer.updateMany({
      where: { status: "PENDING", OR: [{ fromUserId: userId }, { toUserId: userId }] },
      data: { status: "CANCELLED", respondedAt: now },
    });
    await tx.spaceInviteLink.updateMany({
      where: { createdById: userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.moduleAccessRequest.updateMany({
      where: { requestedById: userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    await tx.authToken.deleteMany({ where: { userId } });
    // Ses exports : lignes supprimees, archives effacees par le menage du stockage.
    await tx.dataExport.deleteMany({ where: { requestedById: userId } });
    // Anonymisation [D20] : username et email liberes, connexion impossible.
    await tx.user.update({
      where: { id: userId },
      data: {
        username: `deleted-${userId}`,
        email: `deleted-${userId}@invalid`,
        passwordHash: null,
        discordId: null,
        discordUsername: null,
        emailVerifiedAt: null,
        avatarKey: null,
        homeWidgets: Prisma.DbNull,
        lastLoginAt: null,
        deletedAt: now,
      },
    });
  });
  await destroyUserSessions(ctx.db, userId);
}

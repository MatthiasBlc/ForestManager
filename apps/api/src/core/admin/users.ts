// Admin, utilisateurs (C4.4) : le compte seulement, jamais le contenu ; pas de
// connexion a la place d'un utilisateur. Mot de passe temporaire [D134] : genere
// ici, transmis par l'admin lui-meme, 24 h, il ouvre une session restreinte au
// choix d'un nouveau mot de passe (core/auth/service.ts).

import { randomInt } from "node:crypto";

import { INACTIVE_MONTHS, type AdminUser, type AdminUserFilter } from "@fm/shared";

import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";
import { imageUrl } from "../storage/images.ts";
import { audit } from "./audit.ts";

export const TEMPORARY_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

/** Mots courts sans accents, faciles a dicter (64 mots). */
const WORDS = [
  "tison",
  "cendre",
  "braise",
  "houx",
  "chene",
  "erable",
  "fougere",
  "mousse",
  "lichen",
  "ruisseau",
  "riviere",
  "falaise",
  "colline",
  "prairie",
  "bruyere",
  "genet",
  "noisette",
  "chataigne",
  "myrtille",
  "airelle",
  "framboise",
  "mirabelle",
  "prune",
  "cerise",
  "hibou",
  "renard",
  "blaireau",
  "loutre",
  "castor",
  "herisson",
  "ecureuil",
  "chevreuil",
  "sapin",
  "meleze",
  "bouleau",
  "saule",
  "tilleul",
  "platane",
  "cedre",
  "pin",
  "aube",
  "zephyr",
  "brume",
  "givre",
  "neige",
  "orage",
  "averse",
  "rosee",
  "galet",
  "sable",
  "argile",
  "silex",
  "granit",
  "ardoise",
  "quartz",
  "basalte",
  "lanterne",
  "boussole",
  "sentier",
  "cabane",
  "refuge",
  "clairiere",
  "vallon",
  "torrent",
];

/** "tison-7342-cendre-houx" : trois mots et quatre chiffres, environ 31 bits. */
export function generateTemporaryPassword(): string {
  const word = () => WORDS[randomInt(WORDS.length)] ?? "foret";
  const digits = String(randomInt(10_000)).padStart(4, "0");
  return `${word()}-${digits}-${word()}-${word()}`;
}

function inactiveSince(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - INACTIVE_MONTHS);
  return date;
}

const activeGroupMembership = {
  leftAt: null,
  excludedAt: null,
  space: { kind: "GROUP", deletedAt: null },
} satisfies Prisma.MembershipWhereInput;

export async function listUsers(
  ctx: Context,
  options: { filter: AdminUserFilter; query?: string; offset: number; limit: number }
): Promise<{ data: AdminUser[]; total: number }> {
  const since = inactiveSince();
  const query = options.query?.trim();
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query
      ? {
          OR: [
            { username: { contains: query, mode: "insensitive" } },
            { email: { contains: query.toLowerCase() } },
          ],
        }
      : {}),
    ...(options.filter === "OWNERS"
      ? { memberships: { some: { ...activeGroupMembership, role: "OWNER" } } }
      : {}),
    ...(options.filter === "INACTIVE"
      ? {
          AND: [
            {
              OR: [{ lastLoginAt: { lt: since } }, { lastLoginAt: null, createdAt: { lt: since } }],
            },
          ],
        }
      : {}),
  };
  const now = new Date();
  const [rows, total] = await Promise.all([
    ctx.db.user.findMany({
      where,
      orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: options.offset,
      take: options.limit,
      include: {
        memberships: {
          where: activeGroupMembership,
          orderBy: { joinedAt: "asc" },
          include: { space: { select: { name: true } } },
        },
        authTokens: {
          where: { kind: "TEMP_PASSWORD", usedAt: null, expiresAt: { gt: now } },
          select: { id: true },
        },
      },
    }),
    ctx.db.user.count({ where }),
  ]);
  return {
    data: rows.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: imageUrl(ctx, user.avatarKey),
      spaces: user.memberships.map((m) => ({ name: m.space.name, owner: m.role === "OWNER" })),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      temporaryPasswordPending: user.authTokens.length > 0,
      discord: user.discordId !== null,
      hasPassword: Boolean(user.passwordHash),
    })),
    total,
  };
}

/**
 * Nouveau mot de passe temporaire : remplace un temporaire encore inutilise.
 * Seul son hash (argon2id) est garde ; le mot de passe n'est renvoye qu'ici.
 */
export async function issueTemporaryPassword(
  ctx: Context,
  adminId: string,
  userId: string
): Promise<{ password: string; expiresAt: string }> {
  const user = await ctx.db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new AppError("ADMIN_008");
  const password = generateTemporaryPassword();
  const tokenHash = await ctx.hasher.hash(password);
  const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS);
  await ctx.db.$transaction(async (tx) => {
    await tx.authToken.deleteMany({ where: { userId, kind: "TEMP_PASSWORD", usedAt: null } });
    await tx.authToken.create({ data: { userId, kind: "TEMP_PASSWORD", tokenHash, expiresAt } });
    await audit(tx, {
      adminId,
      action: "user.temporary-password",
      targetType: "user",
      targetId: userId,
      data: { username: user.username },
    });
  });
  return { password, expiresAt: expiresAt.toISOString() };
}

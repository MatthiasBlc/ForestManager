// Comptes et Discord [D202, D210] : connexion d'un compte relie, inscription
// confirmee, liaison et deliaison. Jamais de liaison automatique par email.
import {
  IMAGE_MAX_SIDE,
  USERNAME_MAX,
  USERNAME_MIN,
  type DiscordPending,
  type DiscordRegisterBody,
} from "@fm/shared";
import { randomUUID } from "node:crypto";

import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { notify } from "../notifications/service.ts";
import { IMAGE_CONTENT_TYPES, IMAGE_EXTENSIONS, readImageInfo } from "../storage/image-format.ts";
import type { DiscordProfile } from "./discord.ts";
import { createAccount, findActiveUser, findByUsername, PASSWORD_REMINDER } from "./service.ts";

/** Compte actif relie a ce Discord (nom Discord rafraichi), ou null. */
export async function signIn(ctx: Context, profile: DiscordProfile): Promise<string | null> {
  const user = await ctx.db.user.findFirst({
    where: { discordId: profile.id, deletedAt: null },
    select: { id: true },
  });
  if (!user) return null;
  await ctx.db.user.update({
    where: { id: user.id },
    data: { discordUsername: profile.username, lastLoginAt: new Date() },
  });
  return user.id;
}

/** Nom Discord ramene aux regles des noms d'utilisateur, puis rendu libre. */
export async function proposeUsername(ctx: Context, discordUsername: string): Promise<string> {
  let base = discordUsername.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, USERNAME_MAX);
  if (/^_*$/.test(base)) base = "cuisinier";
  base = base.padEnd(USERNAME_MIN, "_");
  if (!(await findByUsername(ctx, base))) return base;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = String(n);
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
    if (!(await findByUsername(ctx, candidate))) return candidate;
  }
  return `${base.slice(0, USERNAME_MAX - 8)}${randomUUID().slice(0, 8)}`;
}

/** Ce que montre E-INSCRIPTION-DISCORD. */
export async function pendingView(ctx: Context, profile: DiscordProfile): Promise<DiscordPending> {
  const verified = profile.verified && profile.email !== null;
  return {
    username: await proposeUsername(ctx, profile.username),
    email: verified ? profile.email : null,
    emailVerified: verified,
    discordUsername: profile.username,
  };
}

/**
 * Cree le compte confirme : sans mot de passe, email verifie s'il est celui
 * que Discord a verifie, avatar Discord copie une fois.
 */
export async function register(
  ctx: Context,
  profile: DiscordProfile,
  body: DiscordRegisterBody
): Promise<string> {
  const linked = await ctx.db.user.findFirst({
    where: { discordId: profile.id },
    select: { id: true },
  });
  if (linked) throw new AppError("AUTH_016");
  const emailVerified =
    profile.verified && profile.email !== null && profile.email.toLowerCase() === body.email;
  const userId = await createAccount(ctx, {
    email: body.email,
    username: body.username,
    passwordHash: null,
    emailVerified,
    discord: { id: profile.id, username: profile.username },
  });
  await notify(ctx, { type: PASSWORD_REMINDER, recipients: [userId] });
  await importAvatar(ctx, userId, profile);
  return userId;
}

/** Copie l'avatar Discord ; un echec est journalise et sans effet. */
async function importAvatar(ctx: Context, userId: string, profile: DiscordProfile): Promise<void> {
  if (!ctx.storage || !ctx.discord || !profile.avatar) return;
  try {
    const file = await ctx.discord.fetchAvatar(profile);
    const info = file ? readImageInfo(file) : null;
    const maxSide = IMAGE_MAX_SIDE.avatar;
    if (!file || !info || info.width > maxSide || info.height > maxSide) return;
    const key = `users/${userId}/${randomUUID()}.${IMAGE_EXTENSIONS[info.format]}`;
    await ctx.storage.put(key, file, IMAGE_CONTENT_TYPES[info.format]);
    await ctx.db.user.update({ where: { id: userId }, data: { avatarKey: key } });
  } catch (error) {
    ctx.logger.warn({ err: error }, "discord avatar not imported");
  }
}

/** Relie Discord au compte connecte ; AUTH_016 s'il est relie a un autre compte. */
export async function link(ctx: Context, userId: string, profile: DiscordProfile): Promise<void> {
  await findActiveUser(ctx, userId);
  const other = await ctx.db.user.findFirst({
    where: { discordId: profile.id, NOT: { id: userId } },
    select: { id: true },
  });
  if (other) throw new AppError("AUTH_016");
  try {
    await ctx.db.user.update({
      where: { id: userId },
      data: { discordId: profile.id, discordUsername: profile.username },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("AUTH_016");
    }
    throw error;
  }
}

/** Delie Discord ; AUTH_017 sans mot de passe (le compte deviendrait inaccessible). */
export async function unlink(ctx: Context, userId: string): Promise<void> {
  const user = await findActiveUser(ctx, userId);
  if (!user.passwordHash) throw new AppError("AUTH_017");
  await ctx.db.user.update({
    where: { id: userId },
    data: { discordId: null, discordUsername: null },
  });
}

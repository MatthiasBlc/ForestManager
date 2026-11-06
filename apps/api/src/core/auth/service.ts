// Comptes (F-ACC-1 a F-ACC-4) : inscription, connexion, profil, mot de passe,
// preferences, emails optionnels [D21].

import type {
  ChangePasswordBody,
  Me,
  RegisterBody,
  UpdatePreferencesBody,
  UpdateProfileBody,
} from "@fm/shared";

import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { imageUrl } from "../storage/images.ts";
import { resetPasswordMail, verifyEmailMail, type MailMessage } from "../mail/mailer.ts";
import { grantDefaultModules } from "../spaces/defaults.ts";
import { assertStrongPassword } from "./password.ts";
import { destroyUserSessions } from "./session.ts";
import { consumeToken, issueToken } from "./tokens.ts";

type UserRow = NonNullable<Awaited<ReturnType<Context["db"]["user"]["findUnique"]>>>;

function emailLocalPart(email: string): string {
  return email.split("@")[0] ?? "";
}

async function findActiveUser(ctx: Context, userId: string): Promise<UserRow> {
  const user = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError("AUTH_001");
  return user;
}

async function findByUsername(ctx: Context, username: string) {
  return ctx.db.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, deletedAt: null },
  });
}

/** Verifie qu'aucun autre compte n'a ce username ou cet email. */
async function assertAvailable(
  ctx: Context,
  values: { username?: string; email?: string },
  selfId?: string
): Promise<void> {
  if (values.username !== undefined) {
    const taken = await ctx.db.user.findFirst({
      where: { username: { equals: values.username, mode: "insensitive" }, NOT: { id: selfId } },
      select: { id: true },
    });
    if (taken) throw new AppError("AUTH_003");
  }
  if (values.email !== undefined) {
    const taken = await ctx.db.user.findFirst({
      where: { email: values.email, NOT: { id: selfId } },
      select: { id: true },
    });
    if (taken) throw new AppError("AUTH_004");
  }
}

/** Contrainte d'unicite levee malgre la verification (requetes concurrentes). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function sendMail(ctx: Context, message: MailMessage): Promise<void> {
  if (!ctx.mailer) return;
  try {
    await ctx.mailer.send(message);
  } catch (error) {
    // Un SMTP en panne ne doit pas faire echouer l'action de l'utilisateur.
    ctx.logger.error({ err: error }, "mail not sent");
  }
}

async function sendVerification(ctx: Context, user: Pick<UserRow, "id" | "email" | "username">) {
  if (!ctx.mailer) return;
  const token = await issueToken(ctx.db, user.id, "VERIFY_EMAIL");
  const url = new URL(`/verify-email?token=${token}`, ctx.env.APP_URL).toString();
  await sendMail(ctx, verifyEmailMail(user.email, user.username, url));
}

export async function getMe(ctx: Context, userId: string): Promise<Me> {
  const user = await findActiveUser(ctx, userId);
  const space = await ctx.db.space.findUnique({
    where: { personalUserId: user.id },
    select: { id: true },
  });
  if (!space) throw new Error(`personal space missing for user ${user.id}`);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    emailVerified: user.emailVerifiedAt !== null,
    avatarUrl: imageUrl(ctx, user.avatarKey),
    personalSpaceId: space.id,
    preferences: {
      ambiance: user.ambiance,
      colorMode: user.colorMode,
      density: user.density,
      textScale: user.textScale as Me["preferences"]["textScale"],
      locale: user.locale as Me["preferences"]["locale"],
    },
    createdAt: user.createdAt.toISOString(),
  };
}

/** Cree le compte, son espace perso et ses modules par defaut, en une transaction. */
export async function register(ctx: Context, body: RegisterBody): Promise<string> {
  assertStrongPassword(body.password, [body.username, emailLocalPart(body.email)]);
  await assertAvailable(ctx, { username: body.username, email: body.email });
  const passwordHash = await ctx.hasher.hash(body.password);
  try {
    const user = await ctx.db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: body.email, username: body.username, passwordHash },
      });
      const space = await tx.space.create({
        data: {
          kind: "PERSONAL",
          name: created.username,
          personalUserId: created.id,
          memberships: { create: { userId: created.id, role: "OWNER" } },
        },
      });
      await grantDefaultModules(tx, space.id);
      return created;
    });
    await sendVerification(ctx, user);
    return user.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await assertAvailable(ctx, { username: body.username, email: body.email });
    throw error;
  }
}

/** Identifiants valides -> id du compte ; sinon AUTH_002, sans dire lequel est faux. */
export async function authenticate(
  ctx: Context,
  identifier: string,
  password: string
): Promise<string> {
  const user = identifier.includes("@")
    ? await ctx.db.user.findFirst({ where: { email: identifier.toLowerCase(), deletedAt: null } })
    : await findByUsername(ctx, identifier);
  if (!user) {
    await ctx.hasher.burn(password);
    throw new AppError("AUTH_002");
  }
  if (!(await ctx.hasher.verify(user.passwordHash, password))) throw new AppError("AUTH_002");
  await ctx.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user.id;
}

export async function updateProfile(
  ctx: Context,
  userId: string,
  body: UpdateProfileBody
): Promise<void> {
  const user = await findActiveUser(ctx, userId);
  const emailChanged = body.email !== undefined && body.email !== user.email;
  if (emailChanged) {
    const ok = await ctx.hasher.verify(user.passwordHash, body.currentPassword ?? "");
    if (!ok) throw new AppError("AUTH_005");
  }
  await assertAvailable(
    ctx,
    { username: body.username, email: emailChanged ? body.email : undefined },
    user.id
  );
  try {
    const updated = await ctx.db.user.update({
      where: { id: user.id },
      data: {
        ...(body.username !== undefined && { username: body.username }),
        ...(emailChanged && { email: body.email, emailVerifiedAt: null }),
      },
    });
    if (emailChanged) await sendVerification(ctx, updated);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await assertAvailable(ctx, { username: body.username, email: body.email }, user.id);
    throw error;
  }
}

/** Change le mot de passe et ferme les autres sessions du compte. */
export async function changePassword(
  ctx: Context,
  userId: string,
  body: ChangePasswordBody,
  currentSid: string
): Promise<void> {
  const user = await findActiveUser(ctx, userId);
  if (!(await ctx.hasher.verify(user.passwordHash, body.currentPassword))) {
    throw new AppError("AUTH_005");
  }
  assertStrongPassword(body.newPassword, [user.username, emailLocalPart(user.email)]);
  await ctx.db.user.update({
    where: { id: user.id },
    data: { passwordHash: await ctx.hasher.hash(body.newPassword) },
  });
  await destroyUserSessions(ctx.db, user.id, currentSid);
}

export async function updatePreferences(
  ctx: Context,
  userId: string,
  body: UpdatePreferencesBody
): Promise<void> {
  await findActiveUser(ctx, userId);
  await ctx.db.user.update({ where: { id: userId }, data: body });
}

// --- Emails optionnels [D21] ---

function requireMailer(ctx: Context): void {
  if (!ctx.mailer) throw new AppError("AUTH_007");
}

export async function resendVerification(ctx: Context, userId: string): Promise<void> {
  requireMailer(ctx);
  const user = await findActiveUser(ctx, userId);
  if (user.emailVerifiedAt) throw new AppError("AUTH_013");
  await sendVerification(ctx, user);
}

export async function verifyEmail(ctx: Context, token: string): Promise<void> {
  requireMailer(ctx);
  const userId = await consumeToken(ctx.db, token, "VERIFY_EMAIL");
  if (!userId) throw new AppError("AUTH_008");
  await ctx.db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

/** Repond toujours pareil, que l'email existe ou non (pas d'enumeration). */
export async function forgotPassword(ctx: Context, email: string): Promise<void> {
  requireMailer(ctx);
  const user = await ctx.db.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) return;
  const token = await issueToken(ctx.db, user.id, "RESET_PASSWORD");
  const url = new URL(`/reset-password?token=${token}`, ctx.env.APP_URL).toString();
  await sendMail(ctx, resetPasswordMail(user.email, user.username, url));
}

/** Nouveau mot de passe par jeton : toutes les sessions du compte sont fermees. */
export async function resetPassword(ctx: Context, token: string, password: string): Promise<void> {
  requireMailer(ctx);
  // Un mot de passe refuse ne brule pas le jeton : l'utilisateur en choisit un autre.
  const userId = await consumeToken(ctx.db, token, "RESET_PASSWORD", async (id) => {
    const user = await ctx.db.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new AppError("AUTH_008");
    assertStrongPassword(password, [user.username, emailLocalPart(user.email)]);
  });
  if (!userId) throw new AppError("AUTH_008");
  await ctx.db.user.update({
    where: { id: userId },
    data: { passwordHash: await ctx.hasher.hash(password) },
  });
  // Prouver l'acces a la boite vaut verification de l'email.
  await ctx.db.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  await destroyUserSessions(ctx.db, userId);
}

// Comptes admin : creation (script), mot de passe, 2FA TOTP obligatoire.
// AdminUser est isole des utilisateurs : aucun lien entre les deux comptes.

import { emailSchema, passwordSchema, usernameSchema, type AdminLoginResult } from "@fm/shared";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";

import { assertStrongPassword } from "../auth/password.ts";
import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { audit } from "./audit.ts";

const ISSUER = "Forest Manager";
/** Tolerance d'horloge : le code precedent et le suivant restent acceptes. */
const TOTP_TOLERANCE_SECONDS = 30;

export const createAdminInputSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type CreateAdminInput = z.input<typeof createAdminInputSchema>;

type AdminRow = NonNullable<Awaited<ReturnType<Context["db"]["adminUser"]["findUnique"]>>>;

/** Cree un compte admin ; la 2FA se configure a la premiere connexion. */
export async function createAdminUser(
  ctx: Context,
  input: CreateAdminInput
): Promise<{ id: string; username: string; email: string }> {
  const data = createAdminInputSchema.parse(input);
  assertStrongPassword(data.password, [data.username, data.email.split("@")[0] ?? ""]);
  const taken = await ctx.db.adminUser.findFirst({
    where: {
      OR: [{ username: { equals: data.username, mode: "insensitive" } }, { email: data.email }],
    },
  });
  if (taken) throw new AppError("ADMIN_005");
  return ctx.db.adminUser.create({
    data: {
      username: data.username,
      email: data.email,
      password: await ctx.hasher.hash(data.password),
      totpSecret: generateSecret(),
    },
    select: { id: true, username: true, email: true },
  });
}

/** Etape mot de passe ; meme erreur et meme cout pour un compte inconnu (ADMIN_001). */
export async function authenticateAdmin(
  ctx: Context,
  identifier: string,
  password: string
): Promise<AdminRow> {
  const admin = await ctx.db.adminUser.findFirst({
    where: identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { username: { equals: identifier, mode: "insensitive" } },
  });
  if (!admin) {
    await ctx.hasher.burn(password);
    throw new AppError("ADMIN_001");
  }
  if (!(await ctx.hasher.verify(admin.password, password))) throw new AppError("ADMIN_001");
  return admin;
}

/** Ce que l'ecran de connexion affiche apres le mot de passe [D138]. */
export async function loginStep(admin: AdminRow): Promise<AdminLoginResult> {
  if (admin.totpEnabled) return { step: "CODE" };
  const otpauthUri = generateURI({ issuer: ISSUER, label: admin.email, secret: admin.totpSecret });
  return {
    step: "SETUP",
    secret: admin.totpSecret,
    otpauthUri,
    qrCode: await QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 }),
  };
}

/**
 * Verifie le code et termine la connexion. Un code deja accepte ne sert plus
 * (rejeu refuse, D174) : le pas de temps est enregistre sous condition, en SQL.
 */
export async function completeLogin(
  ctx: Context,
  adminId: string,
  code: string,
  ip: string | undefined
): Promise<boolean> {
  const admin = await ctx.db.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw new AppError("ADMIN_002");
  const result = verifySync({
    secret: admin.totpSecret,
    token: code,
    epochTolerance: TOTP_TOLERANCE_SECONDS,
    ...(admin.totpLastStep === null ? {} : { afterTimeStep: admin.totpLastStep }),
  });
  if (!result.valid || !("timeStep" in result)) return false;
  const step = result.timeStep;
  return ctx.db.$transaction(async (tx) => {
    const { count } = await tx.adminUser.updateMany({
      where: { id: adminId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step, totpEnabled: true, lastLoginAt: new Date() },
    });
    if (count === 0) return false;
    if (!admin.totpEnabled) await audit(tx, { adminId, action: "auth.totp-enabled" });
    await audit(tx, { adminId, action: "auth.login", data: { ip: ip ?? null } });
    return true;
  });
}

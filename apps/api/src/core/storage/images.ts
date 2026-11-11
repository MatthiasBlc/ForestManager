// Photos et avatars [D146, D167] : rattacher un envoi verifie, servir les
// images par URL signee, et faire le menage du stockage.
import { IMAGE_MAX_SIDE, UPLOAD_MAX_BYTES } from "@fm/shared";
import { randomUUID } from "node:crypto";

import type { Context } from "../context.ts";
import { exportKeys } from "../exports/service.ts";
import { AppError } from "../http/errors.ts";
import { pendingKey, type Storage } from "./storage.ts";
import { IMAGE_CONTENT_TYPES, IMAGE_EXTENSIONS, readImageInfo } from "./image-format.ts";

/** Un envoi ou une image orpheline n'est efface qu'apres ce delai (rattachement en cours). */
const SWEEP_GRACE_MS = 60 * 60 * 1000;

export type ImageKind = keyof typeof IMAGE_MAX_SIDE;

export function requireStorage(ctx: Context): Storage {
  if (!ctx.storage) throw new AppError("STORAGE_001");
  return ctx.storage;
}

/** URL signee d'une image, null sans image (ou sans stockage configure). */
export function imageUrl(ctx: Context, key: string | null | undefined): string | null {
  return key && ctx.storage ? ctx.storage.readUrl(key) : null;
}

/**
 * Verifie l'envoi en attente de cet utilisateur (WebP ou JPEG, dimensions) et le range
 * sous `folder` avec une cle neuve. Le fichier refuse est efface.
 */
export async function claimUpload(
  ctx: Context,
  userId: string,
  uploadId: string,
  folder: string,
  kind: ImageKind
): Promise<string> {
  const storage = requireStorage(ctx);
  const source = pendingKey(userId, uploadId);
  const file = await storage.read(source, UPLOAD_MAX_BYTES);
  if (!file) throw new AppError("STORAGE_002");

  const info = readImageInfo(file);
  const maxSide = IMAGE_MAX_SIDE[kind];
  if (!info || info.width < 1 || info.height < 1 || info.width > maxSide || info.height > maxSide) {
    await storage.remove([source]);
    throw new AppError("STORAGE_003");
  }

  const key = `${folder}/${randomUUID()}.${IMAGE_EXTENSIONS[info.format]}`;
  await storage.put(key, file, IMAGE_CONTENT_TYPES[info.format]);
  await storage.remove([source]);
  return key;
}

/** Copie une image sous un autre dossier (adaptation d'une recette). */
export async function copyImage(ctx: Context, key: string, folder: string): Promise<string | null> {
  if (!ctx.storage) return null;
  const target = `${folder}/${randomUUID()}.${key.split(".").at(-1) ?? "webp"}`;
  await ctx.storage.copy(key, target);
  return target;
}

/** Efface une image remplacee ; un echec est rattrape par le menage. */
export async function discardImage(ctx: Context, key: string | null): Promise<void> {
  if (!key || !ctx.storage) return;
  try {
    await ctx.storage.remove([key]);
  } catch (error) {
    ctx.logger.warn({ err: error, key }, "image removal failed, left to the sweep");
  }
}

/**
 * Efface les envois abandonnes et les images que la base ne reference plus
 * (compte supprime, espace purge, image remplacee), une fois passees une heure.
 */
export async function sweepStorage(ctx: Context, now = new Date()): Promise<number> {
  if (!ctx.storage) return 0;
  const [users, spaces, exports, ...fromModules] = await Promise.all([
    ctx.db.user.findMany({ where: { avatarKey: { not: null } }, select: { avatarKey: true } }),
    ctx.db.space.findMany({ where: { avatarKey: { not: null } }, select: { avatarKey: true } }),
    exportKeys(ctx),
    ...ctx.hooks.storageKeys.map((keys) => keys(ctx.db, now)),
  ]);
  const used = new Set<string>([
    ...users.flatMap((row) => (row.avatarKey ? [row.avatarKey] : [])),
    ...spaces.flatMap((row) => (row.avatarKey ? [row.avatarKey] : [])),
    ...exports,
    ...fromModules.flat(),
  ]);

  const cutoff = now.getTime() - SWEEP_GRACE_MS;
  const stale: string[] = [];
  for await (const object of ctx.storage.list()) {
    if (object.lastModified.getTime() < cutoff && !used.has(object.key)) stale.push(object.key);
  }
  await ctx.storage.remove(stale);
  return stale.length;
}

/** Utilisateur vu par les autres membres (D50), avatar compris. */
export function toUserSummary(
  ctx: Context,
  user: { id: string; username: string; avatarKey: string | null }
): { id: string; username: string; avatarUrl: string | null } {
  return { id: user.id, username: user.username, avatarUrl: imageUrl(ctx, user.avatarKey) };
}

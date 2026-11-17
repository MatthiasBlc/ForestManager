// Export de donnees (P12) [D37, D192] : demande, limite d'un export par espace
// sur 24 h glissantes, generation juste apres la reponse (une seule instance,
// pas de file d'attente), archive zip gardee 24 h dans le stockage.
import {
  EXPORT_TTL_HOURS,
  SPACE_EXPORT_INTERVAL_HOURS,
  type CreateExportBody,
  type DataExport,
  type ExportFormat,
} from "@fm/shared";
import { zipSync, type Zippable } from "fflate";

import { recordActivity } from "../activity/service.ts";
import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { requireSpacePermission } from "../spaces/access.ts";
import type { ArchiveFile, ExportRequest } from "./types.ts";

const HOUR = 60 * 60 * 1000;
/** Une generation encore en cours apres ce delai a echoue (redemarrage de l'API). */
const PENDING_TIMEOUT_MS = HOUR;
/** Archive servie au plus (au-dela, elle n'aurait pas pu etre ecrite). */
export const ARCHIVE_MAX_BYTES = 1024 * 1024 * 1024;

const exportSelect = {
  id: true,
  scope: true,
  format: true,
  includePhotos: true,
  status: true,
  fileKey: true,
  expiresAt: true,
  createdAt: true,
  requestedById: true,
  spaceId: true,
  space: { select: { id: true, name: true } },
} as const;

type ExportRow = Awaited<ReturnType<typeof findOwn>>;

function toDto(row: ExportRow, now = new Date()): DataExport {
  const expired = row.status === "READY" && row.expiresAt !== null && row.expiresAt <= now;
  return {
    id: row.id,
    scope: row.scope,
    space: row.space,
    format: row.format,
    photos: row.includePhotos,
    status: expired ? "EXPIRED" : row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.status === "READY" ? (row.expiresAt?.toISOString() ?? null) : null,
  };
}

async function findOwn(ctx: Context, userId: string, id: string) {
  const row = await ctx.db.dataExport.findUnique({ where: { id }, select: exportSelect });
  if (!row || row.requestedById !== userId) throw new AppError("EXPORT_003");
  return row;
}

export async function createExport(
  ctx: Context,
  userId: string,
  body: CreateExportBody & { photos: boolean }
): Promise<DataExport> {
  if (!ctx.storage) throw new AppError("EXPORT_002");
  const spaceId = body.scope === "SPACE" ? (body.spaceId ?? null) : null;
  if (spaceId) {
    await requireSpacePermission(ctx.db, spaceId, userId, "space.export");
    const last = await ctx.db.dataExport.findFirst({
      where: {
        spaceId,
        status: { not: "FAILED" },
        createdAt: { gt: new Date(Date.now() - SPACE_EXPORT_INTERVAL_HOURS * HOUR) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last) {
      const nextAt = new Date(last.createdAt.getTime() + SPACE_EXPORT_INTERVAL_HOURS * HOUR);
      throw new AppError("EXPORT_001", { nextAt: nextAt.toISOString() });
    }
  }
  const row = await ctx.db.$transaction(async (tx) => {
    const created = await tx.dataExport.create({
      data: {
        scope: body.scope,
        requestedById: userId,
        spaceId,
        format: body.format,
        includePhotos: body.photos,
      },
      select: exportSelect,
    });
    if (spaceId) {
      await recordActivity(
        ctx,
        { spaceId, type: "core.space.exported", actorId: userId, data: { format: body.format } },
        tx
      );
    }
    return created;
  });
  return toDto(row);
}

function archiveName(format: ExportFormat, scope: string, createdAt: Date): string {
  const day = createdAt.toISOString().slice(0, 10);
  const what = scope === "SPACE" ? "espace" : "mes-recettes";
  return `forest-manager-${what}-${format === "JSON" ? "json" : "markdown"}-${day}.zip`;
}

/** Genere l'archive : fichiers des modules concernes, zip, stockage, statut READY. */
export async function runExport(ctx: Context, id: string): Promise<void> {
  const row = await ctx.db.dataExport.findUnique({
    where: { id },
    select: { ...exportSelect, space: { select: { id: true, name: true, modules: true } } },
  });
  if (!row || row.status !== "PENDING") return;
  try {
    if (!ctx.storage) throw new Error("storage unavailable");
    const request: ExportRequest = {
      userId: row.requestedById,
      scope: row.scope,
      spaceId: row.spaceId,
      format: row.format,
      photos: row.includePhotos,
    };
    const active = row.space
      ? new Set(
          row.space.modules
            .filter((module) => module.enabled && !module.revokedAt)
            .map((module) => module.moduleCode)
        )
      : null;
    const files: ArchiveFile[] = [];
    for (const module of ctx.modules) {
      if (!module.exportData || (active && !active.has(module.code))) continue;
      files.push(...(await module.exportData(ctx, request)));
    }
    const zippable: Zippable = {};
    for (const file of files) zippable[file.path] = file.data;
    const archive = zipSync(zippable, { level: 6 });
    const fileKey = `exports/${row.id}.zip`;
    await ctx.storage.put(fileKey, Buffer.from(archive), "application/zip");
    await ctx.db.dataExport.update({
      where: { id },
      data: { status: "READY", fileKey, expiresAt: new Date(Date.now() + EXPORT_TTL_HOURS * HOUR) },
    });
  } catch (error) {
    ctx.logger.error({ err: error, exportId: id }, "export failed");
    await ctx.db.dataExport.update({ where: { id }, data: { status: "FAILED" } });
  }
}

export async function getExport(ctx: Context, userId: string, id: string): Promise<DataExport> {
  return toDto(await findOwn(ctx, userId, id));
}

/** Archive prete du demandeur, avec son nom de fichier. */
export async function readArchive(
  ctx: Context,
  userId: string,
  id: string
): Promise<{ name: string; data: Buffer }> {
  if (!ctx.storage) throw new AppError("EXPORT_002");
  const row = await findOwn(ctx, userId, id);
  if (toDto(row).status !== "READY" || !row.fileKey) throw new AppError("EXPORT_003");
  const data = await ctx.storage.read(row.fileKey, ARCHIVE_MAX_BYTES);
  if (!data) throw new AppError("EXPORT_003");
  return { name: archiveName(row.format, row.scope, row.createdAt), data };
}

/**
 * Tache horaire : archives expirees passees en EXPIRED (le menage du stockage
 * efface ensuite le fichier, plus reference), generations interrompues en FAILED.
 */
export async function expireExports(ctx: Context, now = new Date()): Promise<number> {
  const expired = await ctx.db.dataExport.updateMany({
    where: { status: "READY", expiresAt: { lte: now } },
    data: { status: "EXPIRED", fileKey: null },
  });
  const stuck = await ctx.db.dataExport.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - PENDING_TIMEOUT_MS) } },
    data: { status: "FAILED" },
  });
  return expired.count + stuck.count;
}

/** Fichiers encore servis (le menage du stockage les garde). */
export async function exportKeys(ctx: Context): Promise<string[]> {
  const rows = await ctx.db.dataExport.findMany({
    where: { status: "READY", fileKey: { not: null } },
    select: { fileKey: true },
  });
  return rows.flatMap((row) => (row.fileKey ? [row.fileKey] : []));
}

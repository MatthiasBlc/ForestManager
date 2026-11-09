// Admin, C4.6 : journal d'audit (A11) [D128], reglages en lecture seule (A13)
// [D135] et tableau de bord (A02) [D129]. Les reglages viennent des variables
// d'environnement ; aucun secret ne sort d'ici. Tester un service est une
// lecture (rien n'est modifie) : pas d'entree d'audit.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  auditCategory,
  auditPrefixes,
  type AdminDashboard,
  type AuditCategory,
  type AuditEntry,
  type PlatformSettings,
  type ServiceTest,
  type ServiceTestResult,
} from "@fm/shared";

import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";

const RECENT = 5;
const DUPLICATE_SIMILARITY = 0.45;

/** Version de l'application (package.json racine, present dans l'image de prod). */
const VERSION = (() => {
  try {
    const raw = readFileSync(new URL("../../../../../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "inconnue";
  } catch {
    return "inconnue";
  }
})();

// --- Journal ---

type AuditRow = Prisma.AdminAuditLogGetPayload<{
  include: { admin: { select: { username: true } } };
}>;

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    admin: row.admin.username,
    action: row.action,
    category: auditCategory(row.action),
    targetType: row.targetType,
    targetId: row.targetId,
    data: row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : null,
  };
}

export async function listAudit(
  ctx: Context,
  options: { category?: AuditCategory; offset: number; limit: number }
): Promise<{ data: AuditEntry[]; total: number }> {
  const where: Prisma.AdminAuditLogWhereInput = options.category
    ? {
        OR: auditPrefixes(options.category).map((prefix) => ({
          action: { startsWith: `${prefix}.` },
        })),
      }
    : {};
  const [rows, total] = await Promise.all([
    ctx.db.adminAuditLog.findMany({
      where,
      include: { admin: { select: { username: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: options.offset,
      take: options.limit,
    }),
    ctx.db.adminAuditLog.count({ where }),
  ]);
  return { data: rows.map(toEntry), total };
}

// --- Reglages ---

/** "smtp://user:pass@host:587" -> "smtp://host:587". */
function smtpServer(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "adresse illisible";
  }
}

export function settings(ctx: Context): PlatformSettings {
  const { env } = ctx;
  const storage = env.MINIO_ENDPOINT
    ? `${env.MINIO_USE_SSL ? "https" : "http"}://${env.MINIO_ENDPOINT}:${String(env.MINIO_PORT)}`
    : null;
  return {
    email: {
      configured: ctx.mailer !== null,
      server: smtpServer(env.SMTP_URL),
      from: env.SMTP_FROM,
    },
    storage: {
      configured: ctx.storage !== null,
      endpoint: storage,
      bucket: env.MINIO_BUCKET ?? null,
      publicUrl: env.MINIO_PUBLIC_URL ?? null,
    },
    errorTracking: { configured: false },
  };
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : "erreur inconnue";
}

export async function testService(
  ctx: Context,
  adminId: string,
  service: ServiceTest
): Promise<ServiceTestResult> {
  if (service === "email") {
    if (!ctx.mailer) {
      return { ok: false, message: "Aucun serveur SMTP configuré (SMTP_URL absente)." };
    }
    const admin = await ctx.db.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    try {
      await ctx.mailer.send({
        to: admin.email,
        subject: "Forest Manager : e-mail de test",
        text: "Cet e-mail confirme que l'envoi fonctionne.",
        html: "<p>Cet e-mail confirme que l'envoi fonctionne.</p>",
      });
      return { ok: true, message: `E-mail de test envoyé à ${admin.email}.` };
    } catch (error) {
      return { ok: false, message: `Envoi impossible : ${failure(error)}` };
    }
  }
  if (!ctx.storage) {
    return { ok: false, message: "Aucun stockage configuré (MINIO_ENDPOINT absente)." };
  }
  const key = `admin-test/${randomUUID()}.txt`;
  try {
    await ctx.storage.put(key, Buffer.from("test"), "text/plain");
    const read = await ctx.storage.read(key, 16);
    await ctx.storage.remove([key]);
    if (read?.toString() !== "test") return { ok: false, message: "Lecture incorrecte." };
    return { ok: true, message: "Écriture, lecture et suppression réussies." };
  } catch (error) {
    return { ok: false, message: `Stockage injoignable : ${failure(error)}` };
  }
}

// --- Tableau de bord ---

export async function dashboard(ctx: Context): Promise<AdminDashboard> {
  const [newCount, duplicates, deleting, users, groups, personal, recipes, modules, recent] =
    await Promise.all([
      ctx.db.ingredient.count({ where: { status: "NEW" } }),
      ctx.db.$queryRaw<{ name: string }[]>`
        SELECT fr.name FROM "Ingredient" i
        JOIN "IngredientTranslation" fr ON fr."ingredientId" = i.id AND fr.locale = 'fr'
        WHERE i.status = 'NEW' AND EXISTS (SELECT 1 FROM "IngredientTranslation" o
          JOIN "Ingredient" oi ON oi.id = o."ingredientId"
          WHERE o.locale = 'fr' AND oi.status = 'ACTIVE' AND o.normalized % fr.normalized
            AND similarity(o.normalized, fr.normalized) >= ${DUPLICATE_SIMILARITY})
        ORDER BY i."createdAt" DESC LIMIT 3`,
      ctx.db.space.findMany({
        where: { deletedAt: { not: null }, purgeAfter: { not: null } },
        orderBy: { purgeAfter: "asc" },
        select: { id: true, name: true, purgeAfter: true },
      }),
      ctx.db.user.count({ where: { deletedAt: null } }),
      ctx.db.space.count({ where: { kind: "GROUP", deletedAt: null } }),
      ctx.db.space.count({ where: { kind: "PERSONAL", deletedAt: null } }),
      ctx.db.recipe.count({ where: { deletedAt: null } }),
      ctx.db.module.findMany({
        where: { isDefault: false, status: { in: ["AVAILABLE", "BETA"] } },
        orderBy: { sortOrder: "asc" },
        select: {
          code: true,
          _count: {
            select: { spaces: { where: { revokedAt: null, space: { deletedAt: null } } } },
          },
        },
      }),
      ctx.db.adminAuditLog.findMany({
        include: { admin: { select: { username: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: RECENT,
      }),
    ]);
  return {
    newIngredients: { count: newCount, duplicates: duplicates.map((d) => d.name) },
    deletingSpaces: deleting.map((s) => ({
      id: s.id,
      name: s.name,
      purgeAfter: (s.purgeAfter ?? new Date()).toISOString(),
    })),
    platform: {
      users,
      groupSpaces: groups,
      personalSpaces: personal,
      recipes,
      modules: modules.map((m) => ({ code: m.code, grantedCount: m._count.spaces })),
    },
    services: {
      email: ctx.mailer !== null,
      storage: ctx.storage !== null,
      errorTracking: false,
    },
    version: VERSION,
    recent: recent.map(toEntry),
  };
}

// Notifications du socle (C6.1) [F-NOT-1 a F-NOT-3, D41, D118, D190].
// `notify()` est l'unique point d'ecriture : le socle et les modules l'appellent
// apres une action ; il applique les preferences et le regroupement.

import {
  notificationCatalog,
  type CursorQuery,
  type Notification,
  type NotificationCatalog,
  type NotificationPreferences,
} from "@fm/shared";

import type { Context } from "../context.ts";
import type { Db, Prisma } from "../db/client.ts";
import { afterDateCursor, decodeDateCursor, encodeDateCursor } from "../http/cursor.ts";
import { AppError } from "../http/errors.ts";
import type { ApiModule } from "../modules/registry.ts";
import { loadAccess } from "../spaces/access.ts";
import { imageUrl } from "../storage/images.ts";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
/** Fenetre de regroupement d'une notification non lue [D190]. */
const GROUP_WINDOW = DAY;

const catalogs = new WeakMap<readonly ApiModule[], NotificationCatalog>();

/** Catalogue du socle et des modules du contexte (calcule une fois par liste). */
export function catalogOf(ctx: Pick<Context, "modules">): NotificationCatalog {
  let catalog = catalogs.get(ctx.modules);
  if (!catalog) {
    catalog = notificationCatalog(ctx.modules);
    catalogs.set(ctx.modules, catalog);
  }
  return catalog;
}

export interface NotifyInput {
  type: string;
  recipients: readonly string[];
  spaceId?: string | null;
  moduleCode?: string | null;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  data?: Record<string, unknown> | null;
  url?: string | null;
  /** Regroupe les evenements semblables dans une seule notification non lue. */
  groupKey?: string | null;
}

/** Destinataires qui veulent cette categorie (espace, puis global, puis defaut). */
async function wantedBy(
  ctx: Context,
  recipients: string[],
  category: string,
  spaceId: string | null
): Promise<string[]> {
  const definition = catalogOf(ctx).category(category);
  if (!definition) throw new Error(`unknown notification category "${category}"`);
  if (definition.mandatory || recipients.length === 0) return recipients;
  const rows = await ctx.db.notificationPreference.findMany({
    where: {
      userId: { in: recipients },
      category,
      OR: [{ spaceId: null }, ...(spaceId && definition.perSpace ? [{ spaceId }] : [])],
    },
  });
  return recipients.filter((userId) => {
    const own = rows.filter((row) => row.userId === userId);
    const choice = own.find((row) => row.spaceId !== null) ?? own.find((row) => !row.spaceId);
    return choice ? choice.enabled : definition.defaultEnabled;
  });
}

/**
 * Ecrit la notification pour chaque destinataire qui la veut, jamais pour
 * l'auteur de l'action. Renvoie les destinataires touches (diffusion temps reel).
 */
export async function notify(ctx: Context, input: NotifyInput): Promise<string[]> {
  const category = catalogOf(ctx).typeCategory(input.type);
  if (!category) throw new Error(`unknown notification type "${input.type}"`);
  const spaceId = input.spaceId ?? null;
  const candidates = [...new Set(input.recipients)].filter((id) => id !== input.actorId);
  const recipients = await wantedBy(ctx, candidates, category, spaceId);
  const data = (input.data ?? undefined) as Prisma.InputJsonValue | undefined;
  const fields = {
    type: input.type,
    category,
    spaceId,
    moduleCode: input.moduleCode ?? null,
    actorId: input.actorId ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    data,
    url: input.url ?? null,
    groupKey: input.groupKey ?? null,
  };
  for (const userId of recipients) {
    if (input.groupKey) {
      const grouped = await ctx.db.notification.updateMany({
        where: {
          userId,
          groupKey: input.groupKey,
          readAt: null,
          createdAt: { gte: new Date(Date.now() - GROUP_WINDOW) },
        },
        data: { ...fields, count: { increment: 1 }, createdAt: new Date() },
      });
      if (grouped.count > 0) continue;
    }
    await ctx.db.notification.create({ data: { ...fields, userId } });
  }
  ctx.realtime.toUsers(recipients, { type: "notification" });
  return recipients;
}

/** Retention [D190] : lues depuis plus de 30 jours, toutes apres 90 jours. */
export async function purgeNotifications(db: Db): Promise<number> {
  const now = Date.now();
  const result = await db.notification.deleteMany({
    where: {
      OR: [
        { readAt: { lt: new Date(now - 30 * DAY) } },
        { createdAt: { lt: new Date(now - 90 * DAY) } },
      ],
    },
  });
  return result.count;
}

// --- Lecture ---

/** Notifications visibles : sans espace, ou d'un espace ou l'on est membre actif. */
function visibleWhere(userId: string): Prisma.NotificationWhereInput {
  return {
    userId,
    OR: [
      { spaceId: null },
      { space: { deletedAt: null, memberships: { some: { userId, leftAt: null } } } },
    ],
  };
}

export async function listNotifications(
  ctx: Context,
  userId: string,
  query: CursorQuery
): Promise<{ data: Notification[]; nextCursor: string | null }> {
  const cursor = query.cursor ? decodeDateCursor(query.cursor) : null;
  const rows = await ctx.db.notification.findMany({
    where: {
      AND: [visibleWhere(userId), afterDateCursor(cursor)],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    include: {
      space: { select: { id: true, name: true, tintIndex: true } },
      actor: { select: { id: true, username: true, avatarKey: true, deletedAt: true } },
    },
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    data: page.map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category,
      space: row.space,
      actor:
        row.actor && !row.actor.deletedAt
          ? {
              id: row.actor.id,
              username: row.actor.username,
              avatarUrl: imageUrl(ctx, row.actor.avatarKey),
            }
          : null,
      targetType: row.targetType,
      targetId: row.targetId,
      data: (row.data ?? null) as Record<string, unknown> | null,
      count: row.count,
      url: row.url,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor:
      rows.length > query.limit && last ? encodeDateCursor(last.createdAt, last.id) : null,
  };
}

export async function unreadCount(ctx: Context, userId: string): Promise<number> {
  return ctx.db.notification.count({ where: { ...visibleWhere(userId), readAt: null } });
}

export async function markRead(ctx: Context, userId: string, id: string): Promise<void> {
  const notification = await ctx.db.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new AppError("NOTIF_001");
  if (!notification.readAt) {
    await ctx.db.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}

export async function markAllRead(ctx: Context, userId: string): Promise<void> {
  await ctx.db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

// --- Preferences [D118] ---

/** Codes des modules actifs par espace groupe actif de l'utilisateur, et tous espaces confondus. */
async function userSpaces(ctx: Context, userId: string) {
  const memberships = await ctx.db.membership.findMany({
    where: { userId, leftAt: null, space: { deletedAt: null } },
    select: {
      space: {
        select: {
          id: true,
          kind: true,
          name: true,
          modules: { where: { enabled: true }, select: { moduleCode: true } },
        },
      },
    },
    orderBy: { space: { name: "asc" } },
  });
  return memberships.map(({ space }) => ({
    id: space.id,
    kind: space.kind,
    modules: new Set(space.modules.map((m) => m.moduleCode)),
  }));
}

export async function readPreferences(
  ctx: Context,
  userId: string
): Promise<NotificationPreferences> {
  const catalog = catalogOf(ctx);
  const spaces = await userSpaces(ctx, userId);
  const rows = await ctx.db.notificationPreference.findMany({ where: { userId } });
  const activeModules = new Set(spaces.flatMap((space) => [...space.modules]));
  const all = catalog.configurable();
  const global = (key: string, fallback: boolean) =>
    rows.find((row) => !row.spaceId && row.category === key)?.enabled ?? fallback;

  const categories = all
    .filter((c) => c.moduleCode === null || activeModules.has(c.moduleCode))
    .map((c) => ({
      key: c.key,
      moduleCode: c.moduleCode,
      enabled: global(c.key, c.defaultEnabled),
    }));
  return {
    categories,
    spaces: spaces
      .filter((space) => space.kind === "GROUP")
      .map((space) => {
        const own = rows.filter((row) => row.spaceId === space.id);
        return {
          spaceId: space.id,
          custom: own.length > 0,
          categories: all
            .filter((c) => c.perSpace && (c.moduleCode === null || space.modules.has(c.moduleCode)))
            .map((c) => ({
              key: c.key,
              moduleCode: c.moduleCode,
              enabled:
                own.find((row) => row.category === c.key)?.enabled ??
                global(c.key, c.defaultEnabled),
            })),
        };
      }),
  };
}

export async function setGlobalPreference(
  ctx: Context,
  userId: string,
  category: string,
  enabled: boolean
): Promise<NotificationPreferences> {
  const definition = catalogOf(ctx).category(category);
  if (!definition || definition.mandatory) throw new AppError("NOTIF_002");
  // Index partiel (spaceId null) : pas d'upsert Prisma possible, on passe par SQL.
  await ctx.db.$executeRaw`
    INSERT INTO "NotificationPreference" (id, "userId", "spaceId", category, enabled, "updatedAt")
    VALUES (gen_random_uuid(), ${userId}, NULL, ${category}, ${enabled}, now())
    ON CONFLICT ("userId", category) WHERE "spaceId" IS NULL
    DO UPDATE SET enabled = EXCLUDED.enabled, "updatedAt" = now()`;
  return readPreferences(ctx, userId);
}

/** Reglage personnalise d'un espace : remplace toutes ses lignes. */
export async function setSpacePreferences(
  ctx: Context,
  userId: string,
  spaceId: string,
  choices: Record<string, boolean>
): Promise<NotificationPreferences> {
  const access = await loadAccess(ctx.db, spaceId, userId);
  if (access.space.kind !== "GROUP") throw new AppError("SPACE_003");
  const preferences = await readPreferences(ctx, userId);
  const allowed = new Set(
    preferences.spaces.find((space) => space.spaceId === spaceId)?.categories.map((c) => c.key)
  );
  if (Object.keys(choices).some((key) => !allowed.has(key))) throw new AppError("NOTIF_002");
  await ctx.db.$transaction([
    ctx.db.notificationPreference.deleteMany({ where: { userId, spaceId } }),
    ctx.db.notificationPreference.createMany({
      data: Object.entries(choices).map(([category, enabled]) => ({
        userId,
        spaceId,
        category,
        enabled,
      })),
    }),
  ]);
  return readPreferences(ctx, userId);
}

export async function resetSpacePreferences(
  ctx: Context,
  userId: string,
  spaceId: string
): Promise<NotificationPreferences> {
  await loadAccess(ctx.db, spaceId, userId);
  await ctx.db.notificationPreference.deleteMany({ where: { userId, spaceId } });
  return readPreferences(ctx, userId);
}

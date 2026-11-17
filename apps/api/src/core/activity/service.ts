// Fil d'activite d'un espace (C6.3) [F-SPC-7, D41]. Le socle et les modules
// enregistrent leurs evenements par `recordActivity()` ; les membres le lisent.
import type { ActivityEvent, CursorQuery } from "@fm/shared";

import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";
import { afterDateCursor, decodeDateCursor, encodeDateCursor } from "../http/cursor.ts";
import { catalogOf } from "../notifications/service.ts";
import { requireSpacePermission } from "../spaces/access.ts";
import { imageUrl } from "../storage/images.ts";

type Tx = Context["db"] | Prisma.TransactionClient;

export interface ActivityInput {
  spaceId: string;
  type: string;
  actorId?: string | null;
  moduleCode?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  data?: Record<string, unknown> | null;
}

/** Enregistre un evenement declare (dans la transaction de l'action si `db` en est une). */
export async function recordActivity(
  ctx: Context,
  input: ActivityInput,
  db: Tx = ctx.db
): Promise<void> {
  if (!catalogOf(ctx).isActivityType(input.type)) {
    throw new Error(`unknown activity type "${input.type}"`);
  }
  await db.activityEvent.create({
    data: {
      spaceId: input.spaceId,
      type: input.type,
      actorId: input.actorId ?? null,
      moduleCode: input.moduleCode ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export const activityInclude = {
  actor: { select: { id: true, username: true, avatarKey: true, deletedAt: true } },
} as const;

type ActivityRow = Prisma.ActivityEventGetPayload<{ include: typeof activityInclude }>;

/** Evenement vu par les membres (acteur supprime : null). */
export function toActivityEvent(ctx: Context, row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type,
    moduleCode: row.moduleCode,
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
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listActivity(
  ctx: Context,
  spaceId: string,
  userId: string,
  query: CursorQuery
): Promise<{ data: ActivityEvent[]; nextCursor: string | null }> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.activity.view");
  const cursor = query.cursor ? decodeDateCursor(query.cursor) : null;
  const rows = await ctx.db.activityEvent.findMany({
    where: { spaceId, ...afterDateCursor(cursor) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    include: activityInclude,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    data: page.map((row) => toActivityEvent(ctx, row)),
    nextCursor:
      rows.length > query.limit && last ? encodeDateCursor(last.createdAt, last.id) : null,
  };
}

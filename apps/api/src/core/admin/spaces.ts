// Admin, espaces et moderation (C4.5) [D52, D121, D122, D178]. Les espaces sont
// prives : la liste ne montre que leurs informations generales. Le contenu ne
// s'ouvre que par un acces de moderation (motif, 30 min, lecture seule) ; seules
// les actions de moderation sont alors possibles, chacune avec un motif et
// auditee. C6 previendra l'OWNER a partir de ModerationAccess [D172].

import {
  MODERATION_MINUTES,
  type AdminSpace,
  type AdminSpaceFilter,
  type ModerationAccess,
  type ModerationReason,
  type ModerationSpace,
  type Recipe,
} from "@fm/shared";

import { getRecipe, visibleIn } from "../../modules/recipes/service.ts";
import { unshareFrom } from "../../modules/recipes/sharing.ts";
import type { Context } from "../context.ts";
import type { Prisma } from "../db/client.ts";
import { AppError } from "../http/errors.ts";
import { activeMembers, ownerOf } from "../notifications/recipients.ts";
import { notify } from "../notifications/service.ts";
import { publishToSpace } from "../realtime/routes.ts";
import { softDelete } from "../spaces/service.ts";
import { audit } from "./audit.ts";

const activeMember = { leftAt: null, excludedAt: null } as const;

const spaceInclude = {
  memberships: {
    where: activeMember,
    select: { role: true, user: { select: { username: true } } },
  },
  modules: {
    where: { enabled: true, revokedAt: null },
    orderBy: [{ sortOrder: "asc" }, { moduleCode: "asc" }],
    select: { moduleCode: true },
  },
} satisfies Prisma.SpaceInclude;

type SpaceRow = Prisma.SpaceGetPayload<{ include: typeof spaceInclude }>;

function toAdminSpace(row: SpaceRow, recipeCount: number): AdminSpace {
  return {
    id: row.id,
    name: row.name,
    tintIndex: row.tintIndex,
    kind: row.kind,
    owner: row.memberships.find((m) => m.role === "OWNER")?.user.username ?? null,
    memberCount: row.memberships.length,
    recipeCount,
    modules: row.modules.map((m) => m.moduleCode),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    purgeAfter: row.purgeAfter?.toISOString() ?? null,
  };
}

function recipeCount(ctx: Context, spaceId: string): Promise<number> {
  return ctx.db.recipe.count({ where: visibleIn(spaceId) });
}

function filterWhere(filter: AdminSpaceFilter): Prisma.SpaceWhereInput {
  return filter === "DELETING" ? { deletedAt: { not: null } } : { kind: filter, deletedAt: null };
}

export async function listSpaces(
  ctx: Context,
  options: { filter: AdminSpaceFilter; query?: string; offset: number; limit: number }
) {
  const query = options.query?.trim();
  const where: Prisma.SpaceWhereInput = {
    ...filterWhere(options.filter),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            {
              memberships: {
                some: {
                  role: "OWNER",
                  ...activeMember,
                  user: { username: { contains: query, mode: "insensitive" } },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [rows, total, group, personal, deleting] = await Promise.all([
    ctx.db.space.findMany({
      where,
      include: spaceInclude,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: options.offset,
      take: options.limit,
    }),
    ctx.db.space.count({ where }),
    ctx.db.space.count({ where: filterWhere("GROUP") }),
    ctx.db.space.count({ where: filterWhere("PERSONAL") }),
    ctx.db.space.count({ where: filterWhere("DELETING") }),
  ]);
  const data = await Promise.all(
    rows.map(async (row) => toAdminSpace(row, await recipeCount(ctx, row.id)))
  );
  return { data, total, counts: { GROUP: group, PERSONAL: personal, DELETING: deleting } };
}

async function adminSpace(ctx: Context, spaceId: string): Promise<AdminSpace> {
  const row = await ctx.db.space.findUnique({ where: { id: spaceId }, include: spaceInclude });
  if (!row) throw new AppError("ADMIN_008");
  return toAdminSpace(row, await recipeCount(ctx, spaceId));
}

/** Restaurer un espace en suppression, a la demande de son OWNER, avant la purge. */
export async function restoreSpace(
  ctx: Context,
  adminId: string,
  spaceId: string
): Promise<AdminSpace> {
  await ctx.db.$transaction(async (tx) => {
    const space = await tx.space.findUnique({ where: { id: spaceId } });
    if (!space) throw new AppError("ADMIN_008");
    if (!space.deletedAt || !space.purgeAfter || space.purgeAfter.getTime() <= Date.now()) {
      throw new AppError("ADMIN_015");
    }
    await tx.space.update({ where: { id: spaceId }, data: { deletedAt: null, purgeAfter: null } });
    await audit(tx, {
      adminId,
      action: "space.restored",
      targetType: "space",
      targetId: spaceId,
      data: { name: space.name },
    });
  });
  return adminSpace(ctx, spaceId);
}

// --- Acces de moderation ---

function toAccess(row: {
  id: string;
  spaceId: string;
  reason: ModerationReason;
  note: string;
  openedAt: Date;
  expiresAt: Date;
}): ModerationAccess {
  return {
    id: row.id,
    spaceId: row.spaceId,
    reason: row.reason,
    note: row.note,
    openedAt: row.openedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function openModeration(
  ctx: Context,
  adminId: string,
  spaceId: string,
  body: { reason: ModerationReason; note: string }
): Promise<ModerationAccess> {
  const row = await ctx.db.$transaction(async (tx) => {
    const space = await tx.space.findFirst({ where: { id: spaceId, deletedAt: null } });
    if (!space) throw new AppError("ADMIN_008");
    const access = await tx.moderationAccess.create({
      data: {
        adminId,
        spaceId,
        reason: body.reason,
        note: body.note,
        expiresAt: new Date(Date.now() + MODERATION_MINUTES * 60 * 1000),
      },
    });
    await audit(tx, {
      adminId,
      action: "moderation.opened",
      targetType: "space",
      targetId: spaceId,
      data: { name: space.name, reason: body.reason, note: body.note },
    });
    return access;
  });
  // L'OWNER est prevenu, avec le motif [D121, D172].
  await notify(ctx, {
    type: "core.moderation.opened",
    recipients: await ownerOf(ctx.db, spaceId),
    spaceId,
    data: { reason: body.reason, note: body.note },
  });
  return toAccess(row);
}

/** Acces valable de cet admin a cet espace (non supprime), sinon ADMIN_013. */
async function requireAccess(ctx: Context, adminId: string, spaceId: string) {
  const access = await ctx.db.moderationAccess.findFirst({
    where: { adminId, spaceId, expiresAt: { gt: new Date() }, space: { deletedAt: null } },
    orderBy: { expiresAt: "desc" },
  });
  if (!access) throw new AppError("ADMIN_013");
  return access;
}

export async function closeModeration(
  ctx: Context,
  adminId: string,
  spaceId: string
): Promise<void> {
  await requireAccess(ctx, adminId, spaceId);
  const space = await ctx.db.space.findUniqueOrThrow({ where: { id: spaceId } });
  await ctx.db.$transaction(async (tx) => {
    await tx.moderationAccess.updateMany({
      where: { adminId, spaceId, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    await audit(tx, {
      adminId,
      action: "moderation.closed",
      targetType: "space",
      targetId: spaceId,
      data: { name: space.name },
    });
  });
}

export async function moderationView(
  ctx: Context,
  adminId: string,
  spaceId: string
): Promise<ModerationSpace> {
  const access = await requireAccess(ctx, adminId, spaceId);
  const [space, recipes] = await Promise.all([
    adminSpace(ctx, spaceId),
    ctx.db.recipe.findMany({
      where: visibleIn(spaceId),
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        homeSpaceId: true,
        hiddenReason: true,
        hiddenAt: true,
        author: { select: { username: true } },
      },
    }),
  ]);
  return {
    access: toAccess(access),
    space,
    recipes: recipes.map((r) => ({
      id: r.id,
      title: r.title,
      author: r.author.username,
      atHome: r.homeSpaceId === spaceId,
      hiddenReason: r.hiddenAt ? (r.hiddenReason ?? "") : null,
    })),
  };
}

/** Recette visible dans l'espace modere, masquee comprise ; sinon ADMIN_008. */
async function moderatedRecipe(ctx: Context, spaceId: string, recipeId: string) {
  const recipe = await ctx.db.recipe.findFirst({
    where: { id: recipeId, ...visibleIn(spaceId) },
  });
  if (!recipe) throw new AppError("ADMIN_008");
  return recipe;
}

/** Lecture seule : aucun droit d'ecriture, masquee comprise [D52]. */
export async function moderationRecipe(
  ctx: Context,
  adminId: string,
  spaceId: string,
  recipeId: string
): Promise<Recipe> {
  await requireAccess(ctx, adminId, spaceId);
  await moderatedRecipe(ctx, spaceId, recipeId);
  // Acteur sans compte utilisateur : l'id admin ne correspond a aucun membre.
  return getRecipe(ctx, { userId: adminId, spaceId, moderate: false, seesHidden: true }, recipeId);
}

type RecipeAction = "hide" | "unhide" | "remove" | "delete";

const ACTION_KEYS: Record<RecipeAction, string> = {
  hide: "recipe.hidden",
  unhide: "recipe.unhidden",
  remove: "recipe.removed",
  delete: "recipe.deleted",
};

/**
 * Masquer, reafficher, retirer de cet espace de partage (la recette reste chez
 * son auteur) ou supprimer (de tous les espaces), avec motif sauf pour reafficher.
 */
export async function moderateRecipe(
  ctx: Context,
  adminId: string,
  spaceId: string,
  recipeId: string,
  action: RecipeAction,
  note: string | null
): Promise<void> {
  await requireAccess(ctx, adminId, spaceId);
  const recipe = await moderatedRecipe(ctx, spaceId, recipeId);
  if (action === "remove" && recipe.homeSpaceId === spaceId) throw new AppError("ADMIN_014");
  await ctx.db.$transaction(async (tx) => {
    const now = new Date();
    if (action === "hide") {
      await tx.recipe.update({
        where: { id: recipeId },
        data: { hiddenAt: now, hiddenReason: note },
      });
    } else if (action === "unhide") {
      await tx.recipe.update({
        where: { id: recipeId },
        data: { hiddenAt: null, hiddenReason: null },
      });
    } else if (action === "remove") {
      await unshareFrom(tx, recipeId, spaceId, null);
    } else {
      await tx.recipe.update({ where: { id: recipeId }, data: { deletedAt: now } });
    }
    await audit(tx, {
      adminId,
      action: ACTION_KEYS[action],
      targetType: "recipe",
      targetId: recipeId,
      data: { spaceId, title: recipe.title, ...(note ? { note } : {}) },
    });
  });
  await publishToSpace(ctx, spaceId, { type: "invalidate", spaceId, module: "recipes" });
}

/** Supprimer l'espace par moderation : masque, restaurable 30 jours, puis purge [D22]. */
export async function deleteSpaceByModeration(
  ctx: Context,
  adminId: string,
  spaceId: string,
  note: string
): Promise<void> {
  const access = await requireAccess(ctx, adminId, spaceId);
  const space = await ctx.db.space.findUniqueOrThrow({ where: { id: access.spaceId } });
  // L'espace perso ne se supprime pas : on modere son contenu [D02].
  if (space.kind === "PERSONAL") throw new AppError("SPACE_003");
  const recipients = await activeMembers(ctx.db, spaceId);
  await ctx.db.$transaction(async (tx) => {
    await softDelete(tx, spaceId);
    await audit(tx, {
      adminId,
      action: "space.deleted",
      targetType: "space",
      targetId: spaceId,
      data: { name: space.name, note },
    });
  });
  await notify(ctx, { type: "core.space.deleted", recipients, data: { spaceName: space.name } });
}

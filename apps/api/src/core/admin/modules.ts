// Admin, modules (C4.2) : file des demandes d'acces, decision, catalogue, acces
// accorde ou retire d'office [D33, D85]. L'acces est attache a l'espace ; une fois
// accorde, l'OWNER active le module quand il veut. Chaque decision est auditee.
// Les notifications (OWNER prevenu, admin prevenu d'une demande) arrivent en C6.

import type {
  AdminModule,
  AdminModuleGrant,
  AdminModuleRequest,
  ModuleStatus,
  SpaceLookupItem,
} from "@fm/shared";

import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { audit } from "./audit.ts";

const RECENT_DECISIONS = 20;

const spaceRef = { select: { id: true, name: true, tintIndex: true } } as const;
const requestInclude = {
  space: spaceRef,
  requestedBy: { select: { username: true } },
} as const;

type RequestRow = {
  id: string;
  moduleCode: string;
  status: AdminModuleRequest["status"];
  message: string | null;
  decisionNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  space: AdminModuleRequest["space"];
  requestedBy: { username: string };
};

function toRequest(row: RequestRow): AdminModuleRequest {
  return {
    id: row.id,
    moduleCode: row.moduleCode,
    status: row.status,
    message: row.message,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    space: row.space,
    requestedBy: row.requestedBy,
  };
}

export async function listRequests(
  ctx: Context
): Promise<{ pending: AdminModuleRequest[]; recent: AdminModuleRequest[] }> {
  const [pending, recent] = await Promise.all([
    ctx.db.moduleAccessRequest.findMany({
      where: { status: "PENDING" },
      include: requestInclude,
      orderBy: { createdAt: "asc" },
    }),
    ctx.db.moduleAccessRequest.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      include: requestInclude,
      orderBy: { decidedAt: "desc" },
      take: RECENT_DECISIONS,
    }),
  ]);
  return { pending: pending.map(toRequest), recent: recent.map(toRequest) };
}

type Tx = Parameters<Parameters<Context["db"]["$transaction"]>[0]>[0];

/** Accorde (ou rend) l'acces ; l'etat "active" choisi par l'OWNER est conserve [D85]. */
async function upsertGrant(tx: Tx, adminId: string, spaceId: string, moduleCode: string) {
  await tx.spaceModule.upsert({
    where: { spaceId_moduleCode: { spaceId, moduleCode } },
    create: { spaceId, moduleCode, grantedByAdminId: adminId },
    update: { revokedAt: null, grantedByAdminId: adminId, grantedAt: new Date() },
  });
}

async function decide(
  ctx: Context,
  adminId: string,
  id: string,
  approve: boolean,
  note: string | null
): Promise<AdminModuleRequest> {
  return ctx.db.$transaction(async (tx) => {
    const request = await tx.moduleAccessRequest.findUnique({ where: { id } });
    if (!request) throw new AppError("ADMIN_006");
    const { count } = await tx.moduleAccessRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
        decidedByAdminId: adminId,
        decisionNote: note,
      },
    });
    if (count === 0) throw new AppError("ADMIN_006");
    if (approve) await upsertGrant(tx, adminId, request.spaceId, request.moduleCode);
    await audit(tx, {
      adminId,
      action: approve ? "module-request.approved" : "module-request.rejected",
      targetType: "ModuleAccessRequest",
      targetId: id,
      data: {
        spaceId: request.spaceId,
        moduleCode: request.moduleCode,
        ...(note ? { note } : {}),
      },
    });
    const row = await tx.moduleAccessRequest.findUniqueOrThrow({
      where: { id },
      include: requestInclude,
    });
    return toRequest(row);
  });
}

export function approveRequest(ctx: Context, adminId: string, id: string) {
  return decide(ctx, adminId, id, true, null);
}

export function rejectRequest(ctx: Context, adminId: string, id: string, note: string) {
  return decide(ctx, adminId, id, false, note);
}

export async function listModules(ctx: Context): Promise<AdminModule[]> {
  const [modules, grants, enabled, pending] = await Promise.all([
    ctx.db.module.findMany({ orderBy: { sortOrder: "asc" } }),
    ctx.db.spaceModule.groupBy({
      by: ["moduleCode"],
      where: { revokedAt: null, space: { deletedAt: null } },
      _count: { _all: true },
    }),
    ctx.db.spaceModule.groupBy({
      by: ["moduleCode"],
      where: { revokedAt: null, enabled: true, space: { deletedAt: null } },
      _count: { _all: true },
    }),
    ctx.db.moduleAccessRequest.groupBy({
      by: ["moduleCode"],
      where: { status: "PENDING" },
      _count: { _all: true },
    }),
  ]);
  const count = (rows: { moduleCode: string; _count: { _all: number } }[], code: string) =>
    rows.find((row) => row.moduleCode === code)?._count._all ?? 0;
  return modules.map((module) => ({
    code: module.code,
    status: module.status,
    isDefault: module.isDefault,
    sortOrder: module.sortOrder,
    grantedCount: count(grants, module.code),
    enabledCount: count(enabled, module.code),
    pendingCount: count(pending, module.code),
  }));
}

async function findModule(ctx: Context, code: string) {
  const module = await ctx.db.module.findUnique({ where: { code } });
  if (!module) throw new AppError("MODULE_002");
  return module;
}

export async function setModuleStatus(
  ctx: Context,
  adminId: string,
  code: string,
  status: ModuleStatus
): Promise<AdminModule> {
  const module = await findModule(ctx, code);
  // Recettes est fourni a chaque espace : son statut ne bouge pas [D33].
  if (module.isDefault) throw new AppError("ADMIN_007");
  await ctx.db.$transaction(async (tx) => {
    await tx.module.update({ where: { code }, data: { status } });
    await audit(tx, {
      adminId,
      action: "module.status-changed",
      targetType: "Module",
      targetId: code,
      data: { from: module.status, to: status },
    });
  });
  const updated = (await listModules(ctx)).find((row) => row.code === code);
  if (!updated) throw new AppError("MODULE_002");
  return updated;
}

export async function listGrants(
  ctx: Context,
  code: string,
  offset: number,
  limit: number
): Promise<{ data: AdminModuleGrant[]; total: number }> {
  await findModule(ctx, code);
  const where = { moduleCode: code, revokedAt: null, space: { deletedAt: null } };
  const [rows, total] = await Promise.all([
    ctx.db.spaceModule.findMany({
      where,
      include: { space: spaceRef },
      orderBy: { grantedAt: "desc" },
      skip: offset,
      take: limit,
    }),
    ctx.db.spaceModule.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({
      space: row.space,
      grantedAt: row.grantedAt.toISOString(),
      byAdmin: row.grantedByAdminId !== null,
      enabled: row.enabled,
    })),
    total,
  };
}

/** Accorde d'office ; une demande en attente de cet espace est acceptee du meme coup. */
export async function grantToSpace(
  ctx: Context,
  adminId: string,
  code: string,
  spaceId: string
): Promise<void> {
  await findModule(ctx, code);
  const space = await ctx.db.space.findFirst({ where: { id: spaceId, deletedAt: null } });
  if (!space) throw new AppError("SPACE_001");
  const existing = await ctx.db.spaceModule.findUnique({
    where: { spaceId_moduleCode: { spaceId, moduleCode: code } },
  });
  if (existing && !existing.revokedAt) throw new AppError("MODULE_008");
  await ctx.db.$transaction(async (tx) => {
    await upsertGrant(tx, adminId, spaceId, code);
    await tx.moduleAccessRequest.updateMany({
      where: { spaceId, moduleCode: code, status: "PENDING" },
      data: { status: "APPROVED", decidedAt: new Date(), decidedByAdminId: adminId },
    });
    await audit(tx, {
      adminId,
      action: "module.granted",
      targetType: "Space",
      targetId: spaceId,
      data: { moduleCode: code },
    });
  });
}

/** Retire l'acces : le module est masque, ses donnees restent et reviennent avec l'acces [D85]. */
export async function revokeFromSpace(
  ctx: Context,
  adminId: string,
  code: string,
  spaceId: string
): Promise<void> {
  const module = await findModule(ctx, code);
  if (module.isDefault) throw new AppError("ADMIN_007");
  await ctx.db.$transaction(async (tx) => {
    const { count } = await tx.spaceModule.updateMany({
      where: { spaceId, moduleCode: code, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new AppError("MODULE_005");
    await audit(tx, {
      adminId,
      action: "module.revoked",
      targetType: "Space",
      targetId: spaceId,
      data: { moduleCode: code },
    });
  });
}

/** Espaces groupe actifs dont le nom contient la recherche (pour accorder un module). */
export async function lookupSpaces(ctx: Context, query: string): Promise<SpaceLookupItem[]> {
  const rows = await ctx.db.space.findMany({
    where: { kind: "GROUP", deletedAt: null, name: { contains: query, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      tintIndex: true,
      memberships: {
        where: { role: "OWNER", leftAt: null },
        select: { user: { select: { username: true } } },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 10,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tintIndex: row.tintIndex,
    ownerUsername: row.memberships[0]?.user.username ?? "",
  }));
}

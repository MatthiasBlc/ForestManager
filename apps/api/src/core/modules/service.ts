// Modules d'un espace (F-SPC-6) : catalogue [D54, D123], demandes d'acces
// [D33, D124], activation [D91], ordre [D131]. La decision sur une demande
// appartient au super admin (C4).

import type { CatalogModule, ModuleAccessRequest } from "@fm/shared";

import { recordActivity } from "../activity/service.ts";
import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { requireSpacePermission } from "../spaces/access.ts";

const OPEN_STATUSES = ["AVAILABLE", "BETA"] as const;

const requestSelect = {
  id: true,
  moduleCode: true,
  status: true,
  message: true,
  decisionNote: true,
  createdAt: true,
  decidedAt: true,
} as const;

type RequestRow = {
  id: string;
  moduleCode: string;
  status: ModuleAccessRequest["status"];
  message: string | null;
  decisionNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
};

function toRequest(row: RequestRow): ModuleAccessRequest {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

/** Catalogue vu depuis l'espace : modules accordes dans l'ordre de l'OWNER, puis les autres. */
export async function catalog(
  ctx: Context,
  spaceId: string,
  userId: string
): Promise<CatalogModule[]> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.modules.view");
  return buildCatalog(ctx, spaceId);
}

async function buildCatalog(ctx: Context, spaceId: string): Promise<CatalogModule[]> {
  const [modules, grants, requests] = await Promise.all([
    ctx.db.module.findMany({
      where: { status: { not: "RETIRED" } },
      orderBy: { sortOrder: "asc" },
    }),
    ctx.db.spaceModule.findMany({ where: { spaceId, revokedAt: null } }),
    ctx.db.moduleAccessRequest.findMany({
      where: { spaceId },
      select: requestSelect,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const grantByCode = new Map(grants.map((grant) => [grant.moduleCode, grant]));
  // Derniere demande par module, montree seulement si elle attend ou a ete refusee [D124].
  const lastByCode = new Map<string, RequestRow>();
  for (const request of requests) {
    if (!lastByCode.has(request.moduleCode)) lastByCode.set(request.moduleCode, request);
  }
  const rows = modules.map((module) => {
    const grant = grantByCode.get(module.code);
    const last = lastByCode.get(module.code);
    return {
      code: module.code,
      status: module.status,
      isDefault: module.isDefault,
      granted: grant !== undefined,
      enabled: grant?.enabled ?? false,
      sortOrder: grant?.sortOrder ?? module.sortOrder,
      lastRequest:
        last && (last.status === "PENDING" || last.status === "REJECTED") ? toRequest(last) : null,
    };
  });
  const granted = rows.filter((r) => r.granted).sort((a, b) => a.sortOrder - b.sortOrder);
  return [...granted, ...rows.filter((r) => !r.granted)];
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function requestAccess(
  ctx: Context,
  spaceId: string,
  userId: string,
  moduleCode: string,
  message: string | undefined
): Promise<ModuleAccessRequest> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.modules.manage");
  const module = await ctx.db.module.findUnique({ where: { code: moduleCode } });
  if (!module || module.status === "RETIRED") throw new AppError("MODULE_002");
  // Un module "bientot" se voit au catalogue mais ne se demande pas encore [D123].
  if (module.status === "COMING_SOON") throw new AppError("MODULE_003");
  const grant = await ctx.db.spaceModule.findUnique({
    where: { spaceId_moduleCode: { spaceId, moduleCode } },
  });
  if (grant && !grant.revokedAt) throw new AppError("MODULE_008");
  const pending = await ctx.db.moduleAccessRequest.count({
    where: { spaceId, moduleCode, status: "PENDING" },
  });
  if (pending > 0) throw new AppError("MODULE_004");
  try {
    const row = await ctx.db.moduleAccessRequest.create({
      data: { spaceId, moduleCode, requestedById: userId, message: message ?? null },
      select: requestSelect,
    });
    return toRequest(row);
  } catch (error) {
    // Index partiel : une seule demande en attente par (espace, module).
    if (isUniqueViolation(error)) throw new AppError("MODULE_004");
    throw error;
  }
}

export async function cancelRequest(
  ctx: Context,
  spaceId: string,
  userId: string,
  moduleCode: string
): Promise<void> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.modules.manage");
  const { count } = await ctx.db.moduleAccessRequest.updateMany({
    where: { spaceId, moduleCode, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (count === 0) throw new AppError("MODULE_007");
}

/** Active ou desactive un module accorde ; ses donnees restent dans tous les cas [D85]. */
export async function setEnabled(
  ctx: Context,
  spaceId: string,
  userId: string,
  moduleCode: string,
  enabled: boolean
): Promise<CatalogModule[]> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.modules.manage");
  const grant = await ctx.db.spaceModule.findUnique({
    where: { spaceId_moduleCode: { spaceId, moduleCode } },
    include: { module: { select: { status: true } } },
  });
  if (!grant || grant.revokedAt) throw new AppError("MODULE_005");
  const manifest = ctx.modules.find((m) => m.code === moduleCode);
  if (!enabled && manifest?.alwaysOn === true) throw new AppError("MODULE_006");
  if (enabled && !(OPEN_STATUSES as readonly string[]).includes(grant.module.status)) {
    throw new AppError("MODULE_003");
  }
  if (grant.enabled !== enabled) {
    await ctx.db.spaceModule.update({
      where: { id: grant.id },
      data: { enabled, enabledChangedAt: new Date() },
    });
    if (enabled) {
      await recordActivity(ctx, {
        spaceId,
        type: "core.module.enabled",
        actorId: userId,
        data: { moduleCode },
      });
    }
  }
  return buildCatalog(ctx, spaceId);
}

/** Ordre de la barre des modules [D131] : la liste complete des modules accordes. */
export async function reorder(
  ctx: Context,
  spaceId: string,
  userId: string,
  codes: string[]
): Promise<CatalogModule[]> {
  await requireSpacePermission(ctx.db, spaceId, userId, "space.modules.manage");
  const grants = await ctx.db.spaceModule.findMany({ where: { spaceId, revokedAt: null } });
  const granted = new Set(grants.map((g) => g.moduleCode));
  if (codes.length !== granted.size || codes.some((code) => !granted.has(code))) {
    throw new AppError("VALIDATION_001", [
      {
        location: "body",
        path: "codes",
        code: "custom",
        message: `expected exactly the granted modules: ${[...granted].sort().join(", ")}`,
      },
    ]);
  }
  await ctx.db.$transaction(
    codes.map((moduleCode, index) =>
      ctx.db.spaceModule.update({
        where: { spaceId_moduleCode: { spaceId, moduleCode } },
        data: { sortOrder: index },
      })
    )
  );
  return buildCatalog(ctx, spaceId);
}

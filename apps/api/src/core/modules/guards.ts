// Gardes des routeurs de module : requireModule (espace membre + module accorde
// et actif [D33]) puis requirePermission (role minimal du manifeste ou cle du socle).
import {
  CORE_PERMISSIONS,
  isAllowed,
  modulePermissionDefinition,
  uuidSchema,
  type CorePermissionKey,
} from "@fm/shared";
import type { Request, RequestHandler } from "express";

import type { Context } from "../context.ts";
import { currentUserId } from "../http/auth.ts";
import { AppError } from "../http/errors.ts";
import { authorize, loadAccess, type SpaceAccess } from "../spaces/access.ts";
import type { ApiModule } from "./registry.ts";

interface ModuleRequest {
  access: SpaceAccess;
  module: ApiModule;
}

const state = new WeakMap<Request, ModuleRequest>();

/** Acces a l'espace et module courant ; a appeler derriere requireModule. */
export function moduleRequest(req: Request): ModuleRequest {
  const value = state.get(req);
  if (!value) throw new Error("moduleRequest() called outside a module router");
  return value;
}

export function requireModule(ctx: Context, module: ApiModule): RequestHandler {
  return async (req, _res, next) => {
    const parsed = uuidSchema.safeParse(req.params.spaceId);
    if (!parsed.success) throw new AppError("VALIDATION_001");
    const spaceId = parsed.data;
    const access = await loadAccess(ctx.db, spaceId, currentUserId(req));
    const active = await ctx.db.spaceModule.count({
      where: {
        spaceId,
        moduleCode: module.code,
        enabled: true,
        revokedAt: null,
        module: { status: { in: ["AVAILABLE", "BETA"] } },
      },
    });
    if (active === 0) throw new AppError("MODULE_001");
    state.set(req, { access, module });
    next();
  };
}

function isCoreKey(key: string): key is CorePermissionKey {
  return Object.hasOwn(CORE_PERMISSIONS, key);
}

/** Vrai si l'utilisateur a cette permission du module courant (sans lever d'erreur). */
export function hasModulePermission(req: Request, key: string): boolean {
  const { access, module } = moduleRequest(req);
  const permission = module.permissions[key];
  if (!permission) throw new Error(`unknown permission "${key}" in module "${module.code}"`);
  return isAllowed(modulePermissionDefinition(permission), {
    authenticated: true,
    space: { kind: access.space.kind, role: access.role },
  });
}

/** Permission du module courant (role minimal du manifeste) ou du socle. */
export function requirePermission(key: string): RequestHandler {
  return (req, _res, next) => {
    const { access, module } = moduleRequest(req);
    if (module.permissions[key]) {
      if (!hasModulePermission(req, key)) throw new AppError("SPACE_002");
    } else if (isCoreKey(key)) {
      authorize(access, key);
    } else {
      throw new Error(`unknown permission "${key}" in module "${module.code}"`);
    }
    next();
  };
}

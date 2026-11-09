// Manifeste API du module Planning [D180 a D184] : calendrier continu, idees,
// profils et generation. Statut "bientot" jusqu'a la cloture de C5.
import { mealPlanSettingsSchema, updateMealPlanSettingsBodySchema } from "@fm/shared";
import { Router, type Request } from "express";

import type { Context } from "../../core/context.ts";
import { AppError } from "../../core/http/errors.ts";
import { handle, reply } from "../../core/http/validate.ts";
import {
  hasModulePermission,
  moduleRequest,
  requirePermission,
} from "../../core/modules/guards.ts";
import type { ApiModule } from "../../core/modules/registry.ts";
import { MEAL_PLAN_PERMISSIONS } from "./permissions.ts";
import { readSettings, saveSettings, toSettings } from "./settings.ts";

function rightsOf(req: Request) {
  return {
    edit: hasModulePermission(req, "meal-plan.edit"),
    manage: hasModulePermission(req, "meal-plan.manage"),
    setEditRole: hasModulePermission(req, "meal-plan.edit-role"),
  };
}

function mealPlanRouter(ctx: Context): Router {
  const router = Router();
  const spaceOf = (req: Request) => moduleRequest(req).access.space.id;

  // --- Reglages [D11, D58, D180] ---

  router.get("/settings", requirePermission("meal-plan.view"), async (req, res) => {
    const values = await readSettings(ctx.db, spaceOf(req));
    reply(res, mealPlanSettingsSchema, toSettings(values, rightsOf(req)));
  });

  router.put(
    "/settings",
    requirePermission("meal-plan.manage"),
    handle({ body: updateMealPlanSettingsBodySchema }, async ({ body }, req, res) => {
      const spaceId = spaceOf(req);
      const current = await readSettings(ctx.db, spaceId);
      const changesRole = body.editRole !== undefined && body.editRole !== current.editRole;
      if (changesRole && !hasModulePermission(req, "meal-plan.edit-role")) {
        throw new AppError("SPACE_002");
      }
      const values = await saveSettings(ctx.db, spaceId, body);
      // Les droits du lecteur dependent du role minimal qu'il vient peut-etre de changer.
      moduleRequest(req).roles = { "meal-plan.edit": values.editRole };
      reply(res, mealPlanSettingsSchema, toSettings(values, rightsOf(req)));
    })
  );

  return router;
}

export const mealPlanModule: ApiModule = {
  code: "meal-plan",
  catalog: { status: "COMING_SOON", sortOrder: 2 },
  permissions: MEAL_PLAN_PERMISSIONS,
  router: mealPlanRouter,
  roleOverrides: async (db, spaceId) => ({
    "meal-plan.edit": (await readSettings(db, spaceId)).editRole,
  }),
};

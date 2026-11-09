// Manifeste API du module Planning [D180 a D184] : calendrier continu, idees,
// profils et generation. Statut "bientot" jusqu'a la cloture de C5.
import {
  listSchema,
  mealSchema,
  mealsQuerySchema,
  mealPlanSettingsSchema,
  mealTimeSchema,
  planDateSchema,
  putMealBodySchema,
  swapMealsBodySchema,
  updateMealPlanSettingsBodySchema,
} from "@fm/shared";
import { Router, type Request } from "express";
import { z } from "zod";

import type { Context } from "../../core/context.ts";
import { currentUserId } from "../../core/http/auth.ts";
import { AppError } from "../../core/http/errors.ts";
import { handle, reply } from "../../core/http/validate.ts";
import {
  hasModulePermission,
  moduleRequest,
  requirePermission,
} from "../../core/modules/guards.ts";
import type { ApiModule } from "../../core/modules/registry.ts";
import { provide } from "../services.ts";
import { clearMeal, listMeals, putMeal, recipeStats, swapMeals } from "./meals.ts";
import { MEAL_PLAN_PERMISSIONS } from "./permissions.ts";
import { readSettings, saveSettings, toSettings } from "./settings.ts";

/** Case du calendrier dans l'URL : `/meals/2026-11-10/DINNER`. */
const cellParamsSchema = z.object({ date: planDateSchema, mealTime: mealTimeSchema });

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

  // --- Calendrier et repas [D180, D181, D184] ---

  router.get(
    "/meals",
    requirePermission("meal-plan.view"),
    handle({ query: mealsQuerySchema }, async ({ query }, req, res) => {
      const data = await listMeals(ctx, spaceOf(req), currentUserId(req), query.from, query.to);
      reply(res, listSchema(mealSchema), { data });
    })
  );

  router.post(
    "/meals/swap",
    requirePermission("meal-plan.edit"),
    handle({ body: swapMealsBodySchema }, async ({ body }, req, res) => {
      const data = await swapMeals(ctx, spaceOf(req), currentUserId(req), body);
      reply(res, listSchema(mealSchema), { data });
    })
  );

  router.put(
    "/meals/:date/:mealTime",
    requirePermission("meal-plan.edit"),
    handle(
      { params: cellParamsSchema, body: putMealBodySchema },
      async ({ params, body }, req, res) => {
        reply(res, mealSchema, await putMeal(ctx, spaceOf(req), currentUserId(req), params, body));
      }
    )
  );

  router.delete(
    "/meals/:date/:mealTime",
    requirePermission("meal-plan.edit"),
    handle({ params: cellParamsSchema }, async ({ params }, req, res) => {
      await clearMeal(ctx, spaceOf(req), params);
      res.status(204).end();
    })
  );

  return router;
}

export const mealPlanModule: ApiModule = {
  code: "meal-plan",
  catalog: { status: "COMING_SOON", sortOrder: 2 },
  permissions: MEAL_PLAN_PERMISSIONS,
  router: mealPlanRouter,
  requires: ["recipes.catalog"],
  provides: { "meal-plan.recipeStats": provide("meal-plan.recipeStats", recipeStats) },
  roleOverrides: async (db, spaceId) => ({
    "meal-plan.edit": (await readSettings(db, spaceId)).editRole,
  }),
};

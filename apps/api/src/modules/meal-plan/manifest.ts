// Manifeste API du module Planning [D180 a D184] : calendrier continu, idees,
// profils et generation. Statut "bientot" jusqu'a la cloture de C5.
import {
  applyGenerationBodySchema,
  applyGenerationResultSchema,
  generateBodySchema,
  generationPreviewSchema,
  suggestMealResultSchema,
  convertMealIdeaBodySchema,
  createGenerationProfileBodySchema,
  deleteGenerationProfileBodySchema,
  generationProfileSchema,
  generationProfileSummarySchema,
  putGridBodySchema,
  ruleBodySchema,
  ruleSchema,
  updateGenerationProfileBodySchema,
  listSchema,
  mealIdeaBodySchema,
  mealIdeaSchema,
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
import { applyGeneration, previewGeneration, suggestMeal } from "./generation.ts";
import { convertIdea, createIdea, deleteIdea, listIdeas, updateIdea } from "./ideas.ts";
import { clearMeal, listMeals, putMeal, recipeStats, swapMeals } from "./meals.ts";
import { MEAL_PLAN_PERMISSIONS } from "./permissions.ts";
import {
  addRule,
  createProfile,
  deleteProfile,
  deleteRule,
  duplicateProfile,
  listProfiles,
  putGrid,
  readProfile,
  readRule,
  updateProfile,
  updateRule,
} from "./profiles.ts";
import { readSettings, saveSettings, toSettings } from "./settings.ts";

/** Case du calendrier dans l'URL : `/meals/2026-11-10/DINNER`. */
const cellParamsSchema = z.object({ date: planDateSchema, mealTime: mealTimeSchema });
const ideaParamsSchema = z.object({ ideaId: z.uuid() });
const profileParamsSchema = z.object({ profileId: z.uuid() });
const ruleParamsSchema = z.object({ profileId: z.uuid(), ruleId: z.uuid() });

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

  // "Proposer un autre repas" : meme droit que modifier un repas [D58].
  router.post(
    "/meals/:date/:mealTime/suggest",
    requirePermission("meal-plan.edit"),
    handle({ params: cellParamsSchema }, async ({ params }, req, res) => {
      const result = await suggestMeal(ctx, spaceOf(req), currentUserId(req), params);
      reply(res, suggestMealResultSchema, result);
    })
  );

  router.delete(
    "/meals/:date/:mealTime",
    requirePermission("meal-plan.edit"),
    handle({ params: cellParamsSchema }, async ({ params }, req, res) => {
      await clearMeal(ctx, spaceOf(req), params);
      res.status(204).end();
    })
  );

  // --- Generation [D110, D113, D184] : moderateurs et OWNER ---

  router.post(
    "/generate",
    requirePermission("meal-plan.manage"),
    handle({ body: generateBodySchema }, async ({ body }, req, res) => {
      reply(res, generationPreviewSchema, await previewGeneration(ctx, spaceOf(req), body));
    })
  );

  router.post(
    "/generate/apply",
    requirePermission("meal-plan.manage"),
    handle({ body: applyGenerationBodySchema }, async ({ body }, req, res) => {
      const result = await applyGeneration(ctx, spaceOf(req), currentUserId(req), body);
      reply(res, applyGenerationResultSchema, result);
    })
  );

  // --- Idees de repas [D182] ---

  const viewerOf = (req: Request) => ({
    id: currentUserId(req),
    moderate: hasModulePermission(req, "meal-plan.ideas.moderate"),
  });

  router.get("/ideas", requirePermission("meal-plan.view"), async (req, res) => {
    const data = await listIdeas(ctx.db, spaceOf(req), viewerOf(req));
    reply(res, listSchema(mealIdeaSchema), { data });
  });

  router.post(
    "/ideas",
    requirePermission("meal-plan.ideas.create"),
    handle({ body: mealIdeaBodySchema }, async ({ body }, req, res) => {
      const idea = await createIdea(ctx.db, spaceOf(req), viewerOf(req), body);
      reply(res, mealIdeaSchema, idea, 201);
    })
  );

  router.put(
    "/ideas/:ideaId",
    requirePermission("meal-plan.ideas.create"),
    handle(
      { params: ideaParamsSchema, body: mealIdeaBodySchema },
      async ({ params, body }, req, res) => {
        const idea = await updateIdea(ctx.db, spaceOf(req), params.ideaId, viewerOf(req), body);
        reply(res, mealIdeaSchema, idea);
      }
    )
  );

  router.delete(
    "/ideas/:ideaId",
    requirePermission("meal-plan.ideas.create"),
    handle({ params: ideaParamsSchema }, async ({ params }, req, res) => {
      await deleteIdea(ctx.db, spaceOf(req), params.ideaId, viewerOf(req));
      res.status(204).end();
    })
  );

  router.post(
    "/ideas/:ideaId/convert",
    requirePermission("meal-plan.ideas.create"),
    handle(
      { params: ideaParamsSchema, body: convertMealIdeaBodySchema },
      async ({ params, body }, req, res) => {
        await convertIdea(ctx, spaceOf(req), params.ideaId, viewerOf(req), body);
        res.status(204).end();
      }
    )
  );

  // --- Profils de generation [D58, D114, D183, D184] : moderateurs et OWNER ---

  const manage = requirePermission("meal-plan.manage");
  const profile = (req: Request, profileId: string) =>
    readProfile(ctx, spaceOf(req), currentUserId(req), profileId);

  router.get("/profiles", manage, async (req, res) => {
    const data = await listProfiles(ctx.db, spaceOf(req));
    reply(res, listSchema(generationProfileSummarySchema), { data });
  });

  router.post(
    "/profiles",
    manage,
    handle({ body: createGenerationProfileBodySchema }, async ({ body }, req, res) => {
      const id = await createProfile(ctx.db, spaceOf(req), body);
      reply(res, generationProfileSchema, await profile(req, id), 201);
    })
  );

  router.get(
    "/profiles/:profileId",
    manage,
    handle({ params: profileParamsSchema }, async ({ params }, req, res) => {
      reply(res, generationProfileSchema, await profile(req, params.profileId));
    })
  );

  router.patch(
    "/profiles/:profileId",
    manage,
    handle(
      { params: profileParamsSchema, body: updateGenerationProfileBodySchema },
      async ({ params, body }, req, res) => {
        await updateProfile(ctx.db, spaceOf(req), params.profileId, body);
        reply(res, generationProfileSchema, await profile(req, params.profileId));
      }
    )
  );

  router.delete(
    "/profiles/:profileId",
    manage,
    handle(
      { params: profileParamsSchema, body: deleteGenerationProfileBodySchema },
      async ({ params, body }, req, res) => {
        await deleteProfile(ctx.db, spaceOf(req), params.profileId, body.defaultId);
        res.status(204).end();
      }
    )
  );

  router.post(
    "/profiles/:profileId/duplicate",
    manage,
    handle({ params: profileParamsSchema }, async ({ params }, req, res) => {
      const id = await duplicateProfile(ctx.db, spaceOf(req), params.profileId);
      reply(res, generationProfileSchema, await profile(req, id), 201);
    })
  );

  router.put(
    "/profiles/:profileId/grid",
    manage,
    handle(
      { params: profileParamsSchema, body: putGridBodySchema },
      async ({ params, body }, req, res) => {
        await putGrid(ctx.db, spaceOf(req), params.profileId, body);
        reply(res, generationProfileSchema, await profile(req, params.profileId));
      }
    )
  );

  router.post(
    "/profiles/:profileId/rules",
    manage,
    handle(
      { params: profileParamsSchema, body: ruleBodySchema },
      async ({ params, body }, req, res) => {
        const viewerId = currentUserId(req);
        const id = await addRule(ctx, spaceOf(req), viewerId, params.profileId, body);
        reply(
          res,
          ruleSchema,
          await readRule(ctx, spaceOf(req), viewerId, params.profileId, id),
          201
        );
      }
    )
  );

  router.put(
    "/profiles/:profileId/rules/:ruleId",
    manage,
    handle(
      { params: ruleParamsSchema, body: ruleBodySchema },
      async ({ params, body }, req, res) => {
        const viewerId = currentUserId(req);
        const { profileId, ruleId } = params;
        await updateRule(ctx, spaceOf(req), viewerId, profileId, ruleId, body);
        reply(res, ruleSchema, await readRule(ctx, spaceOf(req), viewerId, profileId, ruleId));
      }
    )
  );

  router.delete(
    "/profiles/:profileId/rules/:ruleId",
    manage,
    handle({ params: ruleParamsSchema }, async ({ params }, req, res) => {
      await deleteRule(ctx.db, spaceOf(req), params.profileId, params.ruleId);
      res.status(204).end();
    })
  );

  return router;
}

export const mealPlanModule: ApiModule = {
  code: "meal-plan",
  catalog: { status: "AVAILABLE", sortOrder: 2 },
  permissions: MEAL_PLAN_PERMISSIONS,
  // Notifications et activite (C6.5) [D41].
  notificationCategories: { "meal-plan.planning": {} },
  notificationTypes: {
    "meal-plan.plan.generated": { category: "meal-plan.planning" },
    "meal-plan.meal.changed": { category: "meal-plan.planning" },
  },
  activityTypes: ["meal-plan.plan.generated"],
  router: mealPlanRouter,
  requires: ["recipes.catalog"],
  provides: { "meal-plan.recipeStats": provide("meal-plan.recipeStats", recipeStats) },
  roleOverrides: async (db, spaceId) => ({
    "meal-plan.edit": (await readSettings(db, spaceId)).editRole,
  }),
};

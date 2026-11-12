// Routes des referentiels : /api/v1/units, /ingredients, /tags (tags globaux).
import {
  createIngredientBodySchema,
  ingredientQuerySchema,
  ingredientSchema,
  listSchema,
  tagSchema,
  unitSchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../core/context.ts";
import { currentUserId, requireAuth } from "../core/http/auth.ts";
import { createRateLimiter } from "../core/http/security.ts";
import { handle, reply } from "../core/http/validate.ts";
import * as referentials from "./service.ts";

export function referentialsRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  const createLimiter = createRateLimiter(rateLimit, { windowMs: 60 * 60 * 1000, limit: 200 });

  router.get("/units", requireAuth, async (_req, res) => {
    reply(res, listSchema(unitSchema), { data: await referentials.listUnits(ctx) });
  });

  router.get("/tags", requireAuth, async (_req, res) => {
    reply(res, listSchema(tagSchema), { data: await referentials.listGlobalTags(ctx) });
  });

  router.get(
    "/ingredients",
    requireAuth,
    handle({ query: ingredientQuerySchema }, async ({ query }, _req, res) => {
      const data = await referentials.searchIngredients(ctx, query.q, query.limit);
      reply(res, listSchema(ingredientSchema), { data });
    })
  );

  router.post(
    "/ingredients",
    requireAuth,
    createLimiter,
    handle({ body: createIngredientBodySchema }, async ({ body }, req, res) => {
      const { ingredient, created } = await referentials.findOrCreateIngredient(
        ctx,
        body.name,
        currentUserId(req)
      );
      reply(res, ingredientSchema, ingredient, created ? 201 : 200);
    })
  );

  return router;
}

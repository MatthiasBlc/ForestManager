// Routes admin des espaces et de la moderation (C4.5), montees derriere requireAdmin.
import {
  adminSpaceListSchema,
  adminSpaceSchema,
  adminSpacesQuerySchema,
  idParamsSchema,
  moderationAccessSchema,
  moderationActionBodySchema,
  moderationRecipeParamsSchema,
  moderationSpaceSchema,
  openModerationBodySchema,
  recipeSchema,
  spaceIdParamsSchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { handle, reply } from "../http/validate.ts";
import { currentAdminId } from "./session.ts";
import * as spaces from "./spaces.ts";

export function adminSpacesRouter(ctx: Context): Router {
  const router = Router();

  router.get(
    "/spaces",
    handle({ query: adminSpacesQuerySchema }, async ({ query }, _req, res) => {
      reply(res, adminSpaceListSchema, await spaces.listSpaces(ctx, query));
    })
  );

  router.post(
    "/spaces/:id/restore",
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      reply(res, adminSpaceSchema, await spaces.restoreSpace(ctx, currentAdminId(req), params.id));
    })
  );

  router.post(
    "/spaces/:id/moderation",
    handle(
      { params: idParamsSchema, body: openModerationBodySchema },
      async ({ params, body }, req, res) => {
        const access = await spaces.openModeration(ctx, currentAdminId(req), params.id, body);
        reply(res, moderationAccessSchema, access, 201);
      }
    )
  );

  // --- Vue de moderation (acces valable requis) ---

  router.get(
    "/moderation/:spaceId",
    handle({ params: spaceIdParamsSchema }, async ({ params }, req, res) => {
      const view = await spaces.moderationView(ctx, currentAdminId(req), params.spaceId);
      reply(res, moderationSpaceSchema, view);
    })
  );

  router.post(
    "/moderation/:spaceId/close",
    handle({ params: spaceIdParamsSchema }, async ({ params }, req, res) => {
      await spaces.closeModeration(ctx, currentAdminId(req), params.spaceId);
      res.status(204).end();
    })
  );

  router.post(
    "/moderation/:spaceId/delete-space",
    handle(
      { params: spaceIdParamsSchema, body: moderationActionBodySchema },
      async ({ params, body }, req, res) => {
        await spaces.deleteSpaceByModeration(ctx, currentAdminId(req), params.spaceId, body.note);
        res.status(204).end();
      }
    )
  );

  router.get(
    "/moderation/:spaceId/recipes/:recipeId",
    handle({ params: moderationRecipeParamsSchema }, async ({ params }, req, res) => {
      const recipe = await spaces.moderationRecipe(
        ctx,
        currentAdminId(req),
        params.spaceId,
        params.recipeId
      );
      reply(res, recipeSchema, recipe);
    })
  );

  for (const action of ["hide", "remove", "delete"] as const) {
    router.post(
      `/moderation/:spaceId/recipes/:recipeId/${action}`,
      handle(
        { params: moderationRecipeParamsSchema, body: moderationActionBodySchema },
        async ({ params, body }, req, res) => {
          await spaces.moderateRecipe(
            ctx,
            currentAdminId(req),
            params.spaceId,
            params.recipeId,
            action,
            body.note
          );
          res.status(204).end();
        }
      )
    );
  }

  router.post(
    "/moderation/:spaceId/recipes/:recipeId/unhide",
    handle({ params: moderationRecipeParamsSchema }, async ({ params }, req, res) => {
      await spaces.moderateRecipe(
        ctx,
        currentAdminId(req),
        params.spaceId,
        params.recipeId,
        "unhide",
        null
      );
      res.status(204).end();
    })
  );

  return router;
}

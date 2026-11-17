// Routes des modules d'un espace : catalogue, demandes d'acces, activation, ordre.
import {
  catalogModuleSchema,
  listSchema,
  moduleAccessRequestBodySchema,
  moduleAccessRequestSchema,
  reorderModulesBodySchema,
  setModuleEnabledBodySchema,
  spaceModuleParamsSchema,
  spaceParamsSchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { handle, reply } from "../http/validate.ts";
import * as modules from "./service.ts";

const catalogSchema = listSchema(catalogModuleSchema);

export function modulesRouter(ctx: Context): Router {
  const router = Router();

  router.get(
    "/spaces/:spaceId/modules",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      reply(res, catalogSchema, {
        data: await modules.catalog(ctx, params.spaceId, currentUserId(req)),
      });
    })
  );

  // Declaree avant /:moduleCode : "order" n'est pas un code de module (PUT seulement).
  router.put(
    "/spaces/:spaceId/modules/order",
    requireAuth,
    handle(
      { params: spaceParamsSchema, body: reorderModulesBodySchema },
      async ({ params, body }, req, res) => {
        const data = await modules.reorder(ctx, params.spaceId, currentUserId(req), body.codes);
        reply(res, catalogSchema, { data });
      }
    )
  );

  router.patch(
    "/spaces/:spaceId/modules/:moduleCode",
    requireAuth,
    handle(
      { params: spaceModuleParamsSchema, body: setModuleEnabledBodySchema },
      async ({ params, body }, req, res) => {
        const data = await modules.setEnabled(
          ctx,
          params.spaceId,
          currentUserId(req),
          params.moduleCode,
          body.enabled
        );
        reply(res, catalogSchema, { data });
      }
    )
  );

  router.post(
    "/spaces/:spaceId/modules/:moduleCode/requests",
    requireAuth,
    handle(
      { params: spaceModuleParamsSchema, body: moduleAccessRequestBodySchema },
      async ({ params, body }, req, res) => {
        const request = await modules.requestAccess(
          ctx,
          params.spaceId,
          currentUserId(req),
          params.moduleCode,
          body.message
        );
        reply(res, moduleAccessRequestSchema, request, 201);
      }
    )
  );

  router.post(
    "/spaces/:spaceId/modules/:moduleCode/requests/cancel",
    requireAuth,
    handle({ params: spaceModuleParamsSchema }, async ({ params }, req, res) => {
      await modules.cancelRequest(ctx, params.spaceId, currentUserId(req), params.moduleCode);
      res.status(204).end();
    })
  );

  return router;
}

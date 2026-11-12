// Routes admin des modules (C4.2), montees derriere requireAdmin.
import {
  adminModuleGrantSchema,
  adminModuleRequestSchema,
  adminModuleRequestsSchema,
  adminModuleSchema,
  grantModuleBodySchema,
  idParamsSchema,
  listSchema,
  moduleCodeSchema,
  offsetPageSchema,
  offsetQuerySchema,
  rejectModuleRequestBodySchema,
  setModuleStatusBodySchema,
  spaceLookupItemSchema,
  spaceLookupQuerySchema,
  uuidSchema,
} from "@fm/shared";
import { Router } from "express";
import { z } from "zod";

import type { Context } from "../context.ts";
import { handle, reply } from "../http/validate.ts";
import * as modules from "./modules.ts";
import { currentAdminId } from "./session.ts";

const codeParams = z.strictObject({ code: moduleCodeSchema });
const grantParams = z.strictObject({ code: moduleCodeSchema, spaceId: uuidSchema });

export function adminModulesRouter(ctx: Context): Router {
  const router = Router();

  router.get("/module-requests", async (_req, res) => {
    reply(res, adminModuleRequestsSchema, await modules.listRequests(ctx));
  });

  router.post(
    "/module-requests/:id/approve",
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      reply(
        res,
        adminModuleRequestSchema,
        await modules.approveRequest(ctx, currentAdminId(req), params.id)
      );
    })
  );

  router.post(
    "/module-requests/:id/reject",
    handle(
      { params: idParamsSchema, body: rejectModuleRequestBodySchema },
      async ({ params, body }, req, res) => {
        reply(
          res,
          adminModuleRequestSchema,
          await modules.rejectRequest(ctx, currentAdminId(req), params.id, body.note)
        );
      }
    )
  );

  router.get("/modules", async (_req, res) => {
    reply(res, listSchema(adminModuleSchema), { data: await modules.listModules(ctx) });
  });

  router.patch(
    "/modules/:code",
    handle(
      { params: codeParams, body: setModuleStatusBodySchema },
      async ({ params, body }, req, res) => {
        reply(
          res,
          adminModuleSchema,
          await modules.setModuleStatus(ctx, currentAdminId(req), params.code, body.status)
        );
      }
    )
  );

  router.get(
    "/modules/:code/spaces",
    handle(
      { params: codeParams, query: offsetQuerySchema },
      async ({ params, query }, _req, res) => {
        reply(
          res,
          offsetPageSchema(adminModuleGrantSchema),
          await modules.listGrants(ctx, params.code, query.offset, query.limit)
        );
      }
    )
  );

  router.post(
    "/modules/:code/grants",
    handle(
      { params: codeParams, body: grantModuleBodySchema },
      async ({ params, body }, req, res) => {
        await modules.grantToSpace(ctx, currentAdminId(req), params.code, body.spaceId);
        res.status(201).end();
      }
    )
  );

  router.delete(
    "/modules/:code/grants/:spaceId",
    handle({ params: grantParams }, async ({ params }, req, res) => {
      await modules.revokeFromSpace(ctx, currentAdminId(req), params.code, params.spaceId);
      res.status(204).end();
    })
  );

  router.get(
    "/spaces/lookup",
    handle({ query: spaceLookupQuerySchema }, async ({ query }, _req, res) => {
      reply(res, listSchema(spaceLookupItemSchema), {
        data: await modules.lookupSpaces(ctx, query.query),
      });
    })
  );

  return router;
}

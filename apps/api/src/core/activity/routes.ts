// Route du fil d'activite : GET /spaces/:spaceId/activity (membres d'un groupe).
import { activityEventSchema, cursorQuerySchema, pageSchema, spaceParamsSchema } from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { handle, reply } from "../http/validate.ts";
import { listActivity } from "./service.ts";

export function activityRouter(ctx: Context): Router {
  const router = Router();
  router.get(
    "/spaces/:spaceId/activity",
    requireAuth,
    handle(
      { params: spaceParamsSchema, query: cursorQuerySchema },
      async ({ params, query }, req, res) => {
        const page = await listActivity(ctx, params.spaceId, currentUserId(req), query);
        reply(res, pageSchema(activityEventSchema), page);
      }
    )
  );
  return router;
}

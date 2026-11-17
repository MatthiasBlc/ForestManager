// Changelog (C6.6) [D187] : versions de l'admin (A10, derriere requireAdmin) et
// versions publiees des utilisateurs (Nouveautes).
import {
  adminReleaseSchema,
  idParamsSchema,
  listSchema,
  publishReleaseBodySchema,
  releaseSchema,
  updateReleaseBodySchema,
} from "@fm/shared";
import { Router } from "express";

import { currentAdminId } from "../admin/session.ts";
import type { Context } from "../context.ts";
import { requireAuth } from "../http/auth.ts";
import { handle, reply } from "../http/validate.ts";
import * as changelog from "./service.ts";

export function adminChangelogRouter(ctx: Context): Router {
  const router = Router();

  router.get("/releases", async (_req, res) => {
    reply(res, listSchema(adminReleaseSchema), { data: await changelog.listReleases(ctx) });
  });

  router.patch(
    "/releases/:id",
    handle(
      { params: idParamsSchema, body: updateReleaseBodySchema },
      async ({ params, body }, req, res) => {
        const release = await changelog.updateRelease(ctx, currentAdminId(req), params.id, body);
        reply(res, adminReleaseSchema, release);
      }
    )
  );

  router.post(
    "/releases/:id/publish",
    handle(
      { params: idParamsSchema, body: publishReleaseBodySchema },
      async ({ params, body }, req, res) => {
        const release = await changelog.publishRelease(
          ctx,
          currentAdminId(req),
          params.id,
          body.notify
        );
        reply(res, adminReleaseSchema, release);
      }
    )
  );

  router.post(
    "/releases/:id/hide",
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      reply(
        res,
        adminReleaseSchema,
        await changelog.hideRelease(ctx, currentAdminId(req), params.id)
      );
    })
  );

  router.post(
    "/releases/:id/show",
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      reply(
        res,
        adminReleaseSchema,
        await changelog.showRelease(ctx, currentAdminId(req), params.id)
      );
    })
  );

  return router;
}

export function changelogRouter(ctx: Context): Router {
  const router = Router();
  router.get("/releases", requireAuth, async (_req, res) => {
    reply(res, listSchema(releaseSchema), { data: await changelog.publishedReleases(ctx) });
  });
  return router;
}

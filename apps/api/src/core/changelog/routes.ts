// Changelog (C6.6) [D187] : versions de l'admin (A10, derriere requireAdmin) et
// versions publiees des utilisateurs (Nouveautes), lisibles sans connexion pour
// les versions publiques [D226].
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
import { createRateLimiter } from "../http/security.ts";
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

export function changelogRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  // Route ouverte aux visiteurs : debit limite.
  const limiter = createRateLimiter(rateLimit, { windowMs: 60 * 1000, limit: 60 });
  router.get("/releases", limiter, async (req, res) => {
    // Session complete seulement : un mot de passe temporaire [D134] lit comme un visiteur.
    const signedIn = Boolean(req.session.userId) && !req.session.passwordChoice;
    reply(res, listSchema(releaseSchema), {
      data: await changelog.publishedReleases(ctx, !signedIn),
    });
  });
  return router;
}

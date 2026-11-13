// /me/exports : demander un export, relire son statut, telecharger l'archive
// (F-EXPORT, P12) [D37, D192].
import { createExportBodySchema, dataExportSchema, idParamsSchema } from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { createRateLimiter } from "../http/security.ts";
import { handle, reply } from "../http/validate.ts";
import { createExport, getExport, readArchive, runExport } from "./service.ts";

export function exportsRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  const limiter = createRateLimiter(rateLimit, { windowMs: 60 * 60 * 1000, limit: 20 });

  router.post(
    "/me/exports",
    requireAuth,
    limiter,
    handle({ body: createExportBodySchema }, async ({ body }, req, res) => {
      const created = await createExport(ctx, currentUserId(req), body);
      reply(res, dataExportSchema, created, 202);
      // Generation apres la reponse : l'ecran relit le statut.
      setImmediate(() => {
        void runExport(ctx, created.id);
      });
    })
  );

  router.get(
    "/me/exports/:id",
    requireAuth,
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      reply(res, dataExportSchema, await getExport(ctx, currentUserId(req), params.id));
    })
  );

  router.get(
    "/me/exports/:id/download",
    requireAuth,
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      const archive = await readArchive(ctx, currentUserId(req), params.id);
      res
        .status(200)
        .type("application/zip")
        .set("Content-Disposition", `attachment; filename="${archive.name}"`)
        .set("Cache-Control", "private, no-store")
        .send(archive.data);
    })
  );
  return router;
}

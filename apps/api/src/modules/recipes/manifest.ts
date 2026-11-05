// Manifeste API du module Recettes [D33, D91]. Les routes se completent au fil de C3.
import {
  listSchema,
  mergeTagBodySchema,
  spaceTagParamsSchema,
  tagNameBodySchema,
  tagSchema,
} from "@fm/shared";
import { Router } from "express";
import { z } from "zod";

import type { Context } from "../../core/context.ts";
import { currentUserId } from "../../core/http/auth.ts";
import { handle, reply } from "../../core/http/validate.ts";
import { moduleRequest, requirePermission } from "../../core/modules/guards.ts";
import type { ApiModule } from "../../core/modules/registry.ts";
import * as tags from "./tags.ts";

const tagParamsSchema = spaceTagParamsSchema.pick({ tagId: true });

function recipesRouter(ctx: Context): Router {
  const router = Router();
  const spaceOf = (req: Parameters<typeof moduleRequest>[0]) => moduleRequest(req).access.space.id;

  // Provisoire (C3.2 le remplace) : liste vide.
  router.get("/", requirePermission("recipes.view"), (_req, res) => {
    reply(res, listSchema(z.unknown()), { data: [] });
  });

  // --- Tags d'espace [D08, D19] ---

  router.get("/tags", requirePermission("recipes.view"), async (req, res) => {
    reply(res, listSchema(tagSchema), { data: await tags.listSpaceTags(ctx, spaceOf(req)) });
  });

  router.post(
    "/tags",
    requirePermission("recipes.tags.create"),
    handle({ body: tagNameBodySchema }, async ({ body }, req, res) => {
      const { tag, created } = await tags.findOrCreateSpaceTag(
        ctx,
        spaceOf(req),
        body.name,
        currentUserId(req)
      );
      reply(res, tagSchema, tag, created ? 201 : 200);
    })
  );

  router.patch(
    "/tags/:tagId",
    requirePermission("recipes.tags.moderate"),
    handle(
      { params: tagParamsSchema, body: tagNameBodySchema },
      async ({ params, body }, req, res) => {
        reply(
          res,
          tagSchema,
          await tags.renameSpaceTag(ctx, spaceOf(req), params.tagId, body.name)
        );
      }
    )
  );

  router.post(
    "/tags/:tagId/merge",
    requirePermission("recipes.tags.moderate"),
    handle(
      { params: tagParamsSchema, body: mergeTagBodySchema },
      async ({ params, body }, req, res) => {
        await tags.mergeSpaceTag(ctx, spaceOf(req), params.tagId, body.intoTagId);
        res.status(204).end();
      }
    )
  );

  router.delete(
    "/tags/:tagId",
    requirePermission("recipes.tags.moderate"),
    handle({ params: tagParamsSchema }, async ({ params }, req, res) => {
      await tags.deleteSpaceTag(ctx, spaceOf(req), params.tagId);
      res.status(204).end();
    })
  );

  return router;
}

export const recipesModule: ApiModule = {
  code: "recipes",
  alwaysOn: true,
  catalog: { status: "AVAILABLE", isDefault: true, sortOrder: 1 },
  // Matrice B2 (12-Permissions.md, Recettes et Tags) : roles minimaux par defaut.
  permissions: {
    "recipes.view": { minRole: "MEMBER" },
    "recipes.create": { minRole: "MEMBER" },
    "recipes.moderate": { minRole: "MODERATOR" },
    "recipes.tags.create": { minRole: "MEMBER" },
    "recipes.tags.moderate": { minRole: "MODERATOR" },
  },
  router: recipesRouter,
};

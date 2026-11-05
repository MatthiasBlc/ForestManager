// Manifeste API du module Recettes [D33, D91]. Les routes se completent au fil de C3.
import {
  createRecipeBodySchema,
  listSchema,
  mergeTagBodySchema,
  pageSchema,
  recipeListQuerySchema,
  recipeParamsSchema,
  recipeSchema,
  recipeSpaceTagsBodySchema,
  recipeSummarySchema,
  updateRecipeBodySchema,
  spaceTagParamsSchema,
  tagNameBodySchema,
  tagSchema,
} from "@fm/shared";
import { Router, type Request } from "express";

import type { Context } from "../../core/context.ts";
import { currentUserId } from "../../core/http/auth.ts";
import { handle, reply } from "../../core/http/validate.ts";
import {
  hasModulePermission,
  moduleRequest,
  requirePermission,
} from "../../core/modules/guards.ts";
import type { ApiModule } from "../../core/modules/registry.ts";
import { listRecipes } from "./list.ts";
import * as recipes from "./service.ts";
import * as tags from "./tags.ts";

const tagParamsSchema = spaceTagParamsSchema.pick({ tagId: true });
const recipeIdSchema = recipeParamsSchema.pick({ recipeId: true });

function actorOf(req: Request): recipes.RecipeActor {
  return {
    userId: currentUserId(req),
    spaceId: moduleRequest(req).access.space.id,
    moderate: hasModulePermission(req, "recipes.moderate"),
  };
}

function recipesRouter(ctx: Context): Router {
  const router = Router();
  const spaceOf = (req: Parameters<typeof moduleRequest>[0]) => moduleRequest(req).access.space.id;

  // --- Recettes [F-REC-1, F-REC-4, F-REC-10, F-REC-11] ---

  router.get(
    "/",
    requirePermission("recipes.view"),
    handle({ query: recipeListQuerySchema }, async ({ query }, req, res) => {
      reply(res, pageSchema(recipeSummarySchema), await listRecipes(ctx, spaceOf(req), query));
    })
  );

  router.post(
    "/",
    requirePermission("recipes.create"),
    handle({ body: createRecipeBodySchema }, async ({ body }, req, res) => {
      reply(res, recipeSchema, await recipes.createRecipe(ctx, actorOf(req), body), 201);
    })
  );

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

  router.get(
    "/:recipeId",
    requirePermission("recipes.view"),
    handle({ params: recipeIdSchema }, async ({ params }, req, res) => {
      reply(res, recipeSchema, await recipes.getRecipe(ctx, actorOf(req), params.recipeId));
    })
  );

  // Droits fins (auteur, moderateur de l'espace d'origine) verifies par le service.
  router.put(
    "/:recipeId",
    requirePermission("recipes.view"),
    handle(
      { params: recipeIdSchema, body: updateRecipeBodySchema },
      async ({ params, body }, req, res) => {
        const recipe = await recipes.updateRecipe(ctx, actorOf(req), params.recipeId, body);
        reply(res, recipeSchema, recipe);
      }
    )
  );

  router.delete(
    "/:recipeId",
    requirePermission("recipes.view"),
    handle({ params: recipeIdSchema }, async ({ params }, req, res) => {
      await recipes.deleteRecipe(ctx, actorOf(req), params.recipeId);
      res.status(204).end();
    })
  );

  router.put(
    "/:recipeId/space-tags",
    requirePermission("recipes.tags.create"),
    handle(
      { params: recipeIdSchema, body: recipeSpaceTagsBodySchema },
      async ({ params, body }, req, res) => {
        const recipe = await recipes.setSpaceTags(ctx, actorOf(req), params.recipeId, body.tagIds);
        reply(res, recipeSchema, recipe);
      }
    )
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

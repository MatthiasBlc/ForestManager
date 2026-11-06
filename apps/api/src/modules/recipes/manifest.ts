// Manifeste API du module Recettes [D33, D91]. Les routes se completent au fil de C3.
import {
  adaptRecipeBodySchema,
  approveShareRequestBodySchema,
  recipeComparisonSchema,
  createRecipeBodySchema,
  recipeLeavePreviewSchema,
  recipeSharesBodySchema,
  recipeSharingSchema,
  shareRequestBodySchema,
  shareRequestParamsSchema,
  shareRequestResultSchema,
  shareRequestSchema,
  listSchema,
  mergeTagBodySchema,
  pageSchema,
  recipeListQuerySchema,
  recipeParamsSchema,
  recipeSchema,
  recipeSpaceTagsBodySchema,
  recipeRevisionSchema,
  recipeSummarySchema,
  restoreRevisionBodySchema,
  revisionParamsSchema,
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
import * as adaptation from "./adaptation.ts";
import { authoredBySql, listRecipes } from "./list.ts";
import { RECIPE_PERMISSIONS } from "./permissions.ts";
import * as revisions from "./revisions.ts";
import * as recipes from "./service.ts";
import * as sharing from "./sharing.ts";
import * as tags from "./tags.ts";

const tagParamsSchema = spaceTagParamsSchema.pick({ tagId: true });
const recipeIdSchema = recipeParamsSchema.pick({ recipeId: true });
const requestIdSchema = shareRequestParamsSchema.pick({ requestId: true });
const revisionIdSchema = revisionParamsSchema.pick({ recipeId: true, number: true });

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

  // "Mes recettes" [D82] : recettes de l'utilisateur dans tous ses espaces.
  router.get(
    "/mine",
    requirePermission("recipes.view"),
    handle({ query: recipeListQuerySchema }, async ({ query }, req, res) => {
      const page = await listRecipes(ctx, spaceOf(req), query, authoredBySql(currentUserId(req)));
      reply(res, pageSchema(recipeSummarySchema), page);
    })
  );

  // --- Partage [D03, D81, D84] : droits fins verifies par le service ---

  router.get("/share-requests", requirePermission("recipes.view"), async (req, res) => {
    const personal = moduleRequest(req).access.space.kind === "PERSONAL";
    const data = await sharing.listShareRequests(ctx, actorOf(req), personal);
    reply(res, listSchema(shareRequestSchema), { data });
  });

  router.post(
    "/share-requests/:requestId/approve",
    requirePermission("recipes.view"),
    handle(
      { params: requestIdSchema, body: approveShareRequestBodySchema },
      async ({ params, body }, req, res) => {
        await sharing.decideShareRequest(ctx, currentUserId(req), params.requestId, {
          approve: true,
          trustMembers: body.trustMembers,
        });
        res.status(204).end();
      }
    )
  );

  router.post(
    "/share-requests/:requestId/reject",
    requirePermission("recipes.view"),
    handle({ params: requestIdSchema }, async ({ params }, req, res) => {
      await sharing.decideShareRequest(ctx, currentUserId(req), params.requestId, {
        approve: false,
      });
      res.status(204).end();
    })
  );

  router.get("/leave-preview", requirePermission("recipes.view"), async (req, res) => {
    reply(res, recipeLeavePreviewSchema, await sharing.leavePreview(ctx, actorOf(req)));
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

  router.get(
    "/:recipeId/sharing",
    requirePermission("recipes.view"),
    handle({ params: recipeIdSchema }, async ({ params }, req, res) => {
      reply(res, recipeSharingSchema, await sharing.getSharing(ctx, actorOf(req), params.recipeId));
    })
  );

  router.put(
    "/:recipeId/shares",
    requirePermission("recipes.view"),
    handle(
      { params: recipeIdSchema, body: recipeSharesBodySchema },
      async ({ params, body }, req, res) => {
        const result = await sharing.setShares(ctx, actorOf(req), params.recipeId, body.spaceIds);
        reply(res, recipeSharingSchema, result);
      }
    )
  );

  router.post(
    "/:recipeId/share-requests",
    requirePermission("recipes.view"),
    handle(
      { params: recipeIdSchema, body: shareRequestBodySchema },
      async ({ params, body }, req, res) => {
        const { status, created } = await sharing.requestShare(
          ctx,
          actorOf(req),
          params.recipeId,
          body
        );
        reply(res, shareRequestResultSchema, { status }, created ? 201 : 200);
      }
    )
  );

  router.delete(
    "/:recipeId/share",
    requirePermission("recipes.view"),
    handle({ params: recipeIdSchema }, async ({ params }, req, res) => {
      await sharing.removeFromSpace(ctx, actorOf(req), params.recipeId);
      res.status(204).end();
    })
  );

  // --- Revisions [F-REC-8, D55] : restaurer = meme droit que modifier (service) ---

  router.get(
    "/:recipeId/revisions",
    requirePermission("recipes.view"),
    handle({ params: recipeIdSchema }, async ({ params }, req, res) => {
      const data = await revisions.listRevisions(ctx, actorOf(req), params.recipeId);
      reply(res, listSchema(recipeRevisionSchema), { data });
    })
  );

  router.post(
    "/:recipeId/revisions/:number/restore",
    requirePermission("recipes.view"),
    handle(
      { params: revisionIdSchema, body: restoreRevisionBodySchema },
      async ({ params, body }, req, res) => {
        const recipe = await revisions.restoreRevision(
          ctx,
          actorOf(req),
          params.recipeId,
          params.number,
          body.revision
        );
        reply(res, recipeSchema, recipe);
      }
    )
  );

  // --- Adaptation [D17, D105, D140] : droits dans l'espace cible verifies par le service ---

  router.post(
    "/:recipeId/adapt",
    requirePermission("recipes.view"),
    handle(
      { params: recipeIdSchema, body: adaptRecipeBodySchema },
      async ({ params, body }, req, res) => {
        const recipe = await adaptation.adaptRecipe(
          ctx,
          actorOf(req),
          params.recipeId,
          body.targetSpaceId
        );
        reply(res, recipeSchema, recipe, 201);
      }
    )
  );

  router.get(
    "/:recipeId/compare",
    requirePermission("recipes.view"),
    handle({ params: recipeIdSchema }, async ({ params }, req, res) => {
      const comparison = await adaptation.compareWithOriginal(ctx, actorOf(req), params.recipeId);
      reply(res, recipeComparisonSchema, comparison);
    })
  );

  router.post(
    "/:recipeId/compare/seen",
    requirePermission("recipes.view"),
    handle({ params: recipeIdSchema }, async ({ params }, req, res) => {
      await adaptation.markOriginalSeen(ctx, actorOf(req), params.recipeId);
      res.status(204).end();
    })
  );

  return router;
}

export const recipesModule: ApiModule = {
  code: "recipes",
  alwaysOn: true,
  catalog: { status: "AVAILABLE", isDefault: true, sortOrder: 1 },
  permissions: RECIPE_PERMISSIONS,
  router: recipesRouter,
  onMemberLeft: sharing.onMemberLeft,
  onSpaceDeleted: sharing.onSpaceDeleted,
};

// Routes admin des referentiels (C4.3), montees derriere requireAdmin.
import {
  adminAisleBodySchema,
  adminAisleSchema,
  adminAislesSchema,
  adminIngredientListSchema,
  adminIngredientSchema,
  adminIngredientsQuerySchema,
  adminTagBodySchema,
  adminTagFamilyBodySchema,
  adminTagFamilySchema,
  adminTagSchema,
  adminUnitSchema,
  aisleOrderBodySchema,
  createAdminIngredientBodySchema,
  createAdminUnitBodySchema,
  idParamsSchema,
  listSchema,
  mergeIngredientBodySchema,
  mergeTagBodySchema,
  updateAdminIngredientBodySchema,
  tagFamilyOrderBodySchema,
  updateAdminUnitBodySchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { handle, reply } from "../http/validate.ts";
import * as referentials from "./referentials.ts";
import { currentAdminId } from "./session.ts";

export function adminReferentialsRouter(ctx: Context): Router {
  const router = Router();

  // --- Ingredients ---

  router.get(
    "/ingredients",
    handle({ query: adminIngredientsQuerySchema }, async ({ query }, _req, res) => {
      reply(res, adminIngredientListSchema, await referentials.listIngredients(ctx, query));
    })
  );

  router.post(
    "/ingredients",
    handle({ body: createAdminIngredientBodySchema }, async ({ body }, req, res) => {
      const created = await referentials.createIngredient(ctx, currentAdminId(req), body);
      reply(res, adminIngredientSchema, created, 201);
    })
  );

  router.get(
    "/ingredients/:id",
    handle({ params: idParamsSchema }, async ({ params }, _req, res) => {
      reply(res, adminIngredientSchema, await referentials.getIngredient(ctx, params.id));
    })
  );

  router.put(
    "/ingredients/:id",
    handle(
      { params: idParamsSchema, body: updateAdminIngredientBodySchema },
      async ({ params, body }, req, res) => {
        const updated = await referentials.updateIngredient(
          ctx,
          currentAdminId(req),
          params.id,
          body
        );
        reply(res, adminIngredientSchema, updated);
      }
    )
  );

  router.post(
    "/ingredients/:id/merge",
    handle(
      { params: idParamsSchema, body: mergeIngredientBodySchema },
      async ({ params, body }, req, res) => {
        const target = await referentials.mergeIngredient(
          ctx,
          currentAdminId(req),
          params.id,
          body.intoId
        );
        reply(res, adminIngredientSchema, target);
      }
    )
  );

  // --- Unites ---

  router.get("/units", async (_req, res) => {
    reply(res, listSchema(adminUnitSchema), { data: await referentials.listUnits(ctx) });
  });

  router.post(
    "/units",
    handle({ body: createAdminUnitBodySchema }, async ({ body }, req, res) => {
      reply(
        res,
        adminUnitSchema,
        await referentials.createUnit(ctx, currentAdminId(req), body),
        201
      );
    })
  );

  router.patch(
    "/units/:id",
    handle(
      { params: idParamsSchema, body: updateAdminUnitBodySchema },
      async ({ params, body }, req, res) => {
        const unit = await referentials.updateUnit(ctx, currentAdminId(req), params.id, body);
        reply(res, adminUnitSchema, unit);
      }
    )
  );

  // --- Rayons ---

  router.get("/aisles", async (_req, res) => {
    reply(res, adminAislesSchema, await referentials.listAisles(ctx));
  });

  router.post(
    "/aisles",
    handle({ body: adminAisleBodySchema }, async ({ body }, req, res) => {
      reply(
        res,
        adminAisleSchema,
        await referentials.createAisle(ctx, currentAdminId(req), body),
        201
      );
    })
  );

  // Declaree avant /aisles/:id pour que "order" ne soit pas lu comme un id.
  router.put(
    "/aisles/order",
    handle({ body: aisleOrderBodySchema }, async ({ body }, req, res) => {
      reply(
        res,
        adminAislesSchema,
        await referentials.reorderAisles(ctx, currentAdminId(req), body.ids)
      );
    })
  );

  router.patch(
    "/aisles/:id",
    handle(
      { params: idParamsSchema, body: adminAisleBodySchema },
      async ({ params, body }, req, res) => {
        const aisle = await referentials.updateAisle(ctx, currentAdminId(req), params.id, body);
        reply(res, adminAisleSchema, aisle);
      }
    )
  );

  // --- Tags globaux ---

  router.get("/tags", async (_req, res) => {
    reply(res, listSchema(adminTagSchema), { data: await referentials.listTags(ctx) });
  });

  router.post(
    "/tags",
    handle({ body: adminTagBodySchema }, async ({ body }, req, res) => {
      reply(res, adminTagSchema, await referentials.createTag(ctx, currentAdminId(req), body), 201);
    })
  );

  router.patch(
    "/tags/:id",
    handle(
      { params: idParamsSchema, body: adminTagBodySchema },
      async ({ params, body }, req, res) => {
        const tag = await referentials.updateTag(ctx, currentAdminId(req), params.id, body);
        reply(res, adminTagSchema, tag);
      }
    )
  );

  router.post(
    "/tags/:id/merge",
    handle(
      { params: idParamsSchema, body: mergeTagBodySchema },
      async ({ params, body }, req, res) => {
        const tag = await referentials.mergeTag(
          ctx,
          currentAdminId(req),
          params.id,
          body.intoTagId
        );
        reply(res, adminTagSchema, tag);
      }
    )
  );

  router.delete(
    "/tags/:id",
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      await referentials.deleteTag(ctx, currentAdminId(req), params.id);
      res.status(204).end();
    })
  );

  // --- Familles de tags globales [D216] ---

  router.get("/tag-families", async (_req, res) => {
    reply(res, listSchema(adminTagFamilySchema), {
      data: await referentials.listTagFamilies(ctx),
    });
  });

  router.post(
    "/tag-families",
    handle({ body: adminTagFamilyBodySchema }, async ({ body }, req, res) => {
      const family = await referentials.createTagFamily(ctx, currentAdminId(req), body);
      reply(res, adminTagFamilySchema, family, 201);
    })
  );

  // Declaree avant /tag-families/:id pour que "order" ne soit pas lu comme un id.
  router.put(
    "/tag-families/order",
    handle({ body: tagFamilyOrderBodySchema }, async ({ body }, req, res) => {
      const data = await referentials.reorderTagFamilies(ctx, currentAdminId(req), body.ids);
      reply(res, listSchema(adminTagFamilySchema), { data });
    })
  );

  router.put(
    "/tag-families/:id/tags/order",
    handle(
      { params: idParamsSchema, body: tagFamilyOrderBodySchema },
      async ({ params, body }, req, res) => {
        const data = await referentials.reorderFamilyTags(
          ctx,
          currentAdminId(req),
          params.id,
          body.ids
        );
        reply(res, listSchema(adminTagSchema), { data });
      }
    )
  );

  router.patch(
    "/tag-families/:id",
    handle(
      { params: idParamsSchema, body: adminTagFamilyBodySchema },
      async ({ params, body }, req, res) => {
        const family = await referentials.updateTagFamily(
          ctx,
          currentAdminId(req),
          params.id,
          body
        );
        reply(res, adminTagFamilySchema, family);
      }
    )
  );

  router.delete(
    "/tag-families/:id",
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      await referentials.deleteTagFamily(ctx, currentAdminId(req), params.id);
      res.status(204).end();
    })
  );

  return router;
}

// Manifeste API du module Liste de courses [D228, D231] : une liste par espace,
// sections de l'espace, articles, ajout depuis le planning. Le statut au catalogue
// appartient au super admin une fois la ligne creee (accorde a la demande, D33).
import {
  sectionOrderBodySchema,
  shoppingListSchema,
  shoppingSectionBodySchema,
  shoppingSectionSchema,
  shoppingSettingsSchema,
  updateShoppingSettingsBodySchema,
  listSchema,
} from "@fm/shared";
import { Router, type Request } from "express";
import { z } from "zod";

import type { Context } from "../../core/context.ts";
import { handle, reply } from "../../core/http/validate.ts";
import {
  hasModulePermission,
  moduleRequest,
  requirePermission,
} from "../../core/modules/guards.ts";
import type { ApiModule } from "../../core/modules/registry.ts";
import { listItems } from "./items.ts";
import { SHOPPING_PERMISSIONS } from "./permissions.ts";
import {
  createSection,
  deleteSection,
  listSections,
  renameSection,
  reorderSections,
} from "./sections.ts";
import { ensureInitialized, readEditRole, saveEditRole } from "./settings.ts";

const sectionParamsSchema = z.object({ sectionId: z.uuid() });

function rightsOf(req: Request) {
  return {
    edit: hasModulePermission(req, "shopping.edit"),
    setEditRole: hasModulePermission(req, "shopping.edit-role"),
  };
}

function shoppingRouter(ctx: Context): Router {
  const router = Router();
  const spaceOf = (req: Request) => moduleRequest(req).access.space.id;

  router.get("/", requirePermission("shopping.view"), async (req, res) => {
    const spaceId = spaceOf(req);
    await ensureInitialized(ctx.db, spaceId);
    const [sections, items] = await Promise.all([
      listSections(ctx.db, spaceId),
      listItems(ctx, spaceId),
    ]);
    reply(res, shoppingListSchema, { sections, items, can: rightsOf(req) });
  });

  // --- Reglages [D141] ---

  router.get("/settings", requirePermission("shopping.view"), async (req, res) => {
    const editRole = await readEditRole(ctx.db, spaceOf(req));
    reply(res, shoppingSettingsSchema, { editRole, can: rightsOf(req) });
  });

  router.put(
    "/settings",
    requirePermission("shopping.edit-role"),
    handle({ body: updateShoppingSettingsBodySchema }, async ({ body }, req, res) => {
      await saveEditRole(ctx.db, spaceOf(req), body.editRole);
      // Les droits du lecteur dependent du role minimal qu'il vient de changer.
      moduleRequest(req).roles = { "shopping.edit": body.editRole };
      reply(res, shoppingSettingsSchema, { editRole: body.editRole, can: rightsOf(req) });
    })
  );

  // --- Sections [D231] ---

  router.post(
    "/sections",
    requirePermission("shopping.edit"),
    handle({ body: shoppingSectionBodySchema }, async ({ body }, req, res) => {
      const spaceId = spaceOf(req);
      await ensureInitialized(ctx.db, spaceId);
      reply(res, shoppingSectionSchema, await createSection(ctx.db, spaceId, body.name), 201);
    })
  );

  // Avant `/sections/:sectionId` : "order" n'est pas un id.
  router.put(
    "/sections/order",
    requirePermission("shopping.edit"),
    handle({ body: sectionOrderBodySchema }, async ({ body }, req, res) => {
      const data = await reorderSections(ctx.db, spaceOf(req), body.ids);
      reply(res, listSchema(shoppingSectionSchema), { data });
    })
  );

  router.patch(
    "/sections/:sectionId",
    requirePermission("shopping.edit"),
    handle(
      { params: sectionParamsSchema, body: shoppingSectionBodySchema },
      async ({ params, body }, req, res) => {
        const section = await renameSection(ctx.db, spaceOf(req), params.sectionId, body.name);
        reply(res, shoppingSectionSchema, section);
      }
    )
  );

  router.delete(
    "/sections/:sectionId",
    requirePermission("shopping.edit"),
    handle({ params: sectionParamsSchema }, async ({ params }, req, res) => {
      await deleteSection(ctx.db, spaceOf(req), params.sectionId);
      res.status(204).end();
    })
  );

  return router;
}

export const shoppingModule: ApiModule = {
  code: "shopping",
  catalog: { status: "COMING_SOON", sortOrder: 3 },
  permissions: SHOPPING_PERMISSIONS,
  router: shoppingRouter,
  roleOverrides: async (db, spaceId) => ({
    "shopping.edit": await readEditRole(db, spaceId),
  }),
};

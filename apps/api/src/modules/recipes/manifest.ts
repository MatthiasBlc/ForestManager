// Manifeste API du module Recettes [D33, D91]. C1 : manifeste minimal qui prouve
// le branchement par le registre ; le module complet arrive en C3.
import { listSchema } from "@fm/shared";
import { Router } from "express";
import { z } from "zod";

import { requirePermission } from "../../core/modules/guards.ts";
import type { ApiModule } from "../../core/modules/registry.ts";
import { reply } from "../../core/http/validate.ts";

export const recipesModule: ApiModule = {
  code: "recipes",
  alwaysOn: true,
  catalog: { status: "AVAILABLE", isDefault: true, sortOrder: 1 },
  // Matrice B2 (12-Permissions.md, Recettes) : roles minimaux par defaut.
  permissions: {
    "recipes.view": { minRole: "MEMBER" },
    "recipes.create": { minRole: "MEMBER" },
    "recipes.moderate": { minRole: "MODERATOR" },
  },
  router: () => {
    const router = Router();
    // Provisoire (C3 le remplace) : liste vide.
    router.get("/", requirePermission("recipes.view"), (_req, res) => {
      reply(res, listSchema(z.unknown()), { data: [] });
    });
    return router;
  },
};

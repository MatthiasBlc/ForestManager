// Routes admin des utilisateurs (C4.4), montees derriere requireAdmin.
import {
  adminUserSchema,
  adminUsersQuerySchema,
  idParamsSchema,
  offsetPageSchema,
  temporaryPasswordSchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { handle, reply } from "../http/validate.ts";
import { currentAdminId } from "./session.ts";
import * as users from "./users.ts";

export function adminUsersRouter(ctx: Context): Router {
  const router = Router();

  router.get(
    "/users",
    handle({ query: adminUsersQuerySchema }, async ({ query }, _req, res) => {
      reply(res, offsetPageSchema(adminUserSchema), await users.listUsers(ctx, query));
    })
  );

  router.post(
    "/users/:id/temporary-password",
    handle({ params: idParamsSchema }, async ({ params }, req, res) => {
      const temp = await users.issueTemporaryPassword(ctx, currentAdminId(req), params.id);
      // Jamais mis en cache : le mot de passe n'est affiche qu'une fois.
      res.setHeader("Cache-Control", "no-store");
      reply(res, temporaryPasswordSchema, temp, 201);
    })
  );

  return router;
}

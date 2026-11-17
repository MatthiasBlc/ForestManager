// GET /me/home : widgets de l'accueil avec leurs donnees (E-ACCUEIL) [D193].
import { homeResponseSchema } from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { reply } from "../http/validate.ts";
import { getHome } from "./service.ts";

export function homeRouter(ctx: Context): Router {
  const router = Router();
  router.get("/me/home", requireAuth, async (req, res) => {
    reply(res, homeResponseSchema, await getHome(ctx, currentUserId(req)));
  });
  return router;
}

// GET /search?q=&spaceId= : recherche globale (P16, F-RECHERCHE) [D191].
import { searchQuerySchema, searchResponseSchema } from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { createRateLimiter } from "../http/security.ts";
import { handle, reply } from "../http/validate.ts";
import { search } from "./service.ts";

export function searchRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  // Frappe au clavier avec un delai cote client : large, mais borne.
  const limiter = createRateLimiter(rateLimit, { windowMs: 60 * 1000, limit: 120 });
  router.get(
    "/search",
    requireAuth,
    limiter,
    handle({ query: searchQuerySchema }, async ({ query }, req, res) => {
      reply(res, searchResponseSchema, { groups: await search(ctx, currentUserId(req), query) });
    })
  );
  return router;
}

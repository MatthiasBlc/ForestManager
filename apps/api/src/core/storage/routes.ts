// Routes du stockage : /api/v1/uploads, avatar du compte et d'un espace [D167].
// La photo d'une recette est rattachee par le module Recettes.
import {
  attachImageBodySchema,
  imageResponseSchema,
  spaceParamsSchema,
  uploadTicketSchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { createRateLimiter } from "../http/security.ts";
import { handle, reply } from "../http/validate.ts";
import { requireSpacePermission } from "../spaces/access.ts";
import { claimUpload, discardImage, imageUrl, requireStorage } from "./images.ts";

const MINUTE = 60 * 1000;

export function storageRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();

  router.post(
    "/uploads",
    requireAuth,
    createRateLimiter(rateLimit, { windowMs: 10 * MINUTE, limit: 30 }),
    async (req, res) => {
      const ticket = await requireStorage(ctx).createUpload(currentUserId(req));
      reply(res, uploadTicketSchema, ticket, 201);
    }
  );

  // --- Avatar du compte ---

  router.put(
    "/me/avatar",
    requireAuth,
    handle({ body: attachImageBodySchema }, async ({ body }, req, res) => {
      const userId = currentUserId(req);
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { avatarKey: true },
      });
      const key = await claimUpload(ctx, userId, body.uploadId, `users/${userId}`, "avatar");
      await ctx.db.user.update({ where: { id: userId }, data: { avatarKey: key } });
      await discardImage(ctx, user.avatarKey);
      reply(res, imageResponseSchema, { url: imageUrl(ctx, key) });
    })
  );

  router.delete("/me/avatar", requireAuth, async (req, res) => {
    const userId = currentUserId(req);
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarKey: true },
    });
    await ctx.db.user.update({ where: { id: userId }, data: { avatarKey: null } });
    await discardImage(ctx, user.avatarKey);
    reply(res, imageResponseSchema, { url: null });
  });

  // --- Avatar d'un espace (perso compris, D02) ---

  router.put(
    "/spaces/:spaceId/avatar",
    requireAuth,
    handle(
      { params: spaceParamsSchema, body: attachImageBodySchema },
      async ({ params, body }, req, res) => {
        const userId = currentUserId(req);
        await requireSpacePermission(ctx.db, params.spaceId, userId, "space.update");
        const space = await ctx.db.space.findUniqueOrThrow({
          where: { id: params.spaceId },
          select: { avatarKey: true },
        });
        const folder = `spaces/${params.spaceId}`;
        const key = await claimUpload(ctx, userId, body.uploadId, folder, "avatar");
        await ctx.db.space.update({ where: { id: params.spaceId }, data: { avatarKey: key } });
        await discardImage(ctx, space.avatarKey);
        reply(res, imageResponseSchema, { url: imageUrl(ctx, key) });
      }
    )
  );

  router.delete(
    "/spaces/:spaceId/avatar",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      await requireSpacePermission(ctx.db, params.spaceId, currentUserId(req), "space.update");
      const space = await ctx.db.space.findUniqueOrThrow({
        where: { id: params.spaceId },
        select: { avatarKey: true },
      });
      await ctx.db.space.update({ where: { id: params.spaceId }, data: { avatarKey: null } });
      await discardImage(ctx, space.avatarKey);
      reply(res, imageResponseSchema, { url: null });
    })
  );

  return router;
}

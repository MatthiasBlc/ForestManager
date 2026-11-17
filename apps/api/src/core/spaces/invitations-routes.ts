// Routes des invitations : liens (/spaces/:id/invite-links, /invite-links/:code),
// invitations par username (/spaces/:id/invitations) et invitations recues (/me/invitations).
import {
  createdInviteLinkSchema,
  createInvitationBodySchema,
  createInviteLinkBodySchema,
  invitationParamsSchema,
  invitationSchema,
  inviteCodeParamsSchema,
  inviteLinkParamsSchema,
  inviteLinkPreviewSchema,
  inviteLinkSchema,
  listSchema,
  spaceDetailSchema,
  spaceInvitationParamsSchema,
  spaceParamsSchema,
} from "@fm/shared";
import { Router } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { createRateLimiter } from "../http/security.ts";
import { handle, reply } from "../http/validate.ts";
import * as invitations from "./invitations.ts";
import { getSpace } from "./service.ts";

const MINUTE = 60 * 1000;

export function invitationsRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  // Codes de lien et usernames : on freine les essais en serie.
  const codeLimiter = createRateLimiter(rateLimit, { windowMs: 15 * MINUTE, limit: 30 });
  const inviteLimiter = createRateLimiter(rateLimit, { windowMs: 60 * MINUTE, limit: 30 });

  // --- Liens ---

  router.get(
    "/spaces/:spaceId/invite-links",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      const data = await invitations.listInviteLinks(ctx, params.spaceId, currentUserId(req));
      reply(res, listSchema(inviteLinkSchema), { data });
    })
  );

  router.post(
    "/spaces/:spaceId/invite-links",
    requireAuth,
    handle(
      { params: spaceParamsSchema, body: createInviteLinkBodySchema },
      async ({ params, body }, req, res) => {
        const link = await invitations.createInviteLink(
          ctx,
          params.spaceId,
          currentUserId(req),
          body
        );
        reply(res, createdInviteLinkSchema, link, 201);
      }
    )
  );

  router.delete(
    "/spaces/:spaceId/invite-links/:linkId",
    requireAuth,
    handle({ params: inviteLinkParamsSchema }, async ({ params }, req, res) => {
      await invitations.revokeInviteLink(ctx, params.spaceId, params.linkId, currentUserId(req));
      res.status(204).end();
    })
  );

  // Apercu public : visible avant connexion ou inscription [D62].
  router.get(
    "/invite-links/:code",
    codeLimiter,
    handle({ params: inviteCodeParamsSchema }, async ({ params }, _req, res) => {
      reply(res, inviteLinkPreviewSchema, await invitations.previewInviteLink(ctx, params.code));
    })
  );

  router.post(
    "/invite-links/:code/join",
    codeLimiter,
    requireAuth,
    handle({ params: inviteCodeParamsSchema }, async ({ params }, req, res) => {
      const userId = currentUserId(req);
      const spaceId = await invitations.joinByLink(ctx, params.code, userId);
      reply(res, spaceDetailSchema, await getSpace(ctx, spaceId, userId));
    })
  );

  // --- Invitations par username ---

  router.get(
    "/spaces/:spaceId/invitations",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      const data = await invitations.listSpaceInvitations(ctx, params.spaceId, currentUserId(req));
      reply(res, listSchema(invitationSchema), { data });
    })
  );

  // 202 dans tous les cas : la reponse ne dit pas si le compte existe [D50].
  router.post(
    "/spaces/:spaceId/invitations",
    requireAuth,
    inviteLimiter,
    handle(
      { params: spaceParamsSchema, body: createInvitationBodySchema },
      async ({ params, body }, req, res) => {
        await invitations.inviteByUsername(ctx, params.spaceId, currentUserId(req), body.username);
        res.status(202).end();
      }
    )
  );

  router.post(
    "/spaces/:spaceId/invitations/:invitationId/cancel",
    requireAuth,
    handle({ params: spaceInvitationParamsSchema }, async ({ params }, req, res) => {
      await invitations.cancelInvitation(
        ctx,
        params.spaceId,
        params.invitationId,
        currentUserId(req)
      );
      res.status(204).end();
    })
  );

  // --- Invitations recues ---

  router.get("/me/invitations", requireAuth, async (req, res) => {
    const data = await invitations.myInvitations(ctx, currentUserId(req));
    reply(res, listSchema(invitationSchema), { data });
  });

  router.post(
    "/me/invitations/:invitationId/accept",
    requireAuth,
    handle({ params: invitationParamsSchema }, async ({ params }, req, res) => {
      const userId = currentUserId(req);
      const spaceId = await invitations.respondToInvitation(ctx, params.invitationId, userId, true);
      reply(res, spaceDetailSchema, await getSpace(ctx, spaceId, userId));
    })
  );

  router.post(
    "/me/invitations/:invitationId/decline",
    requireAuth,
    handle({ params: invitationParamsSchema }, async ({ params }, req, res) => {
      await invitations.respondToInvitation(ctx, params.invitationId, currentUserId(req), false);
      res.status(204).end();
    })
  );

  return router;
}

// Routes des espaces : /api/v1/spaces/... et /api/v1/me/transfers.
import {
  changeRoleBodySchema,
  createSpaceBodySchema,
  createTransferBodySchema,
  leaveSpaceBodySchema,
  listSchema,
  memberParamsSchema,
  memberSchema,
  ownershipTransferSchema,
  spaceDetailSchema,
  spaceParamsSchema,
  spaceSummarySchema,
  transferParamsSchema,
  updateSpaceBodySchema,
} from "@fm/shared";
import { Router } from "express";
import { z } from "zod";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { handle, reply } from "../http/validate.ts";
import * as spaces from "./service.ts";

const pendingTransferSchema = z.object({ transfer: ownershipTransferSchema.nullable() });

export function spacesRouter(ctx: Context): Router {
  const router = Router();

  router.get("/spaces", requireAuth, async (req, res) => {
    reply(res, listSchema(spaceSummarySchema), {
      data: await spaces.listSpaces(ctx, currentUserId(req)),
    });
  });

  router.post(
    "/spaces",
    requireAuth,
    handle({ body: createSpaceBodySchema }, async ({ body }, req, res) => {
      const userId = currentUserId(req);
      const spaceId = await spaces.createSpace(ctx, userId, body);
      reply(res, spaceDetailSchema, await spaces.getSpace(ctx, spaceId, userId), 201);
    })
  );

  router.get(
    "/spaces/:spaceId",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      reply(res, spaceDetailSchema, await spaces.getSpace(ctx, params.spaceId, currentUserId(req)));
    })
  );

  router.patch(
    "/spaces/:spaceId",
    requireAuth,
    handle(
      { params: spaceParamsSchema, body: updateSpaceBodySchema },
      async ({ params, body }, req, res) => {
        const userId = currentUserId(req);
        await spaces.updateSpace(ctx, params.spaceId, userId, body);
        reply(res, spaceDetailSchema, await spaces.getSpace(ctx, params.spaceId, userId));
      }
    )
  );

  router.delete(
    "/spaces/:spaceId",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      await spaces.deleteSpace(ctx, params.spaceId, currentUserId(req));
      res.status(204).end();
    })
  );

  router.post(
    "/spaces/:spaceId/restore",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      const userId = currentUserId(req);
      await spaces.restoreSpace(ctx, params.spaceId, userId);
      reply(res, spaceDetailSchema, await spaces.getSpace(ctx, params.spaceId, userId));
    })
  );

  router.post(
    "/spaces/:spaceId/leave",
    requireAuth,
    handle(
      { params: spaceParamsSchema, body: leaveSpaceBodySchema },
      async ({ params, body }, req, res) => {
        await spaces.leaveSpace(ctx, params.spaceId, currentUserId(req), body.confirmDeletion);
        res.status(204).end();
      }
    )
  );

  // --- Membres ---

  router.get(
    "/spaces/:spaceId/members",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      const data = await spaces.listMembers(ctx, params.spaceId, currentUserId(req));
      reply(res, listSchema(memberSchema), { data });
    })
  );

  router.patch(
    "/spaces/:spaceId/members/:userId",
    requireAuth,
    handle(
      { params: memberParamsSchema, body: changeRoleBodySchema },
      async ({ params, body }, req, res) => {
        const actorId = currentUserId(req);
        await spaces.changeRole(ctx, params.spaceId, actorId, params.userId, body.role);
        const data = await spaces.listMembers(ctx, params.spaceId, actorId);
        reply(res, listSchema(memberSchema), { data });
      }
    )
  );

  router.delete(
    "/spaces/:spaceId/members/:userId",
    requireAuth,
    handle({ params: memberParamsSchema }, async ({ params }, req, res) => {
      await spaces.excludeMember(ctx, params.spaceId, currentUserId(req), params.userId);
      res.status(204).end();
    })
  );

  // --- Transfert de propriete ---

  router.get(
    "/spaces/:spaceId/transfer",
    requireAuth,
    handle({ params: spaceParamsSchema }, async ({ params }, req, res) => {
      const transfer = await spaces.pendingTransfer(ctx, params.spaceId, currentUserId(req));
      reply(res, pendingTransferSchema, { transfer });
    })
  );

  router.post(
    "/spaces/:spaceId/transfers",
    requireAuth,
    handle(
      { params: spaceParamsSchema, body: createTransferBodySchema },
      async ({ params, body }, req, res) => {
        const transfer = await spaces.proposeTransfer(
          ctx,
          params.spaceId,
          currentUserId(req),
          body.toUserId
        );
        reply(res, ownershipTransferSchema, transfer, 201);
      }
    )
  );

  for (const [action, accept] of [
    ["accept", true],
    ["decline", false],
  ] as const) {
    router.post(
      `/spaces/:spaceId/transfers/:transferId/${action}`,
      requireAuth,
      handle({ params: transferParamsSchema }, async ({ params }, req, res) => {
        await spaces.respondToTransfer(
          ctx,
          params.spaceId,
          params.transferId,
          currentUserId(req),
          accept
        );
        res.status(204).end();
      })
    );
  }

  router.post(
    "/spaces/:spaceId/transfers/:transferId/cancel",
    requireAuth,
    handle({ params: transferParamsSchema }, async ({ params }, req, res) => {
      await spaces.cancelTransfer(ctx, params.spaceId, params.transferId, currentUserId(req));
      res.status(204).end();
    })
  );

  router.get("/me/transfers", requireAuth, async (req, res) => {
    const data = await spaces.myPendingTransfers(ctx, currentUserId(req));
    reply(res, listSchema(ownershipTransferSchema), { data });
  });

  return router;
}

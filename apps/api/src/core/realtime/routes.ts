// Flux temps reel GET /events (SSE) [D188] et publication des ecritures d'un espace.
import type { RealtimeEvent } from "@fm/shared";
import { Router, type RequestHandler } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SPACE_PATH = /^\/spaces\/([0-9a-f-]{36})(?:\/([a-z][a-z0-9-]*))?/;

/** Previent les membres actifs d'un espace (destinataires lus a l'envoi). */
export async function publishToSpace(
  ctx: Context,
  spaceId: string,
  event: RealtimeEvent
): Promise<void> {
  const members = await ctx.db.membership.findMany({
    where: { spaceId, leftAt: null },
    select: { userId: true },
  });
  ctx.realtime.toUsers(
    members.map((m) => m.userId),
    event
  );
}

/**
 * Apres chaque ecriture reussie sous /spaces/:spaceId, previent les membres : le
 * module est le segment suivant s'il est un module du registre, sinon le socle.
 * Aucune route n'a a s'en soucier.
 */
export function publishSpaceChanges(ctx: Context): RequestHandler {
  const modules = new Set(ctx.modules.map((m) => m.code));
  return (req, res, next) => {
    const match = MUTATIONS.has(req.method) ? SPACE_PATH.exec(req.path) : null;
    if (match?.[1]) {
      const spaceId = match[1];
      const segment = match[2];
      res.on("finish", () => {
        if (res.statusCode >= 400) return;
        const module = segment && modules.has(segment) ? segment : null;
        publishToSpace(ctx, spaceId, { type: "invalidate", spaceId, module }).catch(
          (error: unknown) => {
            ctx.logger.error({ err: error }, "realtime publish failed");
          }
        );
      });
    }
    next();
  };
}

export function realtimeRouter(ctx: Context): Router {
  const router = Router();
  router.get("/events", requireAuth, (req, res) => {
    const userId = currentUserId(req);
    const sid = req.sessionID;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx : pas de mise en tampon de ce flux.
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 5000\n\n");

    const close = ctx.realtime.connect(userId, {
      send: (event) => {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      },
      end: () => {
        res.end();
      },
    });
    // Battement : garde la connexion ouverte a travers les proxys et ferme le flux
    // d'une session fermee (deconnexion, mot de passe change, compte supprime).
    const heartbeat = setInterval(() => {
      ctx.db.userSession
        .findUnique({ where: { sid }, select: { expiresAt: true } })
        .then((session) => {
          if (!session || session.expiresAt <= new Date()) res.end();
          else res.write(": ping\n\n");
        })
        .catch(() => {
          res.end();
        });
    }, ctx.realtime.heartbeatMs);
    heartbeat.unref();
    res.on("close", () => {
      clearInterval(heartbeat);
      close();
    });
  });
  return router;
}

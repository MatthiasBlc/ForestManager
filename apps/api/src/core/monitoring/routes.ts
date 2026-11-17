// Tunnel du SDK du navigateur [D196] : `POST /api/v1/monitoring` recoit une
// enveloppe Sentry (texte), remplace le DSN factice du front par le vrai et la
// relaie a Bugsink. Le front ne connait pas le DSN et la CSP ne change pas.
// Monte avant le CSRF et la session : une erreur peut survenir avant la
// connexion. Seul le corps part : ni cookies, ni en-tetes, ni IP du navigateur.
import express, { Router } from "express";

import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { createRateLimiter } from "../http/security.ts";
import { envelopeHeader } from "./error-tracking.ts";

/** Une enveloppe d'erreur pese quelques dizaines de ko ; pas de replay ni de piece jointe. */
const BODY_LIMIT = "200kb";
const MINUTE = 60 * 1000;

export function monitoringRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  router.post(
    "/",
    createRateLimiter(rateLimit, { windowMs: MINUTE, limit: 30 }),
    express.text({ type: () => true, limit: BODY_LIMIT }),
    async (req, res) => {
      const tracking = ctx.errorTracking;
      if (!tracking) throw new AppError("COMMON_003");
      const body: unknown = req.body;
      if (typeof body !== "string" || !envelopeHeader(body)) throw new AppError("VALIDATION_001");
      try {
        const status = await tracking.forward(body);
        if (status >= 300) req.log.warn({ status }, "error tracking receiver refused an envelope");
      } catch (error) {
        req.log.warn({ err: error }, "error tracking receiver unreachable");
      }
      // Le navigateur ne peut rien faire d'un echec du recepteur.
      res.status(202).end();
    }
  );
  return router;
}

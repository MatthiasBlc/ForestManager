// Routes admin sous /api/v1/admin [D170, D174]. Montees avant la session des
// utilisateurs : une requete admin ne lit jamais le cookie d'un utilisateur.

import {
  adminLoginBodySchema,
  adminLoginResultSchema,
  adminMeSchema,
  adminTotpBodySchema,
} from "@fm/shared";
import { Router, type Request } from "express";

import { destroySession, regenerate } from "../auth/session.ts";
import type { Context } from "../context.ts";
import { AppError } from "../http/errors.ts";
import { createRateLimiter } from "../http/security.ts";
import { handle, reply } from "../http/validate.ts";
import { authenticateAdmin, completeLogin, loginStep } from "./accounts.ts";
import { audit } from "./audit.ts";
import { adminModulesRouter } from "./modules-routes.ts";
import { adminReferentialsRouter } from "./referentials-routes.ts";
import { adminSpacesRouter } from "./spaces-routes.ts";
import { adminUsersRouter } from "./users-routes.ts";
import {
  ADMIN_COOKIE_PATH,
  ADMIN_PENDING_TTL_MS,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  adminSessionMiddleware,
  currentAdminId,
  requireAdmin,
} from "./session.ts";

const MINUTE = 60 * 1000;
/** Codes faux tolere par tentative de connexion (comme la V1). */
const MAX_TOTP_ATTEMPTS = 3;

async function adminMe(ctx: Context, req: Request) {
  const admin = await ctx.db.adminUser.findUnique({ where: { id: currentAdminId(req) } });
  if (!admin) throw new AppError("ADMIN_002");
  // maxAge = temps restant jusqu'a l'expiration fixee a la connexion.
  const expires = new Date(Date.now() + (req.session.cookie.maxAge ?? ADMIN_SESSION_TTL_MS));
  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    sessionExpiresAt: expires.toISOString(),
  };
}

async function closeSession(req: Request, res: Parameters<typeof reply>[0]): Promise<void> {
  await destroySession(req);
  res.clearCookie(ADMIN_SESSION_COOKIE, { path: ADMIN_COOKIE_PATH });
}

export function adminRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  const production = ctx.env.NODE_ENV === "production";
  // Rate limit renforce (14-Architecture) : 5 mots de passe et 10 codes par 15 min.
  const limit = (max: number) =>
    createRateLimiter(rateLimit, { windowMs: 15 * MINUTE, limit: max, code: "AUTH_006" });

  router.use(adminSessionMiddleware(ctx.db, ctx.env.SESSION_SECRET, production));

  router.post(
    "/auth/login",
    limit(5),
    handle({ body: adminLoginBodySchema }, async ({ body }, req, res) => {
      const admin = await authenticateAdmin(ctx, body.identifier, body.password);
      await regenerate(req);
      req.session.adminId = admin.id;
      req.session.adminVerified = false;
      req.session.totpAttempts = 0;
      req.session.cookie.maxAge = ADMIN_PENDING_TTL_MS;
      reply(res, adminLoginResultSchema, await loginStep(admin));
    })
  );

  router.post(
    "/auth/totp",
    limit(10),
    handle({ body: adminTotpBodySchema }, async ({ body }, req, res) => {
      const { adminId } = req.session;
      if (!adminId || req.session.adminVerified === true) throw new AppError("ADMIN_002");
      const attempts = req.session.totpAttempts ?? 0;
      if (attempts >= MAX_TOTP_ATTEMPTS) {
        await audit(ctx.db, { adminId, action: "auth.totp-locked", data: { ip: req.ip ?? null } });
        await closeSession(req, res);
        throw new AppError("ADMIN_004");
      }
      if (!(await completeLogin(ctx, adminId, body.code, req.ip))) {
        req.session.totpAttempts = attempts + 1;
        await audit(ctx.db, { adminId, action: "auth.totp-failed", data: { ip: req.ip ?? null } });
        throw new AppError("ADMIN_003");
      }
      // Session neuve (fixation) de 30 minutes, qui ne glisse pas.
      await regenerate(req);
      req.session.adminId = adminId;
      req.session.adminVerified = true;
      req.session.cookie.maxAge = ADMIN_SESSION_TTL_MS;
      reply(res, adminMeSchema, await adminMe(ctx, req));
    })
  );

  router.post("/auth/logout", async (req, res) => {
    const { adminId } = req.session;
    if (adminId && req.session.adminVerified === true) {
      await audit(ctx.db, { adminId, action: "auth.logout" });
    }
    await closeSession(req, res);
    res.status(204).end();
  });

  router.use(requireAdmin);

  router.get("/me", async (req, res) => {
    reply(res, adminMeSchema, await adminMe(ctx, req));
  });

  router.use(adminModulesRouter(ctx));
  router.use(adminReferentialsRouter(ctx));
  router.use(adminUsersRouter(ctx));
  router.use(adminSpacesRouter(ctx));

  // Une route admin inconnue ne tombe jamais dans l'API des utilisateurs.
  router.use(() => {
    throw new AppError("COMMON_003");
  });
  return router;
}

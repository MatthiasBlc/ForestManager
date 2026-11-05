// Routes des comptes : /api/v1/auth/... et /api/v1/me/...
import {
  accountDeletionPreviewSchema,
  changePasswordBodySchema,
  deleteAccountBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  meSchema,
  registerBodySchema,
  resetPasswordBodySchema,
  updatePreferencesBodySchema,
  updateProfileBodySchema,
  verifyEmailBodySchema,
} from "@fm/shared";
import { Router, type Request } from "express";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { AppError } from "../http/errors.ts";
import { createRateLimiter } from "../http/security.ts";
import { handle, reply } from "../http/validate.ts";
import * as deletion from "./deletion.ts";
import * as accounts from "./service.ts";
import {
  destroySession,
  regenerate,
  REMEMBER_ME_TTL_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./session.ts";

const MINUTE = 60 * 1000;

/** Ouvre une session neuve (rotation de l'identifiant) pour ce compte. */
async function openSession(req: Request, userId: string, rememberMe: boolean): Promise<void> {
  await regenerate(req);
  req.session.userId = userId;
  req.session.cookie.maxAge = rememberMe ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS;
}

export function authRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  const limit = (windowMs: number, max: number) =>
    createRateLimiter(rateLimit, { windowMs, limit: max, code: "AUTH_006" });

  router.post(
    "/auth/register",
    limit(60 * MINUTE, 5),
    handle({ body: registerBodySchema }, async ({ body }, req, res) => {
      if (req.session.userId) throw new AppError("AUTH_010");
      const userId = await accounts.register(ctx, body);
      await openSession(req, userId, false);
      reply(res, meSchema, await accounts.getMe(ctx, userId), 201);
    })
  );

  router.post(
    "/auth/login",
    limit(15 * MINUTE, 10),
    handle({ body: loginBodySchema }, async ({ body }, req, res) => {
      const userId = await accounts.authenticate(ctx, body.identifier, body.password);
      await openSession(req, userId, body.rememberMe);
      reply(res, meSchema, await accounts.getMe(ctx, userId));
    })
  );

  router.post("/auth/logout", async (req, res) => {
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(204).end();
  });

  router.post(
    "/auth/verify-email",
    limit(15 * MINUTE, 20),
    handle({ body: verifyEmailBodySchema }, async ({ body }, _req, res) => {
      await accounts.verifyEmail(ctx, body.token);
      res.status(204).end();
    })
  );

  router.post("/auth/verify-email/resend", requireAuth, limit(60 * MINUTE, 5), async (req, res) => {
    await accounts.resendVerification(ctx, currentUserId(req));
    res.status(204).end();
  });

  router.post(
    "/auth/forgot-password",
    limit(60 * MINUTE, 5),
    handle({ body: forgotPasswordBodySchema }, async ({ body }, _req, res) => {
      await accounts.forgotPassword(ctx, body.email);
      res.status(204).end();
    })
  );

  router.post(
    "/auth/reset-password",
    limit(60 * MINUTE, 10),
    handle({ body: resetPasswordBodySchema }, async ({ body }, _req, res) => {
      await accounts.resetPassword(ctx, body.token, body.password);
      res.status(204).end();
    })
  );

  // --- Profil ---

  router.get("/me", requireAuth, async (req, res) => {
    reply(res, meSchema, await accounts.getMe(ctx, currentUserId(req)));
  });

  router.patch(
    "/me",
    requireAuth,
    handle({ body: updateProfileBodySchema }, async ({ body }, req, res) => {
      const userId = currentUserId(req);
      await accounts.updateProfile(ctx, userId, body);
      reply(res, meSchema, await accounts.getMe(ctx, userId));
    })
  );

  router.put(
    "/me/password",
    requireAuth,
    limit(15 * MINUTE, 10),
    handle({ body: changePasswordBodySchema }, async ({ body }, req, res) => {
      await accounts.changePassword(ctx, currentUserId(req), body, req.sessionID);
      res.status(204).end();
    })
  );

  router.patch(
    "/me/preferences",
    requireAuth,
    handle({ body: updatePreferencesBodySchema }, async ({ body }, req, res) => {
      const userId = currentUserId(req);
      await accounts.updatePreferences(ctx, userId, body);
      reply(res, meSchema, await accounts.getMe(ctx, userId));
    })
  );

  // --- Suppression du compte [D20, D51, D116] ---

  router.get("/me/deletion-preview", requireAuth, async (req, res) => {
    reply(
      res,
      accountDeletionPreviewSchema,
      await deletion.previewDeletion(ctx, currentUserId(req))
    );
  });

  router.delete(
    "/me",
    requireAuth,
    limit(15 * MINUTE, 10),
    handle({ body: deleteAccountBodySchema }, async ({ body }, req, res) => {
      await deletion.deleteAccount(ctx, currentUserId(req), body.password);
      await destroySession(req);
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.status(204).end();
    })
  );

  return router;
}

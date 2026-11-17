// Connexion avec Discord [D202, D210] : /api/v1/auth/discord/... et /me/discord.
// Le navigateur arrive sur `start` et `callback` par navigation : ces routes
// repondent par des redirections vers le front, jamais par du JSON.
import { discordPendingSchema, discordRegisterBodySchema, meSchema } from "@fm/shared";
import { Router, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";

import type { Context } from "../context.ts";
import { currentUserId, requireAuth } from "../http/auth.ts";
import { AppError } from "../http/errors.ts";
import { createRateLimiter } from "../http/security.ts";
import { handle, reply } from "../http/validate.ts";
import { DiscordError } from "./discord.ts";
import * as discordAccounts from "./discord-service.ts";
import * as accounts from "./service.ts";
import { regenerate, REMEMBER_ME_TTL_MS, SESSION_TTL_MS } from "./session.ts";

const MINUTE = 60 * 1000;
/** Duree d'un aller-retour chez Discord. */
const STATE_TTL_MS = 10 * MINUTE;
/** Duree de l'ecran de confirmation de l'inscription. */
const PENDING_TTL_MS = 15 * MINUTE;

/** Destination interne seulement (meme regle que `safeNext` du front). */
function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : null;
}

function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

function loginError(code: string): string {
  return `/login?error=${code}`;
}

async function openSession(req: Request, userId: string, rememberMe: boolean): Promise<void> {
  await regenerate(req);
  req.session.userId = userId;
  req.session.cookie.maxAge = rememberMe ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS;
}

export function discordRouter(ctx: Context, rateLimit: boolean): Router {
  const router = Router();
  const limit = (max: number) =>
    createRateLimiter(rateLimit, { windowMs: 15 * MINUTE, limit: max, code: "AUTH_006" });

  router.get("/auth/discord/start", limit(20), (req: Request, res: Response) => {
    const intent = req.query.intent === "link" ? "link" : "login";
    const next = safeNext(req.query.next);
    if (!ctx.discord) {
      res.redirect(intent === "link" ? "/profile?discordError=AUTH_015" : loginError("AUTH_015"));
      return;
    }
    if (intent === "link" && (!req.session.userId || req.session.passwordChoice)) {
      res.redirect(loginError("AUTH_001"));
      return;
    }
    const state = randomBytes(16).toString("base64url");
    req.session.discordOAuth = {
      state,
      intent,
      next,
      rememberMe: req.query.remember === "true",
      expiresAt: Date.now() + STATE_TTL_MS,
    };
    res.redirect(ctx.discord.authorizeUrl(state));
  });

  router.get("/auth/discord/callback", limit(20), async (req: Request, res: Response) => {
    const flow = req.session.discordOAuth;
    // Le state ne sert qu'une fois, qu'il reussisse ou non.
    delete req.session.discordOAuth;
    const valid =
      flow !== undefined &&
      flow.expiresAt > Date.now() &&
      typeof req.query.state === "string" &&
      req.query.state === flow.state;
    if (!valid || !ctx.discord) {
      res.redirect(loginError("AUTH_015"));
      return;
    }
    const failure =
      flow.intent === "link" ? "/profile?discordError=AUTH_015" : loginError("AUTH_015");
    const code = typeof req.query.code === "string" ? req.query.code : null;
    if (!code) {
      res.redirect(failure);
      return;
    }

    let profile;
    try {
      profile = await ctx.discord.exchangeCode(code);
    } catch (error) {
      if (!(error instanceof DiscordError)) throw error;
      ctx.logger.warn({ err: error }, "discord sign-in failed");
      res.redirect(failure);
      return;
    }

    if (flow.intent === "link") {
      const userId = req.session.userId;
      if (!userId) {
        res.redirect(loginError("AUTH_001"));
        return;
      }
      try {
        await discordAccounts.link(ctx, userId, profile);
      } catch (error) {
        if (error instanceof AppError) {
          res.redirect(`/profile?discordError=${error.code}`);
          return;
        }
        throw error;
      }
      res.redirect("/profile?discord=linked");
      return;
    }

    const userId = await discordAccounts.signIn(ctx, profile);
    if (userId) {
      await openSession(req, userId, flow.rememberMe);
      res.redirect(flow.next ?? "/");
      return;
    }
    // Compte inconnu : ecran de confirmation (jamais de liaison par email) [D210].
    req.session.discordSignup = {
      profile,
      next: flow.next,
      rememberMe: flow.rememberMe,
      expiresAt: Date.now() + PENDING_TTL_MS,
    };
    res.redirect(withNext("/register/discord", flow.next));
  });

  /** Inscription en attente, ou AUTH_015. */
  function pendingSignup(req: Request) {
    const pending = req.session.discordSignup;
    if (!pending || pending.expiresAt <= Date.now()) throw new AppError("AUTH_015");
    return pending;
  }

  router.get("/auth/discord/pending", async (req, res) => {
    const { profile } = pendingSignup(req);
    reply(res, discordPendingSchema, await discordAccounts.pendingView(ctx, profile));
  });

  router.post(
    "/auth/discord/register",
    limit(10),
    handle({ body: discordRegisterBodySchema }, async ({ body }, req, res) => {
      if (req.session.userId) throw new AppError("AUTH_010");
      const pending = pendingSignup(req);
      const userId = await discordAccounts.register(ctx, pending.profile, body);
      await openSession(req, userId, pending.rememberMe);
      reply(res, meSchema, await accounts.getMe(ctx, userId), 201);
    })
  );

  router.delete("/me/discord", requireAuth, async (req, res) => {
    await discordAccounts.unlink(ctx, currentUserId(req));
    res.status(204).end();
  });

  return router;
}

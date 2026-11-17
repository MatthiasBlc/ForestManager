// Client OAuth2 de Discord [D202, D210] : code d'autorisation, client
// confidentiel (le secret reste sur l'API). Le jeton d'acces sert une fois a
// lire le profil puis il est oublie : rien de Discord n'est stocke hors l'id
// et le nom.
import { API_PREFIX } from "@fm/shared";

import type { Env } from "../config/env.ts";

/** Profil Discord utile a Forest Manager. */
export interface DiscordProfile {
  id: string;
  username: string;
  /** Email du compte Discord, null si la portee `email` n'a rien donne. */
  email: string | null;
  /** Email verifie par Discord. */
  verified: boolean;
  /** Hash de l'avatar, null sans avatar. */
  avatar: string | null;
}

export interface DiscordClient {
  /** URL de la page d'autorisation de Discord pour ce `state`. */
  authorizeUrl(state: string): string;
  /** Echange le code contre un jeton et lit le profil ; DiscordError sinon. */
  exchangeCode(code: string): Promise<DiscordProfile>;
  /** Avatar en WebP (256 px), ou null s'il est absent ou illisible. */
  fetchAvatar(profile: DiscordProfile): Promise<Buffer | null>;
}

/** Refus ou panne de Discord : la connexion echoue avec AUTH_015. */
export class DiscordError extends Error {
  override name = "DiscordError";
}

const TIMEOUT_MS = 10_000;
const AVATAR_MAX_BYTES = 1024 * 1024;

export function discordRedirectUri(env: Env): string {
  return new URL(`${API_PREFIX}/auth/discord/callback`, env.APP_URL).toString();
}

function tokenFrom(body: unknown): string {
  const token = (body as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== "string" || token === "") throw new DiscordError("token missing");
  return token;
}

function profileFrom(body: unknown): DiscordProfile {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.username !== "string") {
    throw new DiscordError("profile missing");
  }
  return {
    id: raw.id,
    username: raw.username,
    email: typeof raw.email === "string" && raw.email !== "" ? raw.email : null,
    verified: raw.verified === true,
    avatar: typeof raw.avatar === "string" && raw.avatar !== "" ? raw.avatar : null,
  };
}

/** Client reel ; null sans DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET. */
export function createDiscordClient(env: Env): DiscordClient | null {
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const base = env.DISCORD_BASE_URL;
  const redirectUri = discordRedirectUri(env);

  async function call(url: string, init: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new DiscordError(`discord unreachable: ${String(error)}`);
    }
    if (!res.ok) throw new DiscordError(`discord answered ${String(res.status)}`);
    return res.json();
  }

  return {
    authorizeUrl(state) {
      const url = new URL("/oauth2/authorize", base);
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: "identify email",
        state,
        redirect_uri: redirectUri,
        prompt: "none",
      }).toString();
      return url.toString();
    },

    async exchangeCode(code) {
      const token = tokenFrom(
        await call(new URL("/api/v10/oauth2/token", base).toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }).toString(),
        })
      );
      return profileFrom(
        await call(new URL("/api/v10/users/@me", base).toString(), {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
    },

    async fetchAvatar(profile) {
      if (!profile.avatar) return null;
      const url = new URL(
        `/avatars/${encodeURIComponent(profile.id)}/${encodeURIComponent(profile.avatar)}.webp?size=256`,
        env.DISCORD_CDN_URL
      );
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return null;
        const length = Number(res.headers.get("content-length") ?? "0");
        if (length > AVATAR_MAX_BYTES) return null;
        const body = Buffer.from(await res.arrayBuffer());
        return body.length > AVATAR_MAX_BYTES ? null : body;
      } catch {
        return null;
      }
    },
  };
}

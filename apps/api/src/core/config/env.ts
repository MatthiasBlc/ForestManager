// Variables d'environnement validees au demarrage (Zod au lieu d'envalid en V1).
// Une variable manquante ou invalide arrete l'API avec un message clair.

import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.string().min(1),
    /** Signe les cookies de session et les jetons CSRF. */
    SESSION_SECRET: z.string().min(16),
    /** Origine du front quand il n'est pas servi par le meme domaine (dev). */
    CORS_ORIGIN: z.string().optional(),
    /** URL publique du front, pour les liens des emails et des invitations. */
    APP_URL: z.url().default("http://localhost:3000"),
    /** Emails optionnels [D21] : sans SMTP_URL, `features.email` vaut false. */
    SMTP_URL: z.string().optional(),
    SMTP_FROM: z.string().default("Forest Manager <no-reply@forestmanager.local>"),
    /** Nombre de proxys devant l'API (Traefik en preprod et prod). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  })
  .refine((env) => env.NODE_ENV !== "production" || env.SESSION_SECRET.length >= 32, {
    message: "SESSION_SECRET must be at least 32 characters in production",
    path: ["SESSION_SECRET"],
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

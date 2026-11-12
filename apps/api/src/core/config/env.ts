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
    /**
     * Stockage S3 des photos et avatars [D146, D167] : MinIO en preprod et prod
     * (noms de la V1, D147), RustFS en dev et test. Facultatif : sans
     * MINIO_ENDPOINT, `features.uploads` vaut false.
     */
    MINIO_ENDPOINT: z.string().optional(),
    MINIO_PORT: z.coerce.number().int().min(1).max(65535).default(9000),
    MINIO_USE_SSL: z.stringbool().default(false),
    MINIO_ACCESS_KEY: z.string().optional(),
    MINIO_SECRET_KEY: z.string().optional(),
    MINIO_BUCKET: z.string().optional(),
    /** URL vue par le navigateur (envoi et lecture), sans le bucket. */
    MINIO_PUBLIC_URL: z.url().optional(),
    /**
     * Suivi d'erreurs [D75, D196] : DSN du projet Bugsink de l'environnement.
     * Facultatif : sans DSN, le suivi est coupe et `features.errorTracking` vaut false.
     */
    SENTRY_DSN: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
    /** Nom de l'environnement dans Bugsink (preprod, production) ; NODE_ENV par defaut. */
    SENTRY_ENVIRONMENT: z.string().min(1).optional(),
  })
  .refine(
    (env) =>
      !env.MINIO_ENDPOINT ||
      Boolean(
        env.MINIO_ACCESS_KEY && env.MINIO_SECRET_KEY && env.MINIO_BUCKET && env.MINIO_PUBLIC_URL
      ),
    {
      message:
        "MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET and MINIO_PUBLIC_URL are required with MINIO_ENDPOINT",
      path: ["MINIO_ENDPOINT"],
    }
  )
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

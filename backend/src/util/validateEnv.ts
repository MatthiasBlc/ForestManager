import { z } from "zod";

const portValidator = z.coerce.number().int().min(0).max(65535);

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: portValidator,
  SESSION_SECRET: z.string(),
  ADMIN_SESSION_SECRET: z.string(),
  CORS_ORIGIN: z.string().default(""),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // MinIO / S3
  MINIO_ENDPOINT: z.string().default("minio"),
  MINIO_PORT: portValidator.default(9000),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("forestmanager-images-dev"),
  MINIO_PUBLIC_URL: z.string().default("http://localhost:9000"),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

export default envSchema.parse(process.env);

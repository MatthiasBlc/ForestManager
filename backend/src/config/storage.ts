import env from "../util/validateEnv";

export const storageConfig = {
  endpoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
  bucket: env.MINIO_BUCKET,
  publicUrl: env.MINIO_PUBLIC_URL,
  useSSL: env.MINIO_USE_SSL,
  presignedUrlTTL: 60, // secondes
  maxFileSize: 2 * 1024 * 1024, // 2 MB
  allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
};

/**
 * Construit l'URL publique d'une image a partir de sa cle relative.
 * Ex: "recipes/abc/cover.webp" -> "http://localhost:9000/forestmanager-images-dev/recipes/abc/cover.webp"
 */
export function buildImageUrl(imageKey: string): string {
  return `${storageConfig.publicUrl}/${storageConfig.bucket}/${imageKey}`;
}

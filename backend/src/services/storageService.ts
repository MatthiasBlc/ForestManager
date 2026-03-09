import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "../config/storage";
import logger from "../util/logger";

// Client interne pour les operations serveur (head, delete, etc.)
const s3Client = new S3Client({
  endpoint: `${storageConfig.useSSL ? "https" : "http"}://${storageConfig.endpoint}:${storageConfig.port}`,
  region: "us-east-1", // obligatoire pour le SDK, mais ignore par MinIO
  credentials: {
    accessKeyId: storageConfig.accessKey,
    secretAccessKey: storageConfig.secretKey,
  },
  forcePathStyle: true, // obligatoire pour MinIO (pas de virtual-hosted style)
});

// Client avec endpoint public pour generer les presigned URLs destinees au frontend
const publicS3Client = new S3Client({
  endpoint: storageConfig.publicUrl,
  region: "us-east-1",
  credentials: {
    accessKeyId: storageConfig.accessKey,
    secretAccessKey: storageConfig.secretKey,
  },
  forcePathStyle: true,
});

/**
 * Genere une presigned PUT URL pour upload direct depuis le frontend.
 */
export async function generatePresignedUploadUrl(key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: storageConfig.bucket,
    Key: key,
    ContentType: "image/webp",
  });

  // Utilise le client public pour que l'URL soit accessible depuis le navigateur
  const url = await getSignedUrl(publicS3Client, command, {
    expiresIn: storageConfig.presignedUrlTTL,
  });

  logger.debug({ key }, "Presigned upload URL generated");
  return url;
}

/**
 * Recupere les metadata d'un objet (content-type, taille).
 * Retourne null si l'objet n'existe pas.
 */
export async function headObject(
  key: string
): Promise<{ contentType: string; contentLength: number } | null> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: storageConfig.bucket,
        Key: key,
      })
    );

    return {
      contentType: response.ContentType ?? "unknown",
      contentLength: response.ContentLength ?? 0,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "NotFound") {
      return null;
    }
    throw err;
  }
}

/**
 * Supprime un objet du bucket.
 * Ne leve pas d'erreur si l'objet n'existe pas (idempotent).
 */
export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
    })
  );

  logger.debug({ key }, "Object deleted from storage");
}

/**
 * Valide qu'un fichier uploade sur MinIO respecte les contraintes.
 * Retourne un message d'erreur ou null si valide.
 */
export async function validateUploadedFile(key: string): Promise<string | null> {
  const metadata = await headObject(key);

  if (!metadata) {
    return "File not found on storage";
  }

  if (!storageConfig.allowedMimeTypes.includes(metadata.contentType)) {
    return `Invalid file type: ${metadata.contentType}. Allowed: ${storageConfig.allowedMimeTypes.join(", ")}`;
  }

  if (metadata.contentLength > storageConfig.maxFileSize) {
    return `File too large: ${metadata.contentLength} bytes. Max: ${storageConfig.maxFileSize} bytes`;
  }

  return null;
}

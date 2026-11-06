// Acces au stockage S3 (MinIO en preprod et prod, RustFS en dev et test) [D167].
// Deux adresses : l'interne (reseau Docker) pour les appels de l'API, la
// publique pour les URLs donnees au navigateur (envoi et lecture).
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { UPLOAD_MAX_BYTES, type UploadTicket } from "@fm/shared";
import { randomUUID } from "node:crypto";

import type { Env } from "../config/env.ts";
import { presignGetUrl, signingHour } from "./sign.ts";

/** Duree du formulaire d'envoi (plan C3). */
const UPLOAD_TTL_SECONDS = 60;
/** URL de lecture : signee a l'heure pile, valable 2 h (donc au moins 1 h). */
const READ_TTL_SECONDS = 2 * 60 * 60;
/** Cle unique par version : l'objet ne change jamais. */
const CACHE_CONTROL = "private, max-age=86400, immutable";

export interface StoredObject {
  key: string;
  lastModified: Date;
}

export interface Storage {
  /** URL signee de lecture, identique pendant une heure. */
  readUrl(key: string, now?: Date): string;
  /** Formulaire signe vers la zone d'attente de cet utilisateur. */
  createUpload(userId: string): Promise<UploadTicket>;
  /** Contenu d'un objet, null s'il n'existe pas ou depasse `maxBytes`. */
  read(key: string, maxBytes: number): Promise<Buffer | null>;
  /** Le type vient du contenu verifie, jamais du navigateur. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  list(prefix?: string): AsyncIterable<StoredObject>;
  /** Cree le bucket s'il manque (dev et test ; en prod il existe deja). */
  ensureBucket(): Promise<void>;
}

/** Cle d'un envoi en attente : l'identifiant seul ne suffit pas a prendre celui d'un autre. */
export function pendingKey(userId: string, uploadId: string): string {
  return `uploads/${userId}/${uploadId}`;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound");
}

/** Stockage configure par les variables MINIO_*, ou null sans MINIO_ENDPOINT. */
export function createStorage(env: Env): Storage | null {
  const { MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_PUBLIC_URL } =
    env;
  if (!MINIO_ENDPOINT || !MINIO_ACCESS_KEY || !MINIO_SECRET_KEY || !MINIO_BUCKET) return null;
  if (!MINIO_PUBLIC_URL) return null;
  const bucket = MINIO_BUCKET;
  const credentials = { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY };
  const options = {
    region: "us-east-1",
    forcePathStyle: true,
    credentials,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  } as const;
  const scheme = env.MINIO_USE_SSL ? "https" : "http";
  const client = new S3Client({
    ...options,
    endpoint: `${scheme}://${MINIO_ENDPOINT}:${String(env.MINIO_PORT)}`,
  });
  const publicClient = new S3Client({ ...options, endpoint: MINIO_PUBLIC_URL });

  return {
    readUrl(key, now = new Date()) {
      return presignGetUrl({
        publicUrl: MINIO_PUBLIC_URL,
        bucket,
        key,
        accessKey: MINIO_ACCESS_KEY,
        secretKey: MINIO_SECRET_KEY,
        signingDate: signingHour(now),
        expiresIn: READ_TTL_SECONDS,
      });
    },

    async createUpload(userId) {
      const uploadId = randomUUID();
      const { url, fields } = await createPresignedPost(publicClient, {
        Bucket: bucket,
        Key: pendingKey(userId, uploadId),
        // Le navigateur ajoute Content-Type (image/webp, ou image/jpeg sur Safari).
        Conditions: [
          ["content-length-range", 1, UPLOAD_MAX_BYTES],
          ["starts-with", "$Content-Type", "image/"],
        ],
        Expires: UPLOAD_TTL_SECONDS,
      });
      return {
        uploadId,
        url,
        fields,
        maxBytes: UPLOAD_MAX_BYTES,
        expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
      };
    },

    async read(key, maxBytes) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body || (res.ContentLength ?? 0) > maxBytes) return null;
        const bytes = await res.Body.transformToByteArray();
        return bytes.length > maxBytes ? null : Buffer.from(bytes);
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: CACHE_CONTROL,
        })
      );
    },

    async copy(from, to) {
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${from.split("/").map(encodeURIComponent).join("/")}`,
          Key: to,
        })
      );
    },

    async remove(keys) {
      for (let start = 0; start < keys.length; start += 1000) {
        const batch = keys.slice(start, start + 1000);
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          })
        );
      }
    },

    async *list(prefix) {
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
        );
        for (const object of page.Contents ?? []) {
          if (object.Key && object.LastModified) {
            yield { key: object.Key, lastModified: object.LastModified };
          }
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },

    async ensureBucket() {
      // Le stockage peut finir de demarrer apres l'API : quelques essais.
      for (let attempt = 1; ; attempt += 1) {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
          return;
        } catch (error) {
          const name = error instanceof Error ? error.name : "";
          if (name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists") return;
          if (attempt >= 10) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    },
  };
}

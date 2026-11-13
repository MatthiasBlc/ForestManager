// Briques du stockage sans serveur S3 : signature des URLs de lecture et
// verification des fichiers WebP [D167].
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";

import { presignGetUrl, signingHour } from "../src/core/storage/sign.ts";
import { readImageInfo } from "../src/core/storage/image-format.ts";
import { jpegBytes, webpBytes } from "./helpers/images.ts";

const credentials = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};

describe("presignGetUrl", () => {
  it.each([
    ["http://localhost:3000", "recipes/abc/1f2e.webp"],
    ["https://s3.example.fr", "users/u 1/avatar+(1).webp"],
  ])("produit la meme URL que le SDK AWS (%s)", async (publicUrl, key) => {
    const signingDate = new Date("2026-11-06T10:00:00Z");
    // Sans les sommes de controle ajoutees par defaut par le SDK (inutiles ici).
    const client = new S3Client({
      endpoint: publicUrl,
      region: "us-east-1",
      forcePathStyle: true,
      credentials,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    const expected = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: "bucket-test", Key: key }),
      {
        expiresIn: 7200,
        signingDate,
      }
    );

    const url = presignGetUrl({
      publicUrl,
      bucket: "bucket-test",
      key,
      accessKey: credentials.accessKeyId,
      secretKey: credentials.secretAccessKey,
      signingDate,
      expiresIn: 7200,
    });

    expect(new URL(url).searchParams.get("X-Amz-Signature")).toBe(
      new URL(expected).searchParams.get("X-Amz-Signature")
    );
    expect(url).toBe(expected);
  });

  it("garde la meme date de signature pendant une heure", () => {
    expect(signingHour(new Date("2026-11-06T10:59:59Z"))).toEqual(new Date("2026-11-06T10:00:00Z"));
    expect(signingHour(new Date("2026-11-06T11:00:00Z"))).toEqual(new Date("2026-11-06T11:00:00Z"));
  });
});

describe("readImageInfo", () => {
  it.each(["VP8", "VP8L", "VP8X"] as const)("lit les dimensions d'un WebP %s", (kind) => {
    expect(readImageInfo(webpBytes(640, 480, kind))).toEqual({
      format: "webp",
      width: 640,
      height: 480,
    });
  });

  it("lit les dimensions d'un JPEG", () => {
    expect(readImageInfo(jpegBytes(1200, 900))).toEqual({
      format: "jpeg",
      width: 1200,
      height: 900,
    });
  });

  it("refuse ce qui n'est ni un WebP ni un JPEG", () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    expect(readImageInfo(png)).toBeNull();
    expect(readImageInfo(Buffer.alloc(0))).toBeNull();
    expect(readImageInfo(Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPJUNK", "latin1"))).toBeNull();
    expect(readImageInfo(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });

  it("refuse un fichier tronque ou suivi d'autre chose", () => {
    const webp = webpBytes(64, 64);
    expect(readImageInfo(webp.subarray(0, webp.length - 4))).toBeNull();
    expect(readImageInfo(Buffer.concat([webp, Buffer.from("<script>")]))).toBeNull();
    const jpeg = jpegBytes(64, 64);
    expect(readImageInfo(jpeg.subarray(0, jpeg.length - 2))).toBeNull();
    expect(readImageInfo(Buffer.concat([jpeg, Buffer.from("<script>")]))).toBeNull();
  });
});

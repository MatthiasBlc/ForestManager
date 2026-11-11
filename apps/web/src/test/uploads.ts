// Envoi de photos simule [D167] : config avec `uploads`, tickets de l'API et
// stockage factice. Les fichiers de test remplacent aussi `lib/image.ts` par
// `test/fake-image.ts` (jsdom ne dessine pas).
import { UPLOAD_MAX_BYTES } from "@fm/shared";
import { http, HttpResponse } from "msw";

import { server } from "./server.ts";
import { buildConfig } from "./fixtures.ts";

const STORAGE_URL = "http://storage.test/bucket";

export function mockUploads() {
  const uploadIds: string[] = [];
  server.use(
    http.get("/api/v1/config", () =>
      HttpResponse.json(buildConfig({ email: true, uploads: true }))
    ),
    http.post("/api/v1/uploads", () => {
      const uploadId = crypto.randomUUID();
      uploadIds.push(uploadId);
      return HttpResponse.json(
        {
          uploadId,
          url: STORAGE_URL,
          fields: { key: `uploads/me/${uploadId}` },
          maxBytes: UPLOAD_MAX_BYTES,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
        { status: 201 }
      );
    }),
    http.post(STORAGE_URL, () => new HttpResponse(null, { status: 204 }))
  );
  return { uploadIds };
}

/** Image choisie dans le selecteur de fichiers. */
export function photoFile(name = "photo.jpg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

/** URL signee renvoyee par l'API apres un rattachement. */
export function signedUrl(key: string): string {
  return `${STORAGE_URL}/${key}?X-Amz-Signature=test`;
}

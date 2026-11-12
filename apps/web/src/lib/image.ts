// Conversion d'une image avant l'envoi [D167] : plus grand cote borne, WebP
// quand le navigateur sait l'encoder, sinon JPEG (Safari rend du PNG pour le
// WebP), qualite baissee jusqu'a passer sous la limite du stockage.
import { UPLOAD_MAX_BYTES } from "@fm/shared";

import { ApiRequestError } from "./api.ts";

const QUALITIES = [0.85, 0.7, 0.55, 0.4];

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

export async function convertImage(file: Blob, maxSide: number): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ApiRequestError(
      "IMAGE_UNREADABLE",
      0,
      "Cette image ne peut pas être lue. Essaie une photo JPEG ou PNG."
    );
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new ApiRequestError(
      "IMAGE_UNREADABLE",
      0,
      "Ton navigateur ne peut pas préparer l'image."
    );
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let type = "image/webp";
  for (const quality of QUALITIES) {
    let blob = await encode(canvas, type, quality);
    if (blob && blob.type !== type) {
      type = "image/jpeg";
      blob = await encode(canvas, type, quality);
    }
    if (blob && blob.type === type && blob.size <= UPLOAD_MAX_BYTES) return blob;
  }
  throw new ApiRequestError(
    "IMAGE_TOO_LARGE",
    0,
    "Cette image reste trop lourde, même compressée. Essaie une autre photo."
  );
}

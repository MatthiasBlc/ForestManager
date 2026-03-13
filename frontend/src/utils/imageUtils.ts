export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_DIMENSION = 1600;

export async function processImage(file: File): Promise<Blob> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Format non supporte. Utilisez JPEG, PNG ou WebP.");
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Resize if needed (keep aspect ratio, max 1600px on largest side)
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de traiter l'image. Veuillez reessayer.");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("La conversion de l'image a echoue."))),
      "image/webp",
      0.8
    );
  });

  if (blob.size > MAX_FILE_SIZE) {
    throw new Error(
      `Image trop volumineuse apres conversion (${(blob.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 2 Mo.`
    );
  }

  return blob;
}

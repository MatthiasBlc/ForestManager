// Fichiers WebP minimaux construits a la main : seuls les en-tetes comptent
// pour la verification serveur (signature RIFF / WEBP et dimensions).

export type WebpKind = "VP8" | "VP8L" | "VP8X";

function riff(chunk: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(20);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(12 + payload.length, 4);
  header.write("WEBP", 8, "ascii");
  header.write(chunk.padEnd(4, " "), 12, "ascii");
  header.writeUInt32LE(payload.length, 16);
  return Buffer.concat([header, payload]);
}

/** Un WebP valide de la taille demandee (contenu d'image factice). */
export function webpBytes(width: number, height: number, kind: WebpKind = "VP8"): Buffer {
  if (kind === "VP8") {
    const payload = Buffer.alloc(10 + 16);
    payload.writeUIntLE(0, 0, 3); // frame tag (image cle)
    payload.writeUInt8(0x9d, 3);
    payload.writeUInt8(0x01, 4);
    payload.writeUInt8(0x2a, 5);
    payload.writeUInt16LE(width & 0x3fff, 6);
    payload.writeUInt16LE(height & 0x3fff, 8);
    return riff("VP8", payload);
  }
  if (kind === "VP8L") {
    const payload = Buffer.alloc(5 + 16);
    payload.writeUInt8(0x2f, 0);
    payload.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 1);
    return riff("VP8L", payload);
  }
  const payload = Buffer.alloc(10);
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  return riff("VP8X", payload);
}

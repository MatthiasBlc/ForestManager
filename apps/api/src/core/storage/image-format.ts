// Verification serveur d'une image envoyee : WebP (conteneur RIFF complet,
// dimensions du premier bloc VP8, VP8L ou VP8X) ou JPEG (Safari n'encode pas
// le WebP). Le contenu decide du format, jamais le type annonce [D167].

export type ImageFormat = "webp" | "jpeg";

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
}

export const IMAGE_CONTENT_TYPES: Record<ImageFormat, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
};

export const IMAGE_EXTENSIONS: Record<ImageFormat, string> = { webp: "webp", jpeg: "jpg" };

function readWebp(file: Buffer): ImageInfo | null {
  if (file.length < 30) return null;
  if (file.toString("ascii", 0, 4) !== "RIFF" || file.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  // La taille annoncee couvre tout le fichier : rien d'ajoute, rien de tronque.
  if (file.readUInt32LE(4) + 8 !== file.length) return null;

  const chunk = file.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    if (file[23] !== 0x9d || file[24] !== 0x01 || file[25] !== 0x2a) return null;
    return {
      format: "webp",
      width: file.readUInt16LE(26) & 0x3fff,
      height: file.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (file[20] !== 0x2f) return null;
    const bits = file.readUInt32LE(21);
    return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return {
      format: "webp",
      width: file.readUIntLE(24, 3) + 1,
      height: file.readUIntLE(27, 3) + 1,
    };
  }
  return null;
}

/** Marqueurs SOF (debut d'image) ; C4, C8 et CC sont d'autres segments. */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function readJpeg(file: Buffer): ImageInfo | null {
  if (file.length < 4 || file[0] !== 0xff || file[1] !== 0xd8) return null;
  // Fin d'image a la toute fin : rien d'ajoute, rien de tronque.
  if (file[file.length - 2] !== 0xff || file[file.length - 1] !== 0xd9) return null;
  let offset = 2;
  while (offset + 4 <= file.length) {
    if (file[offset] !== 0xff) return null;
    const marker = file[offset + 1] ?? 0;
    const length = file.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (isStartOfFrame(marker)) {
      if (offset + 9 > file.length) return null;
      return {
        format: "jpeg",
        height: file.readUInt16BE(offset + 5),
        width: file.readUInt16BE(offset + 7),
      };
    }
    // Les donnees compressees (SOS) n'arrivent qu'apres le SOF.
    if (marker === 0xda || marker === 0xd9) return null;
    offset += 2 + length;
  }
  return null;
}

/** Format et dimensions d'une image, ou null si ce n'est pas un WebP ou un JPEG valide. */
export function readImageInfo(file: Buffer): ImageInfo | null {
  return readWebp(file) ?? readJpeg(file);
}

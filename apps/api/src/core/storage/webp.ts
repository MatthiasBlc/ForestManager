// Verification serveur d'un fichier WebP : conteneur RIFF complet et
// dimensions lues dans le premier bloc (VP8, VP8L ou VP8X). Le navigateur
// convertit toute image en WebP avant l'envoi [D167].

export interface ImageSize {
  width: number;
  height: number;
}

/** Dimensions d'un WebP, ou null si le fichier n'en est pas un valide. */
export function readWebpSize(file: Buffer): ImageSize | null {
  if (file.length < 30) return null;
  if (file.toString("ascii", 0, 4) !== "RIFF" || file.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  // La taille annoncee couvre tout le fichier : rien d'ajoute, rien de tronque.
  if (file.readUInt32LE(4) + 8 !== file.length) return null;

  const chunk = file.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    if (file[23] !== 0x9d || file[24] !== 0x01 || file[25] !== 0x2a) return null;
    return { width: file.readUInt16LE(26) & 0x3fff, height: file.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (file[20] !== 0x2f) return null;
    const bits = file.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: file.readUIntLE(24, 3) + 1, height: file.readUIntLE(27, 3) + 1 };
  }
  return null;
}

// Bandeau "PREPROD" pose sur les icones de la variante preprod [D220] : bande
// rouge pleine largeur dans le bas de l'icone, texte blanc en police pixel 5x7
// (nette a toutes les tailles, sans police ni outil d'image). La forme de
// l'icone est gardee (alpha d'origine).
import type { Image } from "./png.ts";

export const BANNER_RGB = [220, 38, 38] as const;
export const TEXT_RGB = [255, 255, 255] as const;

const TEXT = "PREPROD";
const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const GLYPHS: Record<string, readonly string[]> = {
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
};
// Largeur du texte en colonnes de pixels : lettres + une colonne d'espace entre elles.
const TEXT_COLUMNS = TEXT.length * (GLYPH_WIDTH + 1) - 1;

// Bande (haut, bas) et largeur max du texte, en fraction de la taille de l'icone.
// Maskable : le texte tient dans la zone sure (cercle de 40 % de rayon), le
// lanceur pouvant rogner tout le reste.
const LAYOUT = {
  any: { top: 0.62, bottom: 0.84, textWidth: 0.8 },
  maskable: { top: 0.57, bottom: 0.75, textWidth: 0.65 },
};

export function addPreprodBanner(source: Image, { maskable }: { maskable: boolean }): Image {
  const { width, height } = source;
  const data = new Uint8Array(source.data);
  const layout = maskable ? LAYOUT.maskable : LAYOUT.any;
  const top = Math.round(height * layout.top);
  const bottom = Math.round(height * layout.bottom);

  const paint = (x: number, y: number, rgb: readonly [number, number, number]) => {
    data.set(rgb, (y * width + x) * 4);
  };

  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) paint(x, y, BANNER_RGB);
  }

  const scale = Math.max(
    1,
    Math.floor(
      Math.min((width * layout.textWidth) / TEXT_COLUMNS, ((bottom - top) * 0.62) / GLYPH_HEIGHT)
    )
  );
  const left = Math.floor((width - TEXT_COLUMNS * scale) / 2);
  const textTop = top + Math.floor((bottom - top - GLYPH_HEIGHT * scale) / 2);
  for (let index = 0; index < TEXT.length; index++) {
    const rows = GLYPHS[TEXT.charAt(index)] ?? [];
    rows.forEach((row, gy) => {
      for (let gx = 0; gx < GLYPH_WIDTH; gx++) {
        if (row.charAt(gx) !== "1") continue;
        const x0 = left + (index * (GLYPH_WIDTH + 1) + gx) * scale;
        const y0 = textTop + gy * scale;
        for (let y = y0; y < y0 + scale; y++) {
          for (let x = x0; x < x0 + scale; x++) paint(x, y, TEXT_RGB);
        }
      }
    });
  }

  return { width, height, data };
}

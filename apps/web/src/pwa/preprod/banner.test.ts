import { describe, expect, it } from "vitest";

import { addPreprodBanner, BANNER_RGB, TEXT_RGB } from "./banner.ts";
import type { Image } from "./png.ts";

// Carre opaque uni, avec un coin transparent (forme de l'icone a respecter).
function square(size: number): Image {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) data.set([22, 24, 27, 255], i * 4);
  data[3] = 0;
  return { width: size, height: size, data };
}

function pixel(image: Image, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return Array.from(image.data.slice(i, i + 4));
}

function textPixels(image: Image): { x: number; y: number }[] {
  const out = [];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const [r, g, b] = pixel(image, x, y);
      if (r === TEXT_RGB[0] && g === TEXT_RGB[1] && b === TEXT_RGB[2]) out.push({ x, y });
    }
  }
  return out;
}

describe("bandeau PREPROD des icones (D220)", () => {
  it("garde le haut de l'icone et sa transparence, pose le bandeau en bas", () => {
    const source = square(192);
    const result = addPreprodBanner(source, { maskable: false });
    expect(result).not.toBe(source);
    expect(pixel(result, 96, 20)).toEqual([22, 24, 27, 255]);
    expect(pixel(result, 0, 0)[3]).toBe(0);
    expect(pixel(result, 2, Math.round(192 * 0.73))).toEqual([...BANNER_RGB, 255]);
    // Source intacte.
    expect(pixel(source, 2, Math.round(192 * 0.73))).toEqual([22, 24, 27, 255]);
  });

  it("ecrit PREPROD lisible : texte centre, dans le bandeau, assez grand", () => {
    const result = addPreprodBanner(square(512), { maskable: false });
    const text = textPixels(result);
    const xs = text.map((p) => p.x);
    const ys = text.map((p) => p.y);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    // 7 lettres de 5 colonnes + 6 espaces = 41 colonnes, centrees.
    expect((maxX - minX + 1) % 41).toBe(0);
    expect(maxX - minX + 1).toBeGreaterThanOrEqual(512 * 0.6);
    expect(Math.abs(minX + maxX - 511)).toBeLessThanOrEqual(1);
    expect(minY).toBeGreaterThan(512 * 0.6);
    expect(maxY).toBeLessThan(512 * 0.86);
  });

  it("reste lisible sur la plus petite icone (favicon 64 px)", () => {
    const text = textPixels(addPreprodBanner(square(64), { maskable: false }));
    expect(new Set(text.map((p) => p.x)).size).toBeGreaterThan(20);
  });

  it("icone maskable : texte dans la zone sure (cercle de 40 %)", () => {
    const size = 512;
    const text = textPixels(addPreprodBanner(square(size), { maskable: true }));
    expect(text.length).toBeGreaterThan(0);
    const c = (size - 1) / 2;
    for (const { x, y } of text) {
      expect(Math.hypot(x - c, y - c)).toBeLessThanOrEqual(size * 0.4);
    }
  });
});

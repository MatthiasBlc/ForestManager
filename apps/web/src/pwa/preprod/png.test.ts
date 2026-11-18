import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { decodePng, encodePng } from "./png.ts";

// Pas de `new URL(..., import.meta.url)` : Vite le prendrait pour un asset.
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../../../public/");

describe("PNG sans dependance (D220)", () => {
  it("lit les icones de l'application (RGBA 8 bits)", () => {
    const icon = decodePng(readFileSync(join(publicDir, "icon-512.png")));
    expect(icon.width).toBe(512);
    expect(icon.height).toBe(512);
    expect(icon.data).toHaveLength(512 * 512 * 4);
    // Coin arrondi transparent, centre opaque.
    expect(icon.data[3]).toBe(0);
    expect(icon.data[(256 * 512 + 256) * 4 + 3]).toBe(255);
  });

  it("ecrit une image relue a l'identique", () => {
    const data = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) % 256);
    const image = { width: 3, height: 2, data };
    const back = decodePng(encodePng(image));
    expect(back).toEqual(image);
  });

  it("refuse ce qui n'est pas un PNG", () => {
    expect(() => decodePng(Buffer.from("not a png"))).toThrow(/PNG/);
  });
});

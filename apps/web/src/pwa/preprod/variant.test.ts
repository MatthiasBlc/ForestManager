import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { decodePng } from "./png.ts";
import {
  PREPROD_ICONS,
  preprodHtml,
  preprodManifest,
  writePreprodVariant,
  type WebManifest,
} from "./variant.ts";

// Pas de `new URL(..., import.meta.url)` : Vite le prendrait pour un asset.
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../../../public/");

const manifest: WebManifest = {
  name: "Forest Manager",
  short_name: "Forest",
  theme_color: "#16181b",
  icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
};

const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="manifest" href="/manifest.webmanifest">
    <title>Forest Manager</title>
  </head>
  <body></body>
</html>`;

describe("variante preprod de la PWA (D220)", () => {
  it("manifeste : nom et nom court explicites, le reste inchange", () => {
    const result = preprodManifest(manifest);
    expect(result.name).toBe("Forest Manager Preprod");
    expect(result.short_name).toBe("FM Preprod");
    expect(result.icons).toEqual(manifest.icons);
    expect(result.theme_color).toBe("#16181b");
    expect(manifest.name).toBe("Forest Manager");
  });

  it("index.html : titre d'onglet et nom d'ecran d'accueil (iOS)", () => {
    const result = preprodHtml(html);
    expect(result).toContain("<title>Forest Manager Preprod</title>");
    expect(result).toContain('<meta name="apple-mobile-web-app-title" content="FM Preprod" />');
    expect(result).toContain('<link rel="manifest" href="/manifest.webmanifest">');
  });

  it("index.html sans titre : erreur au build plutot qu'une preprod deguisee en prod", () => {
    expect(() => preprodHtml("<html><head></head></html>")).toThrow(/title/);
  });

  describe("dossier preprod/ du build", () => {
    let outDir = "";
    afterEach(() => {
      rmSync(outDir, { recursive: true, force: true });
    });

    it("derive manifeste, index.html et icones a bandeau du build ; ne touche pas a la racine", () => {
      outDir = mkdtempSync(join(tmpdir(), "fm-pwa-"));
      writeFileSync(join(outDir, "index.html"), html);
      writeFileSync(join(outDir, "manifest.webmanifest"), JSON.stringify(manifest));
      for (const { file } of PREPROD_ICONS) copyFileSync(join(publicDir, file), join(outDir, file));

      writePreprodVariant(outDir);

      expect(readFileSync(join(outDir, "index.html"), "utf8")).toBe(html);
      expect(readFileSync(join(outDir, "manifest.webmanifest"), "utf8")).toBe(
        JSON.stringify(manifest)
      );
      expect(readFileSync(join(outDir, "preprod/index.html"), "utf8")).toBe(preprodHtml(html));
      expect(
        JSON.parse(readFileSync(join(outDir, "preprod/manifest.webmanifest"), "utf8"))
      ).toEqual(preprodManifest(manifest));
      for (const { file } of PREPROD_ICONS) {
        const original = readFileSync(join(outDir, file));
        const variant = readFileSync(join(outDir, "preprod", file));
        expect(variant.equals(original)).toBe(false);
        expect(decodePng(variant).width).toBe(decodePng(original).width);
      }
    });
  });
});

// Variante preprod de la PWA [D220] : nom et icones distincts de la prod, pour
// reconnaitre l'application installee sur le telephone.
//
// La meme image du front sert la preprod et la prod : la variante est construite
// a cote du build (dist/preprod/), puis recopiee a la racine au demarrage du
// conteneur quand WEB_VARIANT=preprod (docker/web-variant.sh). Sans la variable,
// rien ne change : la racine du build est celle de la prod.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import type { ManifestOptions } from "vite-plugin-pwa";

import { addPreprodBanner } from "./banner.ts";
import { decodePng, encodePng } from "./png.ts";

export type WebManifest = Partial<ManifestOptions>;

export const PREPROD_NAME = "Forest Manager Preprod";
export const PREPROD_SHORT_NAME = "FM Preprod";
export const PREPROD_DIR = "preprod";

/** Icones de public/ (copiees a la racine du build) qui recoivent le bandeau. */
export const PREPROD_ICONS = [
  { file: "icon-192.png", maskable: false },
  { file: "icon-512.png", maskable: false },
  { file: "icon-maskable-512.png", maskable: true },
  { file: "apple-touch-icon.png", maskable: false },
  { file: "favicon.png", maskable: false },
] as const;

export function preprodManifest(manifest: WebManifest): WebManifest {
  return { ...manifest, name: PREPROD_NAME, short_name: PREPROD_SHORT_NAME };
}

export function preprodHtml(html: string): string {
  if (!/<title>[^<]*<\/title>/.test(html)) {
    throw new Error("index.html has no <title> to rename for the preprod variant");
  }
  return html.replace(
    /<title>[^<]*<\/title>/,
    `<meta name="apple-mobile-web-app-title" content="${PREPROD_SHORT_NAME}" />\n    <title>${PREPROD_NAME}</title>`
  );
}

/** Ecrit `<outDir>/preprod/` a partir du build de prod deja ecrit dans outDir. */
export function writePreprodVariant(outDir: string): void {
  const target = join(outDir, PREPROD_DIR);
  mkdirSync(target, { recursive: true });

  const html = readFileSync(join(outDir, "index.html"), "utf8");
  writeFileSync(join(target, "index.html"), preprodHtml(html));

  const manifest = JSON.parse(
    readFileSync(join(outDir, "manifest.webmanifest"), "utf8")
  ) as WebManifest;
  writeFileSync(join(target, "manifest.webmanifest"), JSON.stringify(preprodManifest(manifest)));

  for (const { file, maskable } of PREPROD_ICONS) {
    const icon = decodePng(readFileSync(join(outDir, file)));
    writeFileSync(join(target, file), encodePng(addPreprodBanner(icon, { maskable })));
  }
}

/** Plugin Vite : variante ecrite apres le build (manifeste de vite-plugin-pwa compris). */
export function preprodVariant(): Plugin {
  return {
    name: "fm:preprod-variant",
    apply: "build",
    writeBundle(options) {
      if (!options.dir) throw new Error("preprod variant needs build.outDir");
      writePreprodVariant(options.dir);
    },
  };
}

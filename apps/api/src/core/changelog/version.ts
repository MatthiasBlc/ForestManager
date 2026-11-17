// Version de l'application : celle de release.json (calculee par la CI, D187),
// sinon celle du package.json racine (dev et tests). Lue une fois au demarrage.
import { readFileSync } from "node:fs";

import { readReleaseFile } from "./service.ts";

export const APP_VERSION = (() => {
  try {
    const release = readReleaseFile();
    if (release) return release.version;
    const raw = readFileSync(new URL("../../../../../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "inconnue";
  } catch {
    return "inconnue";
  }
})();

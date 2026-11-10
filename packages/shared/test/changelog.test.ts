// Changelog (C6.6) [D187] : contenu d'une version et fichier release.json.
import { describe, expect, it } from "vitest";

import {
  compareVersions,
  releaseContentSchema,
  releaseFileSchema,
  updateReleaseBodySchema,
} from "../src/index.ts";

describe("contenu d'une version", () => {
  it("trois sections d'items texte, vides par defaut, texte nettoye", () => {
    expect(releaseContentSchema.parse({})).toEqual({
      features: [],
      improvements: [],
      fixes: [],
    });
    const parsed = releaseContentSchema.parse({ features: [{ text: "  Recettes composees " }] });
    expect(parsed.features).toEqual([{ text: "Recettes composees" }]);
  });

  it("refuse un item vide ou une section inconnue", () => {
    expect(releaseContentSchema.safeParse({ fixes: [{ text: "  " }] }).success).toBe(false);
    expect(updateReleaseBodySchema.safeParse({ title: "T", content: { other: [] } }).success).toBe(
      false
    );
  });
});

describe("release.json", () => {
  it("version semver obligatoire", () => {
    expect(releaseFileSchema.safeParse({ version: "2.1.0", content: {} }).success).toBe(true);
    expect(releaseFileSchema.safeParse({ version: "v2.1", content: {} }).success).toBe(false);
  });
});

describe("ordre des versions", () => {
  it("compare numeriquement, la plus recente d'abord une fois triee", () => {
    const sorted = ["2.0.0", "2.10.0", "2.9.1", "10.0.0"].sort(compareVersions).reverse();
    expect(sorted).toEqual(["10.0.0", "2.10.0", "2.9.1", "2.0.0"]);
  });
});

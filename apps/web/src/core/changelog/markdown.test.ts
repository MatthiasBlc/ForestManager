// Markdown en ligne des notes de version [D226] : sous-ensemble ferme, jamais de HTML.
import { describe, expect, it } from "vitest";

import { parseInline } from "./markdown.ts";

describe("parseInline", () => {
  it("texte simple : un seul morceau", () => {
    expect(parseInline("Planning plus rapide")).toEqual([
      { type: "text", text: "Planning plus rapide" },
    ]);
  });

  it("gras, italique et code", () => {
    expect(parseInline("Le **planning** est *bien* plus `rapide` !")).toEqual([
      { type: "text", text: "Le " },
      { type: "strong", text: "planning" },
      { type: "text", text: " est " },
      { type: "em", text: "bien" },
      { type: "text", text: " plus " },
      { type: "code", text: "rapide" },
      { type: "text", text: " !" },
    ]);
  });

  it("liens http et https seulement", () => {
    expect(parseInline("Voir [le guide](https://example.com/guide?a=1).")).toEqual([
      { type: "text", text: "Voir " },
      { type: "link", text: "le guide", href: "https://example.com/guide?a=1" },
      { type: "text", text: "." },
    ]);
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { type: "text", text: "[x](javascript:alert(1))" },
    ]);
    expect(parseInline("[x](/relatif)")).toEqual([{ type: "text", text: "[x](/relatif)" }]);
  });

  it("le HTML reste du texte", () => {
    expect(parseInline("<img src=x onerror=alert(1)> **ok**")).toEqual([
      { type: "text", text: "<img src=x onerror=alert(1)> " },
      { type: "strong", text: "ok" },
    ]);
  });

  it("marqueurs orphelins ou vides : laisses tels quels", () => {
    expect(parseInline("2 * 3 = 6, **, ``")).toEqual([{ type: "text", text: "2 * 3 = 6, **, ``" }]);
    expect(parseInline("un **gras non ferme")).toEqual([
      { type: "text", text: "un **gras non ferme" },
    ]);
  });
});

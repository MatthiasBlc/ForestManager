// Differences entre deux contenus de recette (comparer une adaptation, suggestions).
import { describe, expect, it } from "vitest";

import { diffContents, type RecipeContentView } from "../src/index.ts";

const G = "00000000-0000-4000-8000-0000000000a1"; // grammes
const CL = "00000000-0000-4000-8000-0000000000a2";
const PATES = "00000000-0000-4000-8000-0000000000b1";
const CREME = "00000000-0000-4000-8000-0000000000b2";
const BEURRE = "00000000-0000-4000-8000-0000000000b3";
const SAUCE = "00000000-0000-4000-8000-0000000000c1";

const line = (
  ingredientId: string,
  name: string,
  quantity: number | null,
  unitId: string | null
) => ({
  ingredientId,
  name,
  namePlural: null,
  quantity,
  unitId,
  note: null,
  optional: false,
});

function content(over: Partial<RecipeContentView> = {}): RecipeContentView {
  return {
    title: "Gratin de pâtes",
    description: null,
    notes: null,
    sourceUrl: null,
    yieldQuantity: 4,
    yieldUnitId: null,
    prepMinutes: 15,
    cookMinutes: 25,
    restMinutes: null,
    isBase: false,
    blocks: [
      {
        kind: "LOCAL",
        title: null,
        ingredients: [line(PATES, "Pâtes", 500, G), line(CREME, "Crème", 10, CL)],
        steps: ["Cuire les pâtes.", "Gratiner."],
      },
    ],
    ...over,
  };
}

describe("diffContents", () => {
  it("rien si les contenus sont identiques", () => {
    expect(diffContents(content(), content())).toEqual([]);
  });

  it("champs simples dans l'ordre d'affichage", () => {
    const diff = diffContents(content(), content({ cookMinutes: 35, title: "Gratin" }));
    expect(diff).toEqual([
      { kind: "field", field: "title", before: "Gratin de pâtes", after: "Gratin" },
      { kind: "field", field: "cook", before: 25, after: 35 },
    ]);
  });

  it("rendement compare quantite et unite ensemble", () => {
    const diff = diffContents(content(), content({ yieldQuantity: 6 }));
    expect(diff).toEqual([
      {
        kind: "field",
        field: "yield",
        before: { quantity: 4, unitId: null },
        after: { quantity: 6, unitId: null },
      },
    ]);
  });

  it("ingredients : modifie, retire, ajoute (apparies par ingredient)", () => {
    const after = content();
    after.blocks = [
      {
        kind: "LOCAL",
        title: null,
        ingredients: [line(PATES, "Pâtes", 400, G), line(BEURRE, "Beurre", 10, G)],
        steps: ["Cuire les pâtes.", "Gratiner."],
      },
    ];
    expect(diffContents(content(), after)).toEqual([
      {
        kind: "ingredient",
        block: 0,
        blockTitle: null,
        before: line(PATES, "Pâtes", 500, G),
        after: line(PATES, "Pâtes", 400, G),
      },
      {
        kind: "ingredient",
        block: 0,
        blockTitle: null,
        before: line(CREME, "Crème", 10, CL),
        after: null,
      },
      {
        kind: "ingredient",
        block: 0,
        blockTitle: null,
        before: null,
        after: line(BEURRE, "Beurre", 10, G),
      },
    ]);
  });

  it("etapes par position : modifiee puis ajoutee", () => {
    const after = content();
    const block = after.blocks[0];
    if (block?.kind !== "LOCAL") throw new Error("bloc local attendu");
    block.steps = ["Cuire les pâtes.", "Gratiner 20 min.", "Servir."];
    expect(diffContents(content(), after)).toEqual([
      { kind: "step", block: 0, blockTitle: null, before: "Gratiner.", after: "Gratiner 20 min." },
      { kind: "step", block: 0, blockTitle: null, before: null, after: "Servir." },
    ]);
  });

  it("blocs : titre change, lien modifie, bloc ajoute", () => {
    const link = {
      kind: "RECIPE" as const,
      recipeId: SAUCE,
      title: "Sauce",
      quantity: 150,
      unitId: null,
    };
    const before = content();
    before.blocks.push(link);
    const after = content();
    const first = after.blocks[0];
    if (first?.kind !== "LOCAL") throw new Error("bloc local attendu");
    first.title = "Pâtes";
    after.blocks.push(
      { ...link, quantity: 200 },
      { kind: "LOCAL", title: "Service", ingredients: [], steps: [] }
    );
    const diff = diffContents(before, after);
    expect(diff.map((entry) => [entry.kind, "block" in entry ? entry.block : null])).toEqual([
      ["block", 0],
      ["block", 1],
      ["block", 2],
    ]);
    expect(diff[1]).toEqual({
      kind: "block",
      block: 1,
      before: link,
      after: { ...link, quantity: 200 },
    });
    expect(diff[2]).toMatchObject({ before: null, after: { title: "Service" } });
  });
});

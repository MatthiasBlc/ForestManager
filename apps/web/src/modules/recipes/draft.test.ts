// Import dans une recette existante [D212] : le contenu vient de l'import,
// titre, tags, notes et recette de base restent ceux de la fiche.
import type { ImportedRecipe, Unit } from "@fm/shared";
import { describe, expect, it } from "vitest";

import { emptyDraft, mergeImport, type Draft, type DraftLocalBlock } from "./draft.ts";

const units = [{ id: "u-g", code: "g" }] as unknown as Unit[];

function imported(over: Partial<ImportedRecipe> = {}): ImportedRecipe {
  return {
    title: "Titre de la page",
    yieldQuantity: 2,
    prepMinutes: 10,
    cookMinutes: 20,
    restMinutes: null,
    sourceUrl: "https://exemple.fr/recette",
    imageUrl: null,
    ingredients: [
      {
        raw: "200 g de riz",
        quantity: 200,
        unitCode: "g",
        name: "riz",
        note: null,
        optional: false,
        check: false,
      },
    ],
    steps: ["Cuire le riz."],
    ...over,
  };
}

function current(): Draft {
  return {
    ...emptyDraft(),
    title: "Mon idée",
    notes: "Note perso",
    sourceUrl: "https://ancien.fr",
    yieldQuantity: 4,
    prepMinutes: "5",
    isBase: true,
    globalTagIds: ["g1"],
    spaceTagIds: ["s1"],
  };
}

describe("mergeImport", () => {
  it("remplace le contenu et garde titre, notes, tags et recette de base", () => {
    const merged = mergeImport(current(), imported(), units);
    expect(merged).toMatchObject({
      title: "Mon idée",
      notes: "Note perso",
      isBase: true,
      globalTagIds: ["g1"],
      spaceTagIds: ["s1"],
      yieldQuantity: 2,
      prepMinutes: "10",
      cookMinutes: "20",
      restMinutes: "",
      sourceUrl: "https://exemple.fr/recette",
    });
    expect(merged.blocks).toHaveLength(1);
    const block = merged.blocks[0] as DraftLocalBlock;
    expect(block.lines[0]).toMatchObject({ name: "riz", quantity: "200", unitId: "u-g" });
    expect(block.steps[0]?.text).toBe("Cuire le riz.");
  });

  it("un texte colle sans lien ni portions garde ceux de la fiche", () => {
    const merged = mergeImport(
      current(),
      imported({ sourceUrl: null, yieldQuantity: null }),
      units
    );
    expect(merged.sourceUrl).toBe("https://ancien.fr");
    expect(merged.yieldQuantity).toBe(4);
  });

  it("garde le facultatif d'une ligne importee (D232)", () => {
    const line = imported().ingredients[0];
    const merged = mergeImport(
      current(),
      imported({ ingredients: line ? [{ ...line, optional: true }] : [] }),
      units
    );
    const block = merged.blocks[0] as DraftLocalBlock;
    expect(block.lines[0]).toMatchObject({ name: "riz", optional: true });
  });
});

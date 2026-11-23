// Saisie du champ d'ajout [D228] : quantite et unite tapees dans le meme champ.
import { describe, expect, it } from "vitest";

import { UNITS, unitId } from "../../test/fixtures.ts";
import { formatParts, matchIngredient, parseAmount, parseEntry } from "./entry.ts";

describe("parseEntry", () => {
  it("un simple libelle n'a pas de quantite", () => {
    expect(parseEntry("piles AA", UNITS)).toEqual({ name: "piles AA", parts: [] });
  });

  it("quantite sans unite : des pieces", () => {
    expect(parseEntry("2 citrons", UNITS)).toEqual({
      name: "citrons",
      parts: [{ quantity: 2, unitId: null }],
    });
  });

  it("quantite et unite du referentiel", () => {
    expect(parseEntry("500 g farine", UNITS)).toEqual({
      name: "farine",
      parts: [{ quantity: 500, unitId: unitId("g") }],
    });
  });

  it("la virgule reste dans le libelle", () => {
    expect(parseEntry("sel, poivre", UNITS)).toEqual({ name: "sel, poivre", parts: [] });
  });

  it("un texte vide ne donne rien", () => {
    expect(parseEntry("   ", UNITS)).toBeNull();
  });
});

describe("parseAmount", () => {
  it("lit une ou plusieurs parts, ou rien", () => {
    expect(parseAmount("1 kg", UNITS)).toEqual([{ quantity: 1, unitId: unitId("kg") }]);
    expect(parseAmount("500 g + 3", UNITS)).toEqual([
      { quantity: 500, unitId: unitId("g") },
      { quantity: 3, unitId: null },
    ]);
    expect(parseAmount("", UNITS)).toEqual([]);
    expect(parseAmount("beaucoup", UNITS)).toBeNull();
  });
});

describe("formatParts", () => {
  it("joint les parts, unites lisibles", () => {
    expect(
      formatParts(
        [
          { quantity: 500, unitId: unitId("g") },
          { quantity: 3, unitId: null },
        ],
        UNITS
      )
    ).toBe("500 g + 3");
    expect(formatParts([{ quantity: 1.5, unitId: unitId("kg") }], UNITS)).toBe("1,5 kg");
    expect(formatParts([], UNITS)).toBe("");
  });
});

describe("matchIngredient", () => {
  const lemon = { id: "a", name: "citron", namePlural: "citrons" };
  it("trouve l'ingredient par son nom ou son pluriel, sans accents ni casse", () => {
    expect(matchIngredient("Citrons", [lemon])).toBe(lemon);
    expect(matchIngredient("citron", [lemon])).toBe(lemon);
    expect(matchIngredient("citronnelle", [lemon])).toBeUndefined();
  });
});

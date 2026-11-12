import { describe, expect, it } from "vitest";

import {
  addQuantities,
  convert,
  formatQuantity,
  scaleQuantity,
  simplify,
  type UnitDef,
} from "../src/units/index.ts";

const g: UnitDef = { code: "g", dimension: "MASS", toBase: 1, metric: true };
const kg: UnitDef = { code: "kg", dimension: "MASS", toBase: 1000, metric: true };
const ml: UnitDef = { code: "ml", dimension: "VOLUME", toBase: 1, metric: true };
const cl: UnitDef = { code: "cl", dimension: "VOLUME", toBase: 10, metric: true };
const l: UnitDef = { code: "l", dimension: "VOLUME", toBase: 1000, metric: true };
const tbsp: UnitDef = { code: "tbsp", dimension: "VOLUME", toBase: 15, metric: false };
const piece: UnitDef = { code: "piece", dimension: "COUNT", toBase: null, metric: false };
const units = [g, kg, ml, cl, l, tbsp, piece];

describe("convert", () => {
  it("convertit dans une meme dimension", () => {
    expect(convert(1.5, kg, g)).toBe(1500);
    expect(convert(2, tbsp, ml)).toBe(30);
    expect(convert(250, ml, l)).toBe(0.25);
  });

  it("refuse entre dimensions ou sans facteur", () => {
    expect(convert(1, g, ml)).toBeNull();
    expect(convert(2, piece, piece)).toBe(2);
    expect(convert(2, piece, g)).toBeNull();
  });
});

describe("scaleQuantity", () => {
  it("met a l'echelle selon les portions", () => {
    expect(scaleQuantity(200, 4, 6)).toBe(300);
    expect(scaleQuantity(1, 3, 1)).toBeCloseTo(1 / 3);
    expect(scaleQuantity(null, 4, 8)).toBeNull();
  });

  it("refuse un rendement nul ou negatif", () => {
    expect(() => scaleQuantity(1, 0, 2)).toThrow();
  });
});

describe("simplify", () => {
  it("choisit l'unite metrique la plus lisible", () => {
    expect(simplify(1500, g, units)).toEqual({ quantity: 1.5, unit: kg });
    expect(simplify(0.5, kg, units)).toEqual({ quantity: 500, unit: g });
    expect(simplify(150, cl, units)).toEqual({ quantity: 1.5, unit: l });
    expect(simplify(30, ml, units)).toEqual({ quantity: 3, unit: cl });
  });

  it("ne touche pas aux unites de cuisine ni aux pieces", () => {
    expect(simplify(8, tbsp, units)).toEqual({ quantity: 8, unit: tbsp });
    expect(simplify(12, piece, units)).toEqual({ quantity: 12, unit: piece });
  });
});

describe("formatQuantity", () => {
  it("a la francaise : virgule, deux decimales au plus, milliers espaces", () => {
    expect(formatQuantity(1.5)).toBe("1,5");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1 / 3)).toBe("0,33");
    expect(formatQuantity(1250)).toBe("1 250");
  });

  it("fractions usuelles pour les petites quantites de cuisine", () => {
    expect(formatQuantity(0.5, { fractions: true })).toBe("½");
    expect(formatQuantity(1.25, { fractions: true })).toBe("1 ¼");
    expect(formatQuantity(2 / 3, { fractions: true })).toBe("⅔");
    expect(formatQuantity(1.4, { fractions: true })).toBe("1,4");
  });
});

describe("normalizeName", () => {
  it("minuscules, sans accents ni espaces superflus", async () => {
    const { normalizeName } = await import("../src/units/index.ts");
    expect(normalizeName("  Crème   FRAÎCHE ")).toBe("creme fraiche");
    expect(normalizeName("Œuf")).toBe("oeuf");
    expect(normalizeName("Pâte à pizza")).toBe("pate a pizza");
  });
});

describe("addQuantities (liste de courses, testeur A06)", () => {
  const clove: UnitDef = { code: "clove", dimension: "COUNT", toBase: null, metric: false };
  const pinch: UnitDef = { code: "pinch", dimension: "NONE", toBase: null, metric: false };
  const all = [...units, clove, pinch];

  it("additionne dans une dimension par l'unite de base, puis simplifie", () => {
    expect(
      addQuantities(
        [
          { quantity: 3, unit: tbsp },
          { quantity: 20, unit: ml },
        ],
        all
      )
    ).toEqual([{ quantity: 6.5, unit: cl }]);
    expect(
      addQuantities(
        [
          { quantity: 800, unit: g },
          { quantity: 0.5, unit: kg },
        ],
        all
      )
    ).toEqual([{ quantity: 1.3, unit: kg }]);
  });

  it("passe les pieces en grammes avec le poids de l'ingredient", () => {
    expect(
      addQuantities(
        [
          { quantity: 2, unit: piece },
          { quantity: 200, unit: g },
        ],
        all,
        { piece: 15 }
      )
    ).toEqual([{ quantity: 230, unit: g }]);
  });

  it("sans poids connu, garde une ligne par unite", () => {
    expect(
      addQuantities(
        [
          { quantity: 2, unit: piece },
          { quantity: 200, unit: g },
          { quantity: 1, unit: piece },
          { quantity: 3, unit: clove },
        ],
        all
      )
    ).toEqual([
      { quantity: 200, unit: g },
      { quantity: 3, unit: piece },
      { quantity: 3, unit: clove },
    ]);
  });

  it("garde une ligne sans quantite pour les unites sans quantite", () => {
    expect(
      addQuantities(
        [
          { quantity: null, unit: pinch },
          { quantity: null, unit: pinch },
          { quantity: 10, unit: g },
        ],
        all
      )
    ).toEqual([
      { quantity: 10, unit: g },
      { quantity: null, unit: pinch },
    ]);
  });
});

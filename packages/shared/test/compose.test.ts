import { describe, expect, it } from "vitest";

import { checkComposition, linkFactor, MAX_RECIPE_LEVELS } from "../src/recipes/index.ts";
import type { UnitDef } from "../src/units/index.ts";

const ml: UnitDef = { code: "ml", dimension: "VOLUME", toBase: 1, metric: true };
const cl: UnitDef = { code: "cl", dimension: "VOLUME", toBase: 10, metric: true };
const g: UnitDef = { code: "g", dimension: "MASS", toBase: 1, metric: true };

describe("linkFactor", () => {
  it("part utilisee de la sous-recette, dans son unite de rendement", () => {
    expect(linkFactor({ quantity: 150, unit: ml }, { yieldQuantity: 300, yieldUnit: ml })).toBe(
      0.5
    );
  });

  it("convertit quand le rendement a change d'unite dans la meme dimension", () => {
    expect(linkFactor({ quantity: 15, unit: cl }, { yieldQuantity: 300, yieldUnit: ml })).toBe(0.5);
  });

  it("portions, ou unites incompatibles : rapport direct des quantites", () => {
    expect(linkFactor({ quantity: 2, unit: null }, { yieldQuantity: 4, yieldUnit: null })).toBe(
      0.5
    );
    expect(linkFactor({ quantity: 100, unit: g }, { yieldQuantity: 200, yieldUnit: ml })).toBe(0.5);
  });
});

/** Graphe existant : recette -> recettes liees. */
function graph(edges: Record<string, string[]>) {
  const childrenOf = new Map(Object.entries(edges));
  const parentsOf = new Map<string, string[]>();
  for (const [parent, children] of Object.entries(edges)) {
    for (const child of children) parentsOf.set(child, [...(parentsOf.get(child) ?? []), parent]);
  }
  return { childrenOf, parentsOf };
}

describe("checkComposition (D24)", () => {
  it("3 niveaux au plus", () => {
    expect(MAX_RECIPE_LEVELS).toBe(3);
  });

  it("accepte une recette simple et des liens jusqu'a 3 niveaux", () => {
    const g1 = graph({ sauce: ["fond"] });
    expect(checkComposition("plat", [], g1)).toBeNull();
    expect(checkComposition("plat", ["sauce"], g1)).toBeNull();
  });

  it("refuse un lien vers elle-meme ou une boucle par une chaine", () => {
    expect(checkComposition("plat", ["plat"], graph({}))).toBe("CYCLE");
    expect(checkComposition("plat", ["sauce"], graph({ sauce: ["fond"], fond: ["plat"] }))).toBe(
      "CYCLE"
    );
  });

  it("refuse plus de 3 niveaux sous la recette", () => {
    expect(checkComposition("plat", ["sauce"], graph({ sauce: ["fond"], fond: ["os"] }))).toBe(
      "DEPTH"
    );
  });

  it("compte aussi les recettes qui utilisent deja celle-ci", () => {
    // menu -> plat ; plat lie maintenant sauce -> fond : 4 niveaux.
    const g1 = graph({ menu: ["plat"], sauce: ["fond"] });
    expect(checkComposition("plat", ["sauce"], g1)).toBe("DEPTH");
    expect(checkComposition("plat", ["fond"], g1)).toBeNull();
  });

  it("juge les nouveaux liens, pas les anciens", () => {
    const g1 = graph({ plat: ["sauce"], sauce: ["fond"], fond: ["os"] });
    expect(checkComposition("plat", ["fond"], g1)).toBeNull();
    expect(checkComposition("plat", ["sauce"], g1)).toBe("DEPTH");
  });
});

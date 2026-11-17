// Quantites affichees : unite au pluriel quand elle n'a pas d'abreviation propre.
import { describe, expect, it } from "vitest";

import { UNITS, unitId } from "../../test/fixtures.ts";
import { byline, formatYield, linkedAmount, scaledAmount } from "./format.ts";

const line = (quantity: number | null, code: string) => ({ quantity, unitId: unitId(code) });
const unit = (code: string) => UNITS.find((u) => u.code === code);

describe("scaledAmount", () => {
  it("met au pluriel une unite sans abreviation a partir de 2", () => {
    expect(scaledAmount(line(3, "piece"), UNITS, 1)).toBe("3 pièces");
    expect(scaledAmount(line(1, "piece"), UNITS, 1)).toBe("1 pièce");
    expect(scaledAmount(line(1, "piece"), UNITS, 1.5)).toBe("1 ½ pièce");
    expect(scaledAmount(line(1, "piece"), UNITS, 2)).toBe("2 pièces");
  });

  it("garde l'abreviation des autres unites", () => {
    expect(scaledAmount(line(2, "tbsp"), UNITS, 1)).toBe("2 c. à soupe");
    expect(scaledAmount(line(300, "g"), UNITS, 1)).toBe("300 g");
  });

  it("arrondit une quantite metrique mise a l'echelle, pas la quantite saisie (R4)", () => {
    expect(scaledAmount(line(250, "ml"), UNITS, 4 / 3)).toBe("333 ml");
    expect(scaledAmount(line(25, "ml"), UNITS, 2 / 3)).toBe("17 ml");
    expect(scaledAmount(line(2, "g"), UNITS, 2 / 3)).toBe("1,3 g");
    expect(scaledAmount(line(12.5, "g"), UNITS, 1)).toBe("12,5 g");
  });

  it("montre la quantite d'une unite sans dimension quand elle en a une", () => {
    expect(scaledAmount(line(1, "pinch"), UNITS, 1)).toBe("1 pincée");
    expect(scaledAmount(line(1, "pinch"), UNITS, 2)).toBe("2 pincées");
    expect(scaledAmount(line(null, "to-taste"), UNITS, 2)).toBe("à goût");
  });
});

describe("formatYield", () => {
  it("met aussi le rendement au pluriel", () => {
    expect(formatYield(6, unit("piece"))).toBe("6 pièces");
    expect(formatYield(4, undefined)).toBe("4 pers.");
  });
});

describe("byline [R2]", () => {
  it("cite l'espace quand il differe de l'auteur", () => {
    expect(byline("lea", "Foyer")).toBe("par lea · Foyer");
  });

  it("ne repete pas l'espace perso, nomme comme son auteur", () => {
    expect(byline("lea", "lea")).toBe("par lea");
    expect(byline("Lea", "lea")).toBe("par Lea");
  });

  it("sans espace, seulement l'auteur", () => {
    expect(byline("lea", null)).toBe("par lea");
  });
});

describe("linkedAmount [R5]", () => {
  it("sans unite : des portions de la sous-recette, dans son unite de rendement", () => {
    expect(linkedAmount(line(8, "piece"), null, UNITS, 1)).toBe("8 pièces");
    expect(linkedAmount({ quantity: 8, unitId: null }, null, UNITS, 1)).toBe("8 pers.");
    expect(linkedAmount({ quantity: 8, unitId: null }, unitId("piece"), UNITS, 0.5)).toBe(
      "4 pièces"
    );
  });

  it("avec une unite : comme une ligne d'ingredient", () => {
    expect(linkedAmount(line(300, "ml"), unitId("piece"), UNITS, 1)).toBe("300 ml");
  });
});

// Quantites affichees : unite au pluriel quand elle n'a pas d'abreviation propre.
import { describe, expect, it } from "vitest";

import { UNITS, unitId } from "../../test/fixtures.ts";
import { formatYield, scaledAmount } from "./format.ts";

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

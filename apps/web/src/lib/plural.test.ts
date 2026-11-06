import { describe, expect, it } from "vitest";

import { plural } from "./plural.ts";

describe("plural", () => {
  it("accorde le nom a partir de 2 (regle francaise : 0 et 1 au singulier)", () => {
    expect(plural(0, "membre", "membres")).toBe("0 membre");
    expect(plural(1, "membre", "membres")).toBe("1 membre");
    expect(plural(2, "membre", "membres")).toBe("2 membres");
  });
});

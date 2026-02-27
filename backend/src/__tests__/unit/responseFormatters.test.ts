import { describe, it, expect } from "vitest";
import { formatTags, formatIngredients, formatSteps } from "../../util/responseFormatters";

describe("formatTags", () => {
  it("should extract tags from pivot format", () => {
    const raw = [
      { tag: { id: "t1", name: "dessert", scope: "GLOBAL", status: "APPROVED", communityId: null } },
      { tag: { id: "t2", name: "vegan", scope: "COMMUNITY", status: "PENDING", communityId: "c1" } },
    ];
    expect(formatTags(raw)).toEqual([
      { id: "t1", name: "dessert", scope: "GLOBAL", status: "APPROVED", communityId: null },
      { id: "t2", name: "vegan", scope: "COMMUNITY", status: "PENDING", communityId: "c1" },
    ]);
  });

  it("should return empty array for empty input", () => {
    expect(formatTags([])).toEqual([]);
  });
});

describe("formatIngredients", () => {
  it("should map pivot format to flat format", () => {
    const raw = [
      {
        id: "ri1",
        quantity: 100,
        order: 0,
        ingredient: { id: "i1", name: "sugar" },
      },
      {
        id: "ri2",
        quantity: 200,
        order: 1,
        ingredient: { id: "i2", name: "milk" },
      },
    ];

    expect(formatIngredients(raw)).toEqual([
      { id: "ri1", name: "sugar", ingredientId: "i1", quantity: 100, order: 0 },
      { id: "ri2", name: "milk", ingredientId: "i2", quantity: 200, order: 1 },
    ]);
  });

  it("should handle null quantity", () => {
    const raw = [
      {
        id: "ri1",
        quantity: null,
        order: 0,
        ingredient: { id: "i1", name: "salt" },
      },
    ];

    const result = formatIngredients(raw);
    expect(result[0].quantity).toBeNull();
  });

  it("should return empty array for empty input", () => {
    expect(formatIngredients([])).toEqual([]);
  });
});

describe("formatSteps", () => {
  it("should map step fields correctly", () => {
    const raw = [
      { id: "s1", order: 0, instruction: "Preparer les ingredients" },
      { id: "s2", order: 1, instruction: "Melanger et cuire" },
    ];

    expect(formatSteps(raw)).toEqual([
      { id: "s1", order: 0, instruction: "Preparer les ingredients" },
      { id: "s2", order: 1, instruction: "Melanger et cuire" },
    ]);
  });

  it("should return empty array for empty input", () => {
    expect(formatSteps([])).toEqual([]);
  });
});

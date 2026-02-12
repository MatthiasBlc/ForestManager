import { describe, it, expect } from "vitest";
import { formatTags, formatIngredients } from "../../util/responseFormatters";

describe("formatTags", () => {
  it("should extract tags from pivot format", () => {
    const raw = [
      { tag: { id: "t1", name: "dessert" } },
      { tag: { id: "t2", name: "vegan" } },
    ];
    expect(formatTags(raw)).toEqual([
      { id: "t1", name: "dessert" },
      { id: "t2", name: "vegan" },
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
        quantity: "100g",
        order: 0,
        ingredient: { id: "i1", name: "sugar" },
      },
      {
        id: "ri2",
        quantity: "200ml",
        order: 1,
        ingredient: { id: "i2", name: "milk" },
      },
    ];

    expect(formatIngredients(raw)).toEqual([
      { id: "ri1", name: "sugar", ingredientId: "i1", quantity: "100g", order: 0 },
      { id: "ri2", name: "milk", ingredientId: "i2", quantity: "200ml", order: 1 },
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

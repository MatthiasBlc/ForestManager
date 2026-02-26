import { describe, it, expect } from "vitest";
import { scaleQuantity } from "../../../utils/scaleQuantity";

describe("scaleQuantity", () => {
  it("should return null when baseQty is null", () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull();
  });

  it("should return same quantity when servings unchanged", () => {
    expect(scaleQuantity(100, 4, 4)).toBe(100);
  });

  it("should scale up proportionally", () => {
    expect(scaleQuantity(100, 4, 8)).toBe(200);
    expect(scaleQuantity(50, 2, 6)).toBe(150);
  });

  it("should scale down proportionally", () => {
    expect(scaleQuantity(100, 4, 2)).toBe(50);
    expect(scaleQuantity(300, 6, 2)).toBe(100);
  });

  it("should round to 2 decimal places", () => {
    expect(scaleQuantity(100, 3, 7)).toBe(233.33);
    expect(scaleQuantity(10, 3, 1)).toBe(3.33);
  });

  it("should strip trailing zeros", () => {
    expect(scaleQuantity(100, 4, 8)).toBe(200);
    expect(scaleQuantity(1, 2, 4)).toBe(2);
  });

  it("should handle quantity of 0", () => {
    expect(scaleQuantity(0, 4, 8)).toBe(0);
  });

  it("should handle single serving base", () => {
    expect(scaleQuantity(50, 1, 4)).toBe(200);
  });
});

import { describe, it, expect } from "vitest";
import { formatDate, formatDateShort } from "../../../utils/format.Date";

describe("formatDate", () => {
  it("should format a date string with month, day, year, hour and minute", () => {
    const result = formatDate("2024-06-15T14:30:00Z");
    // Output depends on locale but should contain key parts
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("should handle ISO date strings", () => {
    const result = formatDate("2023-01-01T00:00:00.000Z");
    expect(result).toContain("Jan");
    expect(result).toContain("2023");
  });

  it("should return a string", () => {
    expect(typeof formatDate("2024-01-01T00:00:00Z")).toBe("string");
  });
});

describe("formatDateShort", () => {
  it("should format with month and day only", () => {
    const result = formatDateShort("2024-06-15T14:30:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    // Should not contain year
    expect(result).not.toContain("2024");
  });

  it("should return a string", () => {
    expect(typeof formatDateShort("2024-12-25T00:00:00Z")).toBe("string");
  });
});

import { describe, it, expect } from "vitest";
import {
  normalizeNames,
  isValidHttpUrl,
  EMAIL_REGEX,
  USERNAME_REGEX,
  COMMUNITY_VALIDATION,
  validateServings,
  validateTime,
  validateSteps,
} from "../../util/validation";

describe("normalizeNames", () => {
  it("should trim and lowercase items", () => {
    expect(normalizeNames(["  Hello ", " WORLD "])).toEqual(["hello", "world"]);
  });

  it("should deduplicate items", () => {
    expect(normalizeNames(["apple", "Apple", "APPLE"])).toEqual(["apple"]);
  });

  it("should filter empty strings", () => {
    expect(normalizeNames(["valid", "", "  ", "ok"])).toEqual(["valid", "ok"]);
  });

  it("should return empty array for empty input", () => {
    expect(normalizeNames([])).toEqual([]);
  });

  it("should handle mixed case duplicates with whitespace", () => {
    expect(normalizeNames(["  Tag ", "tag", " TAG"])).toEqual(["tag"]);
  });
});

describe("isValidHttpUrl", () => {
  it("should return true for http URLs", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });

  it("should return true for https URLs", () => {
    expect(isValidHttpUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("should return false for ftp URLs", () => {
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
  });

  it("should return false for javascript: URLs", () => {
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("should return true for null (optional field)", () => {
    expect(isValidHttpUrl(null)).toBe(true);
  });

  it("should return true for undefined (optional field)", () => {
    expect(isValidHttpUrl(undefined)).toBe(true);
  });

  it("should return false for invalid strings", () => {
    expect(isValidHttpUrl("not-a-url")).toBe(false);
  });
});

describe("Validation constants", () => {
  it("EMAIL_REGEX should match valid emails", () => {
    expect(EMAIL_REGEX.test("user@example.com")).toBe(true);
  });

  it("EMAIL_REGEX should reject invalid emails", () => {
    expect(EMAIL_REGEX.test("not-an-email")).toBe(false);
  });

  it("USERNAME_REGEX should match alphanumeric + underscore", () => {
    expect(USERNAME_REGEX.test("user_123")).toBe(true);
  });

  it("USERNAME_REGEX should reject special characters", () => {
    expect(USERNAME_REGEX.test("user@name")).toBe(false);
  });

  it("COMMUNITY_VALIDATION should have expected values", () => {
    expect(COMMUNITY_VALIDATION.NAME_MIN).toBe(3);
    expect(COMMUNITY_VALIDATION.NAME_MAX).toBe(100);
    expect(COMMUNITY_VALIDATION.DESCRIPTION_MAX).toBe(1000);
  });
});

describe("validateServings", () => {
  it("should accept valid servings (1-100)", () => {
    expect(validateServings(1)).toBe(true);
    expect(validateServings(4)).toBe(true);
    expect(validateServings(100)).toBe(true);
  });

  it("should reject 0", () => {
    expect(validateServings(0)).toBe(false);
  });

  it("should reject negative values", () => {
    expect(validateServings(-1)).toBe(false);
  });

  it("should reject values above 100", () => {
    expect(validateServings(101)).toBe(false);
  });

  it("should reject non-integer values", () => {
    expect(validateServings(3.5)).toBe(false);
  });

  it("should reject null/undefined/string", () => {
    expect(validateServings(null)).toBe(false);
    expect(validateServings(undefined)).toBe(false);
    expect(validateServings("4")).toBe(false);
  });
});

describe("validateTime", () => {
  it("should accept null and undefined (optional)", () => {
    expect(validateTime(null)).toBe(true);
    expect(validateTime(undefined)).toBe(true);
  });

  it("should accept 0", () => {
    expect(validateTime(0)).toBe(true);
  });

  it("should accept valid times", () => {
    expect(validateTime(45)).toBe(true);
    expect(validateTime(10000)).toBe(true);
  });

  it("should reject negative values", () => {
    expect(validateTime(-1)).toBe(false);
  });

  it("should reject values above 10000", () => {
    expect(validateTime(10001)).toBe(false);
  });

  it("should reject non-integer values", () => {
    expect(validateTime(3.5)).toBe(false);
  });

  it("should reject strings", () => {
    expect(validateTime("10" as unknown)).toBe(false);
  });
});

describe("validateSteps", () => {
  it("should accept valid steps", () => {
    expect(validateSteps([{ instruction: "Step 1" }])).toBe(true);
    expect(validateSteps([{ instruction: "Step 1" }, { instruction: "Step 2" }])).toBe(true);
  });

  it("should reject empty array", () => {
    expect(validateSteps([])).toBe(false);
  });

  it("should reject non-array", () => {
    expect(validateSteps(null)).toBe(false);
    expect(validateSteps(undefined)).toBe(false);
    expect(validateSteps("step")).toBe(false);
  });

  it("should reject steps with empty instruction", () => {
    expect(validateSteps([{ instruction: "" }])).toBe(false);
    expect(validateSteps([{ instruction: "   " }])).toBe(false);
  });

  it("should reject steps without instruction field", () => {
    expect(validateSteps([{ text: "Step" }])).toBe(false);
    expect(validateSteps([{}])).toBe(false);
  });

  it("should reject steps with instruction exceeding 5000 chars", () => {
    const longInstruction = "a".repeat(5001);
    expect(validateSteps([{ instruction: longInstruction }])).toBe(false);
  });

  it("should accept steps with instruction at 5000 chars", () => {
    const maxInstruction = "a".repeat(5000);
    expect(validateSteps([{ instruction: maxInstruction }])).toBe(true);
  });
});

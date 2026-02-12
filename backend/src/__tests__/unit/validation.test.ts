import { describe, it, expect } from "vitest";
import {
  normalizeNames,
  isValidHttpUrl,
  EMAIL_REGEX,
  USERNAME_REGEX,
  COMMUNITY_VALIDATION,
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

import { describe, it, expect } from "vitest";
import { parsePagination, buildPaginationMeta } from "../../util/pagination";

describe("parsePagination", () => {
  it("should return defaults when no params provided", () => {
    const result = parsePagination({});
    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  it("should parse custom limit and offset", () => {
    const result = parsePagination({ limit: "10", offset: "30" });
    expect(result).toEqual({ limit: 10, offset: 30 });
  });

  it("should clamp limit to minimum 1", () => {
    const result = parsePagination({ limit: "0" });
    expect(result.limit).toBe(1);
  });

  it("should clamp limit to maxLimit", () => {
    const result = parsePagination({ limit: "999" });
    expect(result.limit).toBe(100);
  });

  it("should use custom defaultLimit", () => {
    const result = parsePagination({}, 50);
    expect(result.limit).toBe(50);
  });

  it("should use custom maxLimit", () => {
    const result = parsePagination({ limit: "200" }, 20, 150);
    expect(result.limit).toBe(150);
  });

  it("should handle NaN limit", () => {
    const result = parsePagination({ limit: "abc" });
    // parseInt("abc") = NaN, Math.max/min with NaN yields NaN
    expect(result.limit).toBeNaN();
  });

  it("should handle NaN offset", () => {
    const result = parsePagination({ offset: "abc" });
    expect(result.offset).toBeNaN();
  });

  it("should clamp negative offset to 0", () => {
    const result = parsePagination({ offset: "-5" });
    expect(result.offset).toBe(0);
  });

  it("should handle negative limit by clamping to 1", () => {
    const result = parsePagination({ limit: "-10" });
    expect(result.limit).toBe(1);
  });
});

describe("buildPaginationMeta", () => {
  it("should set hasMore to true when more items exist", () => {
    const result = buildPaginationMeta(50, 20, 0, 20);
    expect(result).toEqual({
      total: 50,
      limit: 20,
      offset: 0,
      hasMore: true,
    });
  });

  it("should set hasMore to false when no more items", () => {
    const result = buildPaginationMeta(20, 20, 0, 20);
    expect(result).toEqual({
      total: 20,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it("should handle boundary case where offset + items equals total", () => {
    const result = buildPaginationMeta(30, 10, 20, 10);
    expect(result.hasMore).toBe(false);
  });

  it("should handle empty results", () => {
    const result = buildPaginationMeta(0, 20, 0, 0);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);
  });
});

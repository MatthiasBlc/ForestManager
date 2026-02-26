import { describe, it, expect } from "vitest";
import { formatDuration } from "../../../utils/formatDuration";

describe("formatDuration", () => {
  it("should format minutes under 60", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(1)).toBe("1 min");
    expect(formatDuration(15)).toBe("15 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(59)).toBe("59 min");
  });

  it("should format exact hours", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(180)).toBe("3h");
  });

  it("should format hours with remaining minutes", () => {
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(75)).toBe("1h15");
    expect(formatDuration(61)).toBe("1h01");
    expect(formatDuration(125)).toBe("2h05");
    expect(formatDuration(150)).toBe("2h30");
  });

  it("should handle large values", () => {
    expect(formatDuration(600)).toBe("10h");
    expect(formatDuration(1440)).toBe("24h");
    expect(formatDuration(1441)).toBe("24h01");
  });
});

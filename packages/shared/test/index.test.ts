import { describe, expect, it } from "vitest";

import { API_PREFIX } from "../src/index.ts";

describe("shared", () => {
  it("expose le prefixe de l'API", () => {
    expect(API_PREFIX).toBe("/api/v1");
  });
});

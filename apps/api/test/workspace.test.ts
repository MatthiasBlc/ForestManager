import { describe, expect, it } from "vitest";

import { API_PREFIX } from "@fm/shared";
import { NOT_FOUND_UUID } from "@fm/test-utils";

// Verifie que les alias de workspace se resolvent depuis l'API.
describe("workspace", () => {
  it("resout @fm/shared et @fm/test-utils", () => {
    expect(API_PREFIX).toBe("/api/v1");
    expect(NOT_FOUND_UUID).toMatch(/^[0-9a-f-]{36}$/);
  });
});

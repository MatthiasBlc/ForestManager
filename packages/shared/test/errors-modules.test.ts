import { describe, expect, it } from "vitest";

import {
  apiErrorSchema,
  ERROR_CODES,
  ERRORS,
  errorBody,
  isErrorCode,
} from "../src/errors/index.ts";
import { validateModuleDefinitions } from "../src/modules/index.ts";

describe("errors", () => {
  it("chaque code a un prefixe de domaine, un statut HTTP, un message et sa cle i18n", () => {
    for (const code of ERROR_CODES) {
      const info = ERRORS[code];
      expect(code).toMatch(/^(AUTH|SPACE|MODULE|RECIPE|STORAGE|VALIDATION|COMMON)_\d{3}$/);
      expect(info.status).toBeGreaterThanOrEqual(400);
      expect(info.status).toBeLessThan(600);
      expect(info.message.length).toBeGreaterThan(0);
      expect(info.i18nKey).toBe(`errors.${code}`);
    }
  });

  it("construit le corps d'erreur unique", () => {
    expect(errorBody("SPACE_001")).toEqual({
      error: { code: "SPACE_001", message: ERRORS.SPACE_001.message },
    });
    const withDetails = errorBody("VALIDATION_001", [{ path: "name" }]);
    expect(apiErrorSchema.parse(withDetails)).toEqual(withDetails);
  });

  it("reconnait les codes connus seulement", () => {
    expect(isErrorCode("AUTH_001")).toBe(true);
    expect(isErrorCode("AUTH_999")).toBe(false);
    expect(isErrorCode("toString")).toBe(false);
  });
});

describe("validateModuleDefinitions", () => {
  const recipes = {
    code: "recipes",
    permissions: { "recipes.create": { minRole: "MEMBER" } },
  } as const;

  it("accepte des modules corrects", () => {
    expect(
      validateModuleDefinitions([
        recipes,
        {
          code: "meal-plan",
          permissions: { "meal-plan.edit": { minRole: "MEMBER", configurable: true } },
          notificationTypes: ["meal-plan.edit"],
        },
      ])
    ).toEqual([]);
  });

  it("signale codes invalides, doublons, prefixes et collisions", () => {
    const problems = validateModuleDefinitions([
      recipes,
      recipes,
      { code: "Bad Code", permissions: {} },
      { code: "shopping", permissions: { "recipes.view": { minRole: "MEMBER" } } },
      { code: "space", permissions: { "space.view": { minRole: "MEMBER" } } },
    ]);
    expect(problems).toEqual([
      'duplicate module code "recipes"',
      'duplicate permissions key "recipes.create"',
      'invalid module code "Bad Code"',
      'permissions key "recipes.view" of module "shopping" must start with "shopping."',
      'duplicate permissions key "space.view"',
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  AUDIT_CATEGORIES,
  adminLoginBodySchema,
  adminTotpBodySchema,
  auditCategory,
} from "../src/schemas/admin.ts";

describe("categories du journal d'audit [D128]", () => {
  it("se deduisent du prefixe de l'action", () => {
    expect(auditCategory("auth.login")).toBe("CONNECTIONS");
    expect(auditCategory("module.granted")).toBe("MODULES");
    expect(auditCategory("module-request.refused")).toBe("MODULES");
    expect(auditCategory("ingredient.merged")).toBe("REFERENTIALS");
    expect(auditCategory("unit.updated")).toBe("REFERENTIALS");
    expect(auditCategory("aisle.created")).toBe("REFERENTIALS");
    expect(auditCategory("tag.deleted")).toBe("REFERENTIALS");
    expect(auditCategory("user.password-reset")).toBe("ACCOUNTS");
    expect(auditCategory("moderation.opened")).toBe("MODERATION");
    expect(auditCategory("release.published")).toBe("RELEASES");
  });

  it("chaque categorie a au moins un prefixe, une action inconnue est refusee", () => {
    for (const category of AUDIT_CATEGORIES) {
      expect(Object.values(AUDIT_PREFIX_SAMPLE).includes(category)).toBe(true);
    }
    expect(() => auditCategory("nope.action")).toThrow();
  });
});

const AUDIT_PREFIX_SAMPLE = {
  auth: "CONNECTIONS",
  module: "MODULES",
  ingredient: "REFERENTIALS",
  user: "ACCOUNTS",
  moderation: "MODERATION",
  release: "RELEASES",
} as const;

describe("schemas de connexion admin", () => {
  it("le code TOTP fait 6 chiffres, espaces toleres", () => {
    expect(adminTotpBodySchema.parse({ code: "123 456" })).toEqual({ code: "123456" });
    expect(adminTotpBodySchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(adminTotpBodySchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });

  it("la connexion demande un identifiant et un mot de passe, sans champ inconnu", () => {
    expect(adminLoginBodySchema.safeParse({ identifier: "root", password: "x" }).success).toBe(
      true
    );
    expect(
      adminLoginBodySchema.safeParse({ identifier: "root", password: "x", rememberMe: true })
        .success
    ).toBe(false);
  });
});

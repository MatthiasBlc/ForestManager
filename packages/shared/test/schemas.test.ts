import { describe, expect, it } from "vitest";

import {
  createInviteLinkBodySchema,
  createSpaceBodySchema,
  cursorQuerySchema,
  hasMinRole,
  loginBodySchema,
  registerBodySchema,
  reorderModulesBodySchema,
  updatePreferencesBodySchema,
  updateProfileBodySchema,
  updateSpaceBodySchema,
} from "../src/schemas/index.ts";

const valid = { email: " Alice@Example.COM ", username: "alice_1", password: "correct-horse" };

describe("auth", () => {
  it("normalise l'email et accepte une inscription valide", () => {
    expect(registerBodySchema.parse(valid)).toEqual({ ...valid, email: "alice@example.com" });
  });

  it.each([
    ["mot de passe trop court", { ...valid, password: "123456789" }],
    ["mot de passe trop long", { ...valid, password: "x".repeat(129) }],
    ["username invalide", { ...valid, username: "al ice" }],
    ["username trop court", { ...valid, username: "al" }],
    ["email invalide", { ...valid, email: "alice" }],
    ["champ inconnu", { ...valid, role: "OWNER" }],
  ])("refuse : %s", (_label, body) => {
    expect(registerBodySchema.safeParse(body).success).toBe(false);
  });

  it("rester connecte vaut faux par defaut", () => {
    expect(loginBodySchema.parse({ identifier: "alice", password: "x" }).rememberMe).toBe(false);
  });

  it("exige le mot de passe actuel pour changer l'email", () => {
    expect(updateProfileBodySchema.safeParse({ email: "a@b.fr" }).success).toBe(false);
    expect(
      updateProfileBodySchema.safeParse({ email: "a@b.fr", currentPassword: "x" }).success
    ).toBe(true);
    expect(updateProfileBodySchema.safeParse({}).success).toBe(false);
  });

  it("valide les preferences partielles", () => {
    expect(updatePreferencesBodySchema.parse({ textScale: 115 })).toEqual({ textScale: 115 });
    expect(updatePreferencesBodySchema.safeParse({ textScale: 110 }).success).toBe(false);
    expect(updatePreferencesBodySchema.safeParse({}).success).toBe(false);
    expect(updatePreferencesBodySchema.safeParse({ theme: "x" }).success).toBe(false);
  });
});

describe("espaces", () => {
  it("applique la teinte par defaut et borne le nom", () => {
    expect(createSpaceBodySchema.parse({ name: "  Famille  " })).toEqual({
      name: "Famille",
      tintIndex: 1,
    });
    expect(createSpaceBodySchema.safeParse({ name: "ab" }).success).toBe(false);
    expect(createSpaceBodySchema.safeParse({ name: "Famille", tintIndex: 6 }).success).toBe(false);
  });

  it("refuse une modification vide et accepte d'effacer la description", () => {
    expect(updateSpaceBodySchema.safeParse({}).success).toBe(false);
    expect(updateSpaceBodySchema.parse({ description: null })).toEqual({ description: null });
  });

  it("n'accepte que les durees de lien 1, 7 ou 30 jours", () => {
    expect(createInviteLinkBodySchema.safeParse({ expiresInDays: 7, maxUses: null }).success).toBe(
      true
    );
    expect(createInviteLinkBodySchema.safeParse({ expiresInDays: 3, maxUses: null }).success).toBe(
      false
    );
    expect(createInviteLinkBodySchema.safeParse({ expiresInDays: 7, maxUses: 0 }).success).toBe(
      false
    );
  });
});

describe("communs", () => {
  it("convertit et borne la pagination", () => {
    expect(cursorQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10 });
    expect(cursorQuerySchema.parse({})).toEqual({ limit: 30 });
    expect(cursorQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });

  it("compare les roles", () => {
    expect(hasMinRole("OWNER", "MODERATOR")).toBe(true);
    expect(hasMinRole("MEMBER", "MODERATOR")).toBe(false);
  });

  it("refuse les doublons dans l'ordre des modules", () => {
    expect(reorderModulesBodySchema.safeParse({ codes: ["recipes", "recipes"] }).success).toBe(
      false
    );
  });
});

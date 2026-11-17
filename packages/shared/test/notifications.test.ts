import { describe, expect, it } from "vitest";

import {
  CORE_ACTIVITY_TYPES,
  CORE_NOTIFICATION_CATEGORIES,
  CORE_NOTIFICATION_TYPES,
  notificationCatalog,
  notificationPreferencesSchema,
  notificationSchema,
  updateSpaceNotificationPreferencesBodySchema,
} from "../src/notifications/index.ts";

const modules = [
  {
    code: "recipes",
    permissions: {},
    notificationCategories: { "recipes.sharing": {}, "recipes.new": { defaultEnabled: false } },
    notificationTypes: {
      "recipes.suggestion.created": { category: "recipes.sharing" },
      "recipes.recipe.created": { category: "recipes.new" },
    },
    activityTypes: ["recipes.recipe.created"],
  },
] as const;

describe("catalogue des notifications (F-NOT-3, D41)", () => {
  it("le socle declare ses categories et ses types, prefixes par core.", () => {
    for (const key of [
      ...Object.keys(CORE_NOTIFICATION_CATEGORIES),
      ...Object.keys(CORE_NOTIFICATION_TYPES),
      ...CORE_ACTIVITY_TYPES,
    ]) {
      expect(key).toMatch(/^core\.[a-z.-]+$/);
    }
    for (const { category } of Object.values(CORE_NOTIFICATION_TYPES)) {
      expect(Object.keys(CORE_NOTIFICATION_CATEGORIES)).toContain(category);
    }
    // Les avis de la plateforme (moderation, decision sur un module) ne se coupent pas [D121].
    expect(CORE_NOTIFICATION_CATEGORIES["core.platform"].mandatory).toBe(true);
  });

  it("fusionne le socle et les modules, avec le module de chaque categorie", () => {
    const catalog = notificationCatalog(modules);
    expect(catalog.typeCategory("recipes.suggestion.created")).toBe("recipes.sharing");
    expect(catalog.typeCategory("core.invitation.received")).toBe("core.members");
    expect(catalog.typeCategory("unknown.type")).toBeNull();
    expect(catalog.category("recipes.new")).toEqual({
      key: "recipes.new",
      moduleCode: "recipes",
      defaultEnabled: false,
      mandatory: false,
      perSpace: true,
    });
    expect(catalog.category("core.members")).toEqual({
      key: "core.members",
      moduleCode: null,
      defaultEnabled: true,
      mandatory: false,
      perSpace: true,
    });
    expect(catalog.category("core.releases")?.perSpace).toBe(false);
    expect(catalog.isActivityType("recipes.recipe.created")).toBe(true);
    expect(catalog.isActivityType("core.member.joined")).toBe(true);
    expect(catalog.isActivityType("recipes.nope")).toBe(false);
    // Categories reglables : socle d'abord, sans les obligatoires, puis les modules.
    expect(catalog.configurable().map((c) => c.key)).toEqual([
      "core.members",
      "core.releases",
      "recipes.sharing",
      "recipes.new",
    ]);
  });

  it("valide une notification et les preferences", () => {
    const notification = {
      id: "3f1c2a54-7a8b-4c1d-9e2f-0a1b2c3d4e5f",
      type: "core.invitation.received",
      category: "core.members",
      space: { id: "4f1c2a54-7a8b-4c1d-9e2f-0a1b2c3d4e5f", name: "Famille", tintIndex: 2 },
      actor: { id: "5f1c2a54-7a8b-4c1d-9e2f-0a1b2c3d4e5f", username: "lea", avatarUrl: null },
      targetType: null,
      targetId: null,
      data: { spaceName: "Famille" },
      count: 1,
      url: null,
      readAt: null,
      createdAt: "2026-11-09T10:00:00.000Z",
    };
    expect(notificationSchema.parse(notification)).toEqual(notification);
    expect(
      notificationPreferencesSchema.parse({
        categories: [{ key: "core.members", moduleCode: null, enabled: true }],
        spaces: [
          {
            spaceId: "4f1c2a54-7a8b-4c1d-9e2f-0a1b2c3d4e5f",
            custom: false,
            categories: [{ key: "core.members", moduleCode: null, enabled: true }],
          },
        ],
      }).categories
    ).toHaveLength(1);
    expect(
      updateSpaceNotificationPreferencesBodySchema.safeParse({ categories: { "core.members": 1 } })
        .success
    ).toBe(false);
  });
});

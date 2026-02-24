import { describe, it, expect, beforeEach } from "vitest";
import { testPrisma } from "../setup/globalSetup";
import {
  getCategoryForType,
  isNotificationEnabled,
  filterByPreference,
  createNotification,
  createBroadcastNotifications,
  resolveTemplateVars,
  getModeratorIdsForTagNotification,
} from "../../services/notificationService";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Helper pour creer un user en DB
async function createUser(suffix: string) {
  return testPrisma.user.create({
    data: {
      username: `user_${suffix}`,
      email: `user_${suffix}@example.com`,
      password: "hashed",
    },
  });
}

// Helper pour creer une communaute en DB
async function createCommunity(suffix: string) {
  return testPrisma.community.create({
    data: { name: `Community ${suffix}` },
  });
}

// =============================================================================
// getCategoryForType
// =============================================================================
describe("getCategoryForType", () => {
  it("should map invitation types to INVITATION", () => {
    expect(getCategoryForType("INVITE_SENT")).toBe("INVITATION");
    expect(getCategoryForType("INVITE_ACCEPTED")).toBe("INVITATION");
    expect(getCategoryForType("INVITE_REJECTED")).toBe("INVITATION");
    expect(getCategoryForType("INVITE_CANCELLED")).toBe("INVITATION");
  });

  it("should map recipe types to RECIPE_PROPOSAL", () => {
    expect(getCategoryForType("VARIANT_PROPOSED")).toBe("RECIPE_PROPOSAL");
    expect(getCategoryForType("PROPOSAL_ACCEPTED")).toBe("RECIPE_PROPOSAL");
    expect(getCategoryForType("RECIPE_CREATED")).toBe("RECIPE_PROPOSAL");
  });

  it("should map tag types to TAG", () => {
    expect(getCategoryForType("TAG_SUGGESTION_CREATED")).toBe("TAG");
    expect(getCategoryForType("tag:approved")).toBe("TAG");
    expect(getCategoryForType("tag-suggestion:pending-mod")).toBe("TAG");
  });

  it("should map ingredient types to INGREDIENT", () => {
    expect(getCategoryForType("INGREDIENT_APPROVED")).toBe("INGREDIENT");
    expect(getCategoryForType("INGREDIENT_REJECTED")).toBe("INGREDIENT");
  });

  it("should map moderation types to MODERATION", () => {
    expect(getCategoryForType("USER_PROMOTED")).toBe("MODERATION");
    expect(getCategoryForType("USER_KICKED")).toBe("MODERATION");
  });

  it("should return null for unknown types", () => {
    expect(getCategoryForType("UNKNOWN_TYPE")).toBeNull();
  });
});

// =============================================================================
// isNotificationEnabled
// =============================================================================
describe("isNotificationEnabled", () => {
  let user: { id: string };

  beforeEach(async () => {
    user = await createUser(uniqueSuffix());
  });

  it("should return true by default (no preference)", async () => {
    const enabled = await isNotificationEnabled(user.id, "TAG", null);
    expect(enabled).toBe(true);
  });

  it("should return false when global preference is disabled", async () => {
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, communityId: null, category: "TAG", enabled: false },
    });

    const enabled = await isNotificationEnabled(user.id, "TAG", null);
    expect(enabled).toBe(false);
  });

  it("should respect community preference over global", async () => {
    const community = await createCommunity(uniqueSuffix());

    // Global disabled
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, communityId: null, category: "TAG", enabled: false },
    });
    // Community enabled
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, communityId: community.id, category: "TAG", enabled: true },
    });

    const enabled = await isNotificationEnabled(user.id, "TAG", community.id);
    expect(enabled).toBe(true);
  });

  it("should fall back to global when no community preference", async () => {
    const community = await createCommunity(uniqueSuffix());

    await testPrisma.notificationPreference.create({
      data: { userId: user.id, communityId: null, category: "INVITATION", enabled: false },
    });

    const enabled = await isNotificationEnabled(user.id, "INVITATION", community.id);
    expect(enabled).toBe(false);
  });
});

// =============================================================================
// filterByPreference
// =============================================================================
describe("filterByPreference", () => {
  it("should return all users when no preferences exist", async () => {
    const u1 = await createUser(uniqueSuffix());
    const u2 = await createUser(uniqueSuffix());

    const result = await filterByPreference([u1.id, u2.id], "TAG", null);
    expect(result).toContain(u1.id);
    expect(result).toContain(u2.id);
  });

  it("should filter out users with disabled preference", async () => {
    const u1 = await createUser(uniqueSuffix());
    const u2 = await createUser(uniqueSuffix());

    await testPrisma.notificationPreference.create({
      data: { userId: u1.id, communityId: null, category: "TAG", enabled: false },
    });

    const result = await filterByPreference([u1.id, u2.id], "TAG", null);
    expect(result).not.toContain(u1.id);
    expect(result).toContain(u2.id);
  });

  it("should return empty array for empty input", async () => {
    const result = await filterByPreference([], "TAG", null);
    expect(result).toEqual([]);
  });
});

// =============================================================================
// createNotification
// =============================================================================
describe("createNotification", () => {
  let user: { id: string };
  let actor: { id: string };
  let community: { id: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();
    user = await createUser(`target_${suffix}`);
    actor = await createUser(`actor_${suffix}`);
    community = await createCommunity(suffix);
  });

  it("should create a notification in DB", async () => {
    const notif = await createNotification({
      userId: user.id,
      type: "INVITE_SENT",
      actorId: actor.id,
      communityId: community.id,
      templateVars: {
        actorName: "alice",
        communityName: "Test Community",
        communityId: community.id,
      },
    });

    expect(notif).not.toBeNull();
    expect(notif!.userId).toBe(user.id);
    expect(notif!.type).toBe("INVITE_SENT");
    expect(notif!.category).toBe("INVITATION");
    expect(notif!.title).toBe("Nouvelle invitation");
    expect(notif!.message).toContain("alice");
    expect(notif!.message).toContain("Test Community");
    expect(notif!.actionUrl).toBe("/invitations");
    expect(notif!.readAt).toBeNull();
  });

  it("should return null for unknown type", async () => {
    const notif = await createNotification({
      userId: user.id,
      type: "UNKNOWN_TYPE",
      actorId: actor.id,
      communityId: null,
      templateVars: {},
    });

    expect(notif).toBeNull();
  });

  it("should return null when preference is disabled", async () => {
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, communityId: null, category: "INVITATION", enabled: false },
    });

    const notif = await createNotification({
      userId: user.id,
      type: "INVITE_ACCEPTED",
      actorId: actor.id,
      communityId: community.id,
      templateVars: {
        actorName: "alice",
        communityName: "Test",
        communityId: community.id,
      },
    });

    expect(notif).toBeNull();
  });

  it("should always create notification for non-disableable types (INVITE_SENT)", async () => {
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, communityId: null, category: "INVITATION", enabled: false },
    });

    const notif = await createNotification({
      userId: user.id,
      type: "INVITE_SENT",
      actorId: actor.id,
      communityId: community.id,
      templateVars: {
        actorName: "alice",
        communityName: "Test",
        communityId: community.id,
      },
    });

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe("INVITE_SENT");
  });

  it("should always create notification for USER_KICKED even if MODERATION disabled", async () => {
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, communityId: null, category: "MODERATION", enabled: false },
    });

    const notif = await createNotification({
      userId: user.id,
      type: "USER_KICKED",
      actorId: actor.id,
      communityId: community.id,
      templateVars: {
        communityName: "Test",
        communityId: community.id,
      },
    });

    expect(notif).not.toBeNull();
  });

  it("should set groupKey for broadcast types", async () => {
    const recipe = await testPrisma.recipe.create({
      data: { title: "Test Recipe", content: "content", creatorId: actor.id },
    });

    const notif = await createNotification({
      userId: user.id,
      type: "RECIPE_CREATED",
      actorId: actor.id,
      communityId: community.id,
      recipeId: recipe.id,
      templateVars: {
        actorName: "alice",
        communityName: "Test",
        communityId: community.id,
        recipeName: "Test Recipe",
        recipeId: recipe.id,
      },
    });

    expect(notif).not.toBeNull();
    expect(notif!.groupKey).toBe(`community:${community.id}:RECIPE_CREATED`);
  });

  it("should store metadata", async () => {
    const notif = await createNotification({
      userId: user.id,
      type: "INGREDIENT_APPROVED",
      actorId: null,
      communityId: null,
      metadata: { ingredientName: "Tomate" },
      templateVars: { ingredientName: "Tomate" },
    });

    expect(notif).not.toBeNull();
    expect(notif!.metadata).toEqual({ ingredientName: "Tomate" });
  });
});

// =============================================================================
// createBroadcastNotifications
// =============================================================================
describe("createBroadcastNotifications", () => {
  let actor: { id: string };
  let member1: { id: string };
  let member2: { id: string };
  let community: { id: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();
    actor = await createUser(`bcast_actor_${suffix}`);
    member1 = await createUser(`bcast_m1_${suffix}`);
    member2 = await createUser(`bcast_m2_${suffix}`);
    community = await createCommunity(`bcast_${suffix}`);

    // Add all as members
    await testPrisma.userCommunity.createMany({
      data: [
        { userId: actor.id, communityId: community.id, role: "MODERATOR" },
        { userId: member1.id, communityId: community.id, role: "MEMBER" },
        { userId: member2.id, communityId: community.id, role: "MEMBER" },
      ],
    });
  });

  it("should create notifications for all members except actor", async () => {
    const recipe = await testPrisma.recipe.create({
      data: { title: "New Recipe", content: "content", creatorId: actor.id, communityId: community.id },
    });

    const notifs = await createBroadcastNotifications({
      type: "RECIPE_CREATED",
      actorId: actor.id,
      communityId: community.id,
      recipeId: recipe.id,
      templateVars: {
        actorName: "actor",
        communityName: "Test",
        communityId: community.id,
        recipeName: "New Recipe",
        recipeId: recipe.id,
      },
    });

    expect(notifs.length).toBe(2);
    const recipientIds = notifs.map((n) => n.userId);
    expect(recipientIds).toContain(member1.id);
    expect(recipientIds).toContain(member2.id);
    expect(recipientIds).not.toContain(actor.id);
  });

  it("should respect preferences when broadcasting", async () => {
    // member1 disables RECIPE_PROPOSAL
    await testPrisma.notificationPreference.create({
      data: { userId: member1.id, communityId: null, category: "RECIPE_PROPOSAL", enabled: false },
    });

    const recipe = await testPrisma.recipe.create({
      data: { title: "New Recipe", content: "content", creatorId: actor.id, communityId: community.id },
    });

    const notifs = await createBroadcastNotifications({
      type: "RECIPE_CREATED",
      actorId: actor.id,
      communityId: community.id,
      recipeId: recipe.id,
      templateVars: {
        actorName: "actor",
        communityName: "Test",
        communityId: community.id,
        recipeName: "New Recipe",
        recipeId: recipe.id,
      },
    });

    expect(notifs.length).toBe(1);
    expect(notifs[0].userId).toBe(member2.id);
  });

  it("should return empty array for unknown type", async () => {
    const notifs = await createBroadcastNotifications({
      type: "UNKNOWN",
      actorId: actor.id,
      communityId: community.id,
      templateVars: {},
    });

    expect(notifs).toEqual([]);
  });

  it("should set groupKey on all broadcast notifications", async () => {
    const recipe = await testPrisma.recipe.create({
      data: { title: "R", content: "c", creatorId: actor.id, communityId: community.id },
    });

    const notifs = await createBroadcastNotifications({
      type: "RECIPE_CREATED",
      actorId: actor.id,
      communityId: community.id,
      recipeId: recipe.id,
      templateVars: {
        actorName: "a",
        communityName: "C",
        communityId: community.id,
        recipeName: "R",
        recipeId: recipe.id,
      },
    });

    for (const notif of notifs) {
      expect(notif.groupKey).toBe(`community:${community.id}:RECIPE_CREATED`);
    }
  });
});

// =============================================================================
// resolveTemplateVars
// =============================================================================
describe("resolveTemplateVars", () => {
  it("should resolve actor username", async () => {
    const suffix = uniqueSuffix();
    const user = await createUser(`resolve_${suffix}`);

    const vars = await resolveTemplateVars({
      type: "INVITE_SENT",
      userId: user.id,
      communityId: null,
    });

    expect(vars.actorName).toBe(user.username);
  });

  it("should resolve community name", async () => {
    const suffix = uniqueSuffix();
    const user = await createUser(`resolve2_${suffix}`);
    const community = await createCommunity(`resolve2_${suffix}`);

    const vars = await resolveTemplateVars({
      type: "INVITE_SENT",
      userId: user.id,
      communityId: community.id,
    });

    expect(vars.communityName).toBe(community.name);
    expect(vars.communityId).toBe(community.id);
  });

  it("should resolve recipe title", async () => {
    const suffix = uniqueSuffix();
    const user = await createUser(`resolve3_${suffix}`);
    const recipe = await testPrisma.recipe.create({
      data: { title: "Ma Recette", content: "c", creatorId: user.id },
    });

    const vars = await resolveTemplateVars({
      type: "VARIANT_PROPOSED",
      userId: user.id,
      communityId: null,
      recipeId: recipe.id,
    });

    expect(vars.recipeName).toBe("Ma Recette");
    expect(vars.recipeId).toBe(recipe.id);
  });

  it("should pass through metadata fields", async () => {
    const suffix = uniqueSuffix();
    const user = await createUser(`resolve4_${suffix}`);

    const vars = await resolveTemplateVars({
      type: "INGREDIENT_APPROVED",
      userId: user.id,
      communityId: null,
      metadata: { ingredientName: "Tomate", reason: "doublon" },
    });

    expect(vars.ingredientName).toBe("Tomate");
    expect(vars.reason).toBe("doublon");
  });
});

// =============================================================================
// getModeratorIdsForTagNotification (legacy, now uses filterByPreference)
// =============================================================================
describe("getModeratorIdsForTagNotification", () => {
  it("should return all moderators by default", async () => {
    const suffix = uniqueSuffix();
    const mod1 = await createUser(`mod1_${suffix}`);
    const mod2 = await createUser(`mod2_${suffix}`);
    const community = await createCommunity(`legacy_${suffix}`);

    await testPrisma.userCommunity.createMany({
      data: [
        { userId: mod1.id, communityId: community.id, role: "MODERATOR" },
        { userId: mod2.id, communityId: community.id, role: "MODERATOR" },
      ],
    });

    const ids = await getModeratorIdsForTagNotification(community.id);
    expect(ids).toContain(mod1.id);
    expect(ids).toContain(mod2.id);
  });

  it("should exclude moderator with TAG disabled", async () => {
    const suffix = uniqueSuffix();
    const mod1 = await createUser(`mod1b_${suffix}`);
    const mod2 = await createUser(`mod2b_${suffix}`);
    const community = await createCommunity(`legacy2_${suffix}`);

    await testPrisma.userCommunity.createMany({
      data: [
        { userId: mod1.id, communityId: community.id, role: "MODERATOR" },
        { userId: mod2.id, communityId: community.id, role: "MODERATOR" },
      ],
    });

    await testPrisma.notificationPreference.create({
      data: { userId: mod1.id, communityId: null, category: "TAG", enabled: false },
    });

    const ids = await getModeratorIdsForTagNotification(community.id);
    expect(ids).not.toContain(mod1.id);
    expect(ids).toContain(mod2.id);
  });
});

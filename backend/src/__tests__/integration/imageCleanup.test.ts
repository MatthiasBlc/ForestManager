import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTestUser,
  createTestRecipe,
  createTestCommunity,
} from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

// Mock storageService
vi.mock("../../services/storageService", () => ({
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

import { deleteObject } from "../../services/storageService";
import { cleanupOrphanImages } from "../../jobs/imageCleanup";

describe("Image Cleanup Job", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    user = await createTestUser();
  });

  it("should delete images from recipes soft-deleted > 7 days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);

    const recipe = await createTestRecipe(user.id, { imageKey: "recipes/abc/cover.webp" });
    await testPrisma.recipe.update({
      where: { id: recipe.id },
      data: { deletedAt: oldDate, imageKey: "recipes/abc/cover.webp" },
    });

    const deleted = await cleanupOrphanImages();

    expect(deleted).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith("recipes/abc/cover.webp");

    const updated = await testPrisma.recipe.findUnique({ where: { id: recipe.id } });
    expect(updated!.imageKey).toBeNull();
  });

  it("should delete images from communities soft-deleted > 7 days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);

    const community = await createTestCommunity(user.id);
    await testPrisma.community.update({
      where: { id: community.id },
      data: { deletedAt: oldDate, imageKey: "communities/abc/avatar.webp" },
    });

    const deleted = await cleanupOrphanImages();

    expect(deleted).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith("communities/abc/avatar.webp");

    const updated = await testPrisma.community.findUnique({ where: { id: community.id } });
    expect(updated!.imageKey).toBeNull();
  });

  it("should NOT delete images from recently soft-deleted items (< 7 days)", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3);

    const recipe = await createTestRecipe(user.id, { imageKey: "recipes/recent/cover.webp" });
    await testPrisma.recipe.update({
      where: { id: recipe.id },
      data: { deletedAt: recentDate, imageKey: "recipes/recent/cover.webp" },
    });

    const deleted = await cleanupOrphanImages();

    expect(deleted).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("should NOT delete images from active (non-deleted) items", async () => {
    await createTestRecipe(user.id, { imageKey: "recipes/active/cover.webp" });

    const deleted = await cleanupOrphanImages();

    expect(deleted).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("should skip items without imageKey", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);

    const recipe = await createTestRecipe(user.id);
    await testPrisma.recipe.update({
      where: { id: recipe.id },
      data: { deletedAt: oldDate },
    });

    const deleted = await cleanupOrphanImages();

    expect(deleted).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("should return 0 when nothing to clean", async () => {
    const deleted = await cleanupOrphanImages();
    expect(deleted).toBe(0);
  });

  it("should handle both recipes and communities in one run", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);

    const recipe = await createTestRecipe(user.id, { imageKey: "recipes/r1/cover.webp" });
    await testPrisma.recipe.update({
      where: { id: recipe.id },
      data: { deletedAt: oldDate, imageKey: "recipes/r1/cover.webp" },
    });

    const community = await createTestCommunity(user.id);
    await testPrisma.community.update({
      where: { id: community.id },
      data: { deletedAt: oldDate, imageKey: "communities/c1/avatar.webp" },
    });

    const deleted = await cleanupOrphanImages();

    expect(deleted).toBe(2);
    expect(deleteObject).toHaveBeenCalledTimes(2);
  });

  it("should continue on individual item failure", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);

    const recipe1 = await createTestRecipe(user.id, { imageKey: "recipes/fail/cover.webp" });
    await testPrisma.recipe.update({
      where: { id: recipe1.id },
      data: { deletedAt: oldDate, imageKey: "recipes/fail/cover.webp" },
    });

    const recipe2 = await createTestRecipe(user.id, { imageKey: "recipes/ok/cover.webp" });
    await testPrisma.recipe.update({
      where: { id: recipe2.id },
      data: { deletedAt: oldDate, imageKey: "recipes/ok/cover.webp" },
    });

    // Premiere suppression echoue, deuxieme reussit
    vi.mocked(deleteObject)
      .mockRejectedValueOnce(new Error("S3 error"))
      .mockResolvedValueOnce(undefined);

    const deleted = await cleanupOrphanImages();

    // Seulement 1 succes (l'autre a echoue mais n'a pas stoppe le job)
    expect(deleted).toBe(1);
    expect(deleteObject).toHaveBeenCalledTimes(2);
  });
});

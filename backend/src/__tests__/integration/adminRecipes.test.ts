import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import {
  createTestAdmin,
  createTestTag,
  createTestUser,
  createTestRecipe,
  loginAsAdmin,
} from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

describe("Admin Recipes API", () => {
  let adminCookie: string;

  beforeEach(async () => {
    const admin = await createTestAdmin();
    adminCookie = await loginAsAdmin(admin);
  });

  // =====================================
  // GET /api/admin/tags/:id/recipes
  // =====================================
  describe("GET /api/admin/tags/:id/recipes", () => {
    it("should return recipes for a tag", async () => {
      const user = await createTestUser();
      const tag = await createTestTag("tagrecipes");
      await createTestRecipe(user.id, { title: "Recipe A", tags: ["tagrecipes"] });
      await createTestRecipe(user.id, { title: "Recipe B", tags: ["tagrecipes"] });

      const res = await request(app)
        .get(`/api/admin/tags/${tag.id}/recipes`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.recipes).toBeDefined();
      expect(res.body.recipes.length).toBe(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);

      const recipe = res.body.recipes[0];
      expect(recipe.id).toBeDefined();
      expect(recipe.title).toBeDefined();
      expect(recipe.creator).toBeDefined();
      expect(recipe.creator.username).toBeDefined();
    });

    it("should filter out deleted recipes by default", async () => {
      const user = await createTestUser();
      await createTestTag("tagfilter");
      const recipe = await createTestRecipe(user.id, {
        title: "Active Recipe",
        tags: ["tagfilter"],
      });
      const deletedRecipe = await createTestRecipe(user.id, {
        title: "Deleted Recipe",
        tags: ["tagfilter"],
      });

      // Soft delete one recipe
      await testPrisma.recipe.update({
        where: { id: deletedRecipe.id },
        data: { deletedAt: new Date() },
      });

      const tag = await testPrisma.tag.findFirst({ where: { name: "tagfilter" } });

      const res = await request(app)
        .get(`/api/admin/tags/${tag!.id}/recipes`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.recipes.length).toBe(1);
      expect(res.body.recipes[0].id).toBe(recipe.id);
    });

    it("should include deleted recipes when includeDeleted=true", async () => {
      const user = await createTestUser();
      await createTestTag("tagdeleted");
      await createTestRecipe(user.id, { title: "Active2", tags: ["tagdeleted"] });
      const deletedRecipe = await createTestRecipe(user.id, {
        title: "Deleted2",
        tags: ["tagdeleted"],
      });

      await testPrisma.recipe.update({
        where: { id: deletedRecipe.id },
        data: { deletedAt: new Date() },
      });

      const tag = await testPrisma.tag.findFirst({ where: { name: "tagdeleted" } });

      const res = await request(app)
        .get(`/api/admin/tags/${tag!.id}/recipes?includeDeleted=true`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.recipes.length).toBe(2);
    });

    it("should return 404 for non-existent tag", async () => {
      const res = await request(app)
        .get("/api/admin/tags/00000000-0000-4000-8000-000000000000/recipes")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("ADMIN_REC_001");
    });

    it("should return 401 without admin authentication", async () => {
      const res = await request(app).get(
        "/api/admin/tags/00000000-0000-4000-8000-000000000000/recipes"
      );

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // GET /api/admin/recipes/:recipeId
  // =====================================
  describe("GET /api/admin/recipes/:recipeId", () => {
    it("should return full recipe detail", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, {
        title: "Detail Recipe",
        tags: ["detailtag"],
        ingredients: [{ name: "flour", quantity: 200 }],
        steps: [{ instruction: "Mix" }, { instruction: "Bake" }],
      });

      const res = await request(app)
        .get(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.recipe).toBeDefined();
      expect(res.body.recipe.title).toBe("Detail Recipe");
      expect(res.body.recipe.creator.username).toBeDefined();
      expect(res.body.recipe.tags).toBeDefined();
      expect(res.body.recipe.tags.length).toBeGreaterThanOrEqual(1);
      expect(res.body.recipe.ingredients).toBeDefined();
      expect(res.body.recipe.ingredients.length).toBe(1);
      expect(res.body.recipe.ingredients[0].ingredient.name).toBe("flour");
      expect(res.body.recipe.steps).toBeDefined();
      expect(res.body.recipe.steps.length).toBe(2);
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .get("/api/admin/recipes/00000000-0000-4000-8000-000000000000")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("ADMIN_REC_002");
    });

    it("should return 401 without admin authentication", async () => {
      const res = await request(app).get("/api/admin/recipes/00000000-0000-4000-8000-000000000000");

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // PATCH /api/admin/recipes/:recipeId
  // =====================================
  describe("PATCH /api/admin/recipes/:recipeId", () => {
    it("should update recipe scalar fields", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Old Title", servings: 4 });

      const res = await request(app)
        .patch(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie)
        .send({ title: "New Title", servings: 6, prepTime: 15 });

      expect(res.status).toBe(200);
      expect(res.body.recipe.title).toBe("New Title");
      expect(res.body.recipe.servings).toBe(6);
      expect(res.body.recipe.prepTime).toBe(15);

      // Verify in DB
      const updated = await testPrisma.recipe.findUnique({ where: { id: recipe.id } });
      expect(updated?.title).toBe("New Title");
      expect(updated?.servings).toBe(6);
      expect(updated?.prepTime).toBe(15);
    });

    it("should create audit log entry", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Audit Recipe" });

      await request(app)
        .patch(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie)
        .send({ title: "Updated Audit Recipe" });

      const log = await testPrisma.adminActivityLog.findFirst({
        where: { targetId: recipe.id, type: "RECIPE_UPDATED" },
      });
      expect(log).not.toBeNull();
      expect(log?.targetType).toBe("Recipe");
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .patch("/api/admin/recipes/00000000-0000-4000-8000-000000000000")
        .set("Cookie", adminCookie)
        .send({ title: "Test" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("ADMIN_REC_002");
    });

    it("should return 400 when title is not a string", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Valid" });

      const res = await request(app)
        .patch(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie)
        .send({ title: 123 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("VALIDATION_001");
    });

    it("should return 400 when title is too long", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Valid" });

      const res = await request(app)
        .patch(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie)
        .send({ title: "a".repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("VALIDATION_001");
    });

    it("should return 400 when servings is invalid", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Valid" });

      const res = await request(app)
        .patch(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie)
        .send({ servings: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("RECIPE_006");
    });

    it("should return 400 when prepTime is not a number", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Valid" });

      const res = await request(app)
        .patch(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie)
        .send({ prepTime: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("VALIDATION_001");
    });

    it("should return 401 without admin authentication", async () => {
      const res = await request(app)
        .patch("/api/admin/recipes/00000000-0000-4000-8000-000000000000")
        .send({ title: "Test" });

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // DELETE /api/admin/recipes/:recipeId
  // =====================================
  describe("DELETE /api/admin/recipes/:recipeId", () => {
    it("should soft delete a recipe", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "To Delete" });

      const res = await request(app)
        .delete(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("deleted");

      // Verify in DB
      const deleted = await testPrisma.recipe.findUnique({ where: { id: recipe.id } });
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it("should create audit log entry", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Delete Audit" });

      await request(app).delete(`/api/admin/recipes/${recipe.id}`).set("Cookie", adminCookie);

      const log = await testPrisma.adminActivityLog.findFirst({
        where: { targetId: recipe.id, type: "RECIPE_DELETED" },
      });
      expect(log).not.toBeNull();
      expect(log?.targetType).toBe("Recipe");
    });

    it("should return 400 if recipe already deleted", async () => {
      const user = await createTestUser();
      const recipe = await createTestRecipe(user.id, { title: "Already Deleted" });

      // Soft delete first
      await testPrisma.recipe.update({
        where: { id: recipe.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app)
        .delete(`/api/admin/recipes/${recipe.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("ADMIN_REC_003");
    });

    it("should return 404 for non-existent recipe", async () => {
      const res = await request(app)
        .delete("/api/admin/recipes/00000000-0000-4000-8000-000000000000")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("ADMIN_REC_002");
    });

    it("should return 401 without admin authentication", async () => {
      const res = await request(app).delete(
        "/api/admin/recipes/00000000-0000-4000-8000-000000000000"
      );

      expect(res.status).toBe(401);
    });
  });
});

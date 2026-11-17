// Planning (C5.3) : idees de repas en texte libre [D182], ajoutees par tout
// membre, modifiees ou supprimees par leur auteur ou les moderateurs, retirees
// une fois converties en recette [F-MPL-4].
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createSpace, grantModule } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";
import { ACTORS, clientAs, expectPermission, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

beforeAll(async () => {
  await db.module.update({ where: { code: "meal-plan" }, data: { status: "AVAILABLE" } });
});

async function plannedGroup() {
  const f = await groupFixture();
  await grantModule(f.spaceId, "meal-plan");
  return f;
}

const ideasOf = (spaceId: string) => `/spaces/${spaceId}/meal-plan/ideas`;

async function addIdea(client: Client, spaceId: string, body: Record<string, unknown> = {}) {
  const res = await client.post(ideasOf(spaceId), { name: "Raclette", ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string };
}

async function listIdeas(client: Client, spaceId: string) {
  const res = await client.get(ideasOf(spaceId));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data as Record<string, unknown>[];
}

describe("ajouter et lister (D182)", () => {
  it("une idee : nom, commentaire, auteur et droits du lecteur", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const res = await member.post(ideasOf(f.spaceId), {
      name: "  Lasagnes vegetariennes ",
      comment: "Celles de la cantine",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Lasagnes vegetariennes",
      comment: "Celles de la cantine",
      author: { id: f.member.id, username: f.member.username },
      can: { edit: true, delete: true },
    });
  });

  it("commentaire facultatif, vide = null", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const res = await member.post(ideasOf(f.spaceId), { name: "Raclette", comment: "  " });
    expect(res.body.comment).toBeNull();
  });

  it("refuse un nom vide ou trop long", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    for (const name of ["", "   ", "x".repeat(121)]) {
      const res = await member.post(ideasOf(f.spaceId), { name });
      expect(res.body.error.code, JSON.stringify(name)).toBe("VALIDATION_001");
    }
  });

  it("liste les idees de l'espace, plus recentes d'abord, sans les retirees", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const other = await createSpace(f.member.id);
    await grantModule(other.id, "meal-plan");
    await addIdea(member, f.spaceId, { name: "Raclette" });
    const removed = await addIdea(member, f.spaceId, { name: "Fondue" });
    await addIdea(member, f.spaceId, { name: "Curry" });
    await addIdea(member, other.id, { name: "Ailleurs" });
    await member.delete(`${ideasOf(f.spaceId)}/${removed.id}`);
    const ideas = await listIdeas(member, f.spaceId);
    expect(ideas.map((i) => i.name)).toEqual(["Curry", "Raclette"]);
  });

  it("droits du lecteur : un membre ne modifie que ses idees, un moderateur toutes", async () => {
    const f = await plannedGroup();
    const extra = await loginAs(f.extra, app);
    await addIdea(extra, f.spaceId);
    const member = await loginAs(f.member, app);
    const moderator = await loginAs(f.moderator, app);
    expect((await listIdeas(member, f.spaceId))[0]?.can).toEqual({ edit: false, delete: false });
    expect((await listIdeas(moderator, f.spaceId))[0]?.can).toEqual({ edit: true, delete: true });
  });

  it("auteur parti avec son compte : l'idee reste, sans auteur (D20)", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    await addIdea(member, f.spaceId);
    await db.mealIdea.updateMany({ where: { spaceId: f.spaceId }, data: { createdById: null } });
    const [idea] = await listIdeas(member, f.spaceId);
    expect(idea).toMatchObject({ name: "Raclette", author: null, can: { edit: false } });
  });
});

describe("modifier et supprimer", () => {
  it("l'auteur modifie son idee", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const idea = await addIdea(member, f.spaceId, { comment: "En hiver" });
    const res = await member.put(`${ideasOf(f.spaceId)}/${idea.id}`, {
      name: "Raclette savoyarde",
      comment: null,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: idea.id, name: "Raclette savoyarde", comment: null });
  });

  it("un autre membre ne modifie ni ne supprime l'idee", async () => {
    const f = await plannedGroup();
    const extra = await loginAs(f.extra, app);
    const idea = await addIdea(extra, f.spaceId);
    const member = await loginAs(f.member, app);
    const url = `${ideasOf(f.spaceId)}/${idea.id}`;
    expect((await member.put(url, { name: "Autre" })).body.error.code).toBe("SPACE_002");
    expect((await member.delete(url)).body.error.code).toBe("SPACE_002");
  });

  it("un moderateur modifie et supprime l'idee d'un membre", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const idea = await addIdea(member, f.spaceId);
    const moderator = await loginAs(f.moderator, app);
    const url = `${ideasOf(f.spaceId)}/${idea.id}`;
    expect((await moderator.put(url, { name: "Raclette du dimanche" })).status).toBe(200);
    expect((await moderator.delete(url)).status).toBe(204);
    const row = await db.mealIdea.findUniqueOrThrow({ where: { id: idea.id } });
    expect(row.deletedAt).not.toBeNull();
  });

  it("idee inconnue, retiree ou d'un autre espace : MEAL_002", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const other = await createSpace(f.member.id);
    await grantModule(other.id, "meal-plan");
    const elsewhere = await addIdea(member, other.id);
    const removed = await addIdea(member, f.spaceId);
    await member.delete(`${ideasOf(f.spaceId)}/${removed.id}`);
    for (const id of [UNKNOWN, elsewhere.id, removed.id]) {
      const url = `${ideasOf(f.spaceId)}/${id}`;
      expect((await member.put(url, { name: "X" })).body.error.code, id).toBe("MEAL_002");
      expect((await member.delete(url)).body.error.code, id).toBe("MEAL_002");
    }
  });
});

describe("transformer en recette (F-MPL-4, D182)", () => {
  it("la recette creee par le lecteur dans l'espace retire l'idee", async () => {
    const f = await plannedGroup();
    const extra = await loginAs(f.extra, app);
    const idea = await addIdea(extra, f.spaceId);
    // Tout membre peut transformer l'idee d'un autre : il devient l'auteur de la recette.
    const member = await loginAs(f.member, app);
    const recipe = await createRecipe(member, f.spaceId, { title: "Raclette" });
    const res = await member.post(`${ideasOf(f.spaceId)}/${idea.id}/convert`, {
      recipeId: recipe.id,
    });
    expect(res.status).toBe(204);
    expect(await listIdeas(member, f.spaceId)).toEqual([]);
  });

  it("refuse une recette d'un autre auteur ou d'un autre espace", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const idea = await addIdea(member, f.spaceId);
    const extra = await loginAs(f.extra, app);
    const notMine = await createRecipe(extra, f.spaceId);
    const elsewhere = await createRecipe(member, (await createSpace(f.member.id)).id);
    for (const recipeId of [notMine.id, elsewhere.id, UNKNOWN]) {
      const res = await member.post(`${ideasOf(f.spaceId)}/${idea.id}/convert`, { recipeId });
      expect(res.body.error.code, recipeId).toBe("RECIPE_001");
    }
    expect(await listIdeas(member, f.spaceId)).toHaveLength(1);
  });

  it("idee deja retiree : MEAL_002", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const idea = await addIdea(member, f.spaceId);
    const recipe = await createRecipe(member, f.spaceId);
    const url = `${ideasOf(f.spaceId)}/${idea.id}/convert`;
    expect((await member.post(url, { recipeId: recipe.id })).status).toBe(204);
    expect((await member.post(url, { recipeId: recipe.id })).body.error.code).toBe("MEAL_002");
  });
});

describe("droits (matrice Planning)", () => {
  for (const actor of ACTORS) {
    const allowed = actor === "MEMBER" || actor === "MODERATOR" || actor === "OWNER";
    it(`lister les idees - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      expectPermission(actor, allowed, await client.get(ideasOf(f.spaceId)));
    });

    it(`ajouter une idee - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      expectPermission(actor, allowed, await client.post(ideasOf(f.spaceId), { name: "Soupe" }));
    });
  }

  it("le role minimal du planning ne limite pas les idees (D58)", async () => {
    const f = await plannedGroup();
    await db.mealPlanSettings.create({ data: { spaceId: f.spaceId, editRole: "OWNER" } });
    const member = await loginAs(f.member, app);
    await addIdea(member, f.spaceId);
  });

  it("module inactif : refuse", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const res = await member.get(ideasOf(f.spaceId));
    expect(res.status).not.toBe(200);
  });
});

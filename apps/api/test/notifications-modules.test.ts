// Evenements des modules Recettes et Planning (C6.5) [P04, P06, P07, P10, D41].
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser, grantModule } from "./helpers/factories.ts";
import { createRecipe, recipeBody } from "./helpers/recipes.ts";

const app = createTestApp();

beforeAll(async () => {
  await db.module.update({ where: { code: "meal-plan" }, data: { status: "AVAILABLE" } });
});

async function notificationsOf(userId: string, type?: string) {
  return db.notification.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "asc" },
  });
}

async function activityOf(spaceId: string) {
  return (
    await db.activityEvent.findMany({ where: { spaceId }, orderBy: { createdAt: "asc" } })
  ).map((event) => [event.type, event.actorId]);
}

/** Foyer : Olga OWNER, Lea MEMBER (autrice), Matthias MEMBER. Colloc : Matthias OWNER. */
async function world() {
  const olga = await createUser();
  const lea = await createUser();
  const matthias = await createUser();
  const foyer = await createSpace(olga.id, { name: "Foyer" });
  await addMember(foyer.id, lea.id);
  await addMember(foyer.id, matthias.id);
  const colloc = await createSpace(matthias.id, { name: "Colloc" });
  const asLea = await loginAs(lea, app);
  const asMatthias = await loginAs(matthias, app);
  const asOlga = await loginAs(olga, app);
  // "Nouvelles recettes" est coupee par defaut : Olga l'active pour le test.
  await asOlga.put("/me/notification-preferences", { category: "recipes.new", enabled: true });
  const recipe = await createRecipe(asLea, foyer.id, { title: "Saumon teriyaki" });
  const base = `/spaces/${foyer.id}/recipes/${recipe.id}`;
  return { olga, lea, matthias, foyer, colloc, asLea, asMatthias, asOlga, recipe, base };
}

describe("recettes", () => {
  it("une nouvelle recette entre dans l'activite et previent ceux qui l'ont demande", async () => {
    const w = await world();
    expect(await activityOf(w.foyer.id)).toEqual([["recipes.recipe.created", w.lea.id]]);
    const olga = await notificationsOf(w.olga.id, "recipes.recipe.created");
    expect(olga).toHaveLength(1);
    expect(olga[0]).toMatchObject({
      spaceId: w.foyer.id,
      actorId: w.lea.id,
      moduleCode: "recipes",
      data: { recipeId: w.recipe.id, title: "Saumon teriyaki" },
    });
    // Categorie coupee par defaut pour Matthias, jamais pour l'autrice elle-meme.
    expect(await notificationsOf(w.matthias.id)).toEqual([]);
    expect(await notificationsOf(w.lea.id)).toEqual([]);
  });

  it("depart de l'autrice : les responsables voient ses suggestions en attente (P08)", async () => {
    const w = await world();
    const created = await w.asMatthias.post(`${w.base}/suggestions`, {
      ...(await recipeBody(w.asMatthias, { title: "Saumon teriyaki", cookMinutes: 40 })),
      revision: 1,
    });
    expect(created.status).toBe(201);
    expect((await w.asLea.post(`/spaces/${w.foyer.id}/leave`, {})).status).toBe(204);
    const left = await notificationsOf(w.olga.id, "core.member.left");
    expect(left).toHaveLength(1);
    expect(left[0]!.data).toEqual({ pending: { "recipes.suggestions": 1 } });

    // Sans rien en attente, pas de parametre.
    expect((await w.asMatthias.post(`/spaces/${w.foyer.id}/leave`, {})).status).toBe(204);
    const again = await notificationsOf(w.olga.id, "core.member.left");
    expect(again[0]!.count).toBe(2);
    expect(again[0]!.data).toBeNull();
  });

  it("suggestion : l'autrice est prevenue, puis le proposant de la decision", async () => {
    const w = await world();
    const created = await w.asMatthias.post(`${w.base}/suggestions`, {
      ...(await recipeBody(w.asMatthias, { title: "Saumon teriyaki", cookMinutes: 40 })),
      revision: 1,
      message: "Plus de cuisson",
    });
    expect(created.status).toBe(201);
    const toLea = await notificationsOf(w.lea.id, "recipes.suggestion.created");
    expect(toLea[0]).toMatchObject({
      spaceId: w.foyer.id,
      actorId: w.matthias.id,
      data: { recipeId: w.recipe.id, title: "Saumon teriyaki", suggestionId: created.body.id },
    });
    expect(
      (
        await w.asLea.post(`${w.base}/suggestions/${created.body.id}/reject`, {
          message: "Non merci",
        })
      ).status
    ).toBe(204);
    const toMatthias = await notificationsOf(w.matthias.id, "recipes.suggestion.rejected");
    expect(toMatthias[0]).toMatchObject({
      actorId: w.lea.id,
      data: { recipeId: w.recipe.id, title: "Saumon teriyaki", message: "Non merci" },
    });
  });

  it("demande de partage : l'autrice est prevenue, puis le demandeur ; le partage entre dans l'activite", async () => {
    const w = await world();
    const asked = await w.asMatthias.post(`${w.base}/share-requests`, {
      targetSpaceId: w.colloc.id,
    });
    expect(asked.body.status).toBe("PENDING");
    const toLea = await notificationsOf(w.lea.id, "recipes.share-request.created");
    expect(toLea[0]).toMatchObject({
      spaceId: w.foyer.id,
      actorId: w.matthias.id,
      data: { title: "Saumon teriyaki", targetSpaceName: "Colloc", personal: false },
    });
    const request = await db.recipeShareRequest.findFirstOrThrow({
      where: { recipeId: w.recipe.id },
    });
    expect(
      (await w.asLea.post(`/spaces/${w.foyer.id}/recipes/share-requests/${request.id}/approve`, {}))
        .status
    ).toBe(204);
    const toMatthias = await notificationsOf(w.matthias.id, "recipes.share-request.approved");
    expect(toMatthias[0]).toMatchObject({
      actorId: w.lea.id,
      data: { title: "Saumon teriyaki", targetSpaceName: "Colloc", targetSpaceId: w.colloc.id },
    });
    expect(await activityOf(w.colloc.id)).toEqual([["recipes.recipe.shared", w.matthias.id]]);
  });

  it("adaptation : l'autrice de l'original est prevenue", async () => {
    const w = await world();
    const adapted = await w.asMatthias.post(`${w.base}/adapt`, { targetSpaceId: w.colloc.id });
    expect(adapted.status).toBe(201);
    const toLea = await notificationsOf(w.lea.id, "recipes.recipe.adapted");
    expect(toLea).toHaveLength(1);
    expect(toLea[0]).toMatchObject({
      spaceId: w.foyer.id,
      actorId: w.matthias.id,
      data: { recipeId: w.recipe.id, title: "Saumon teriyaki", spaceName: "Colloc" },
    });
  });
});

describe("planning", () => {
  function day(offset: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  it("un repas change par un membre previent les autres (regroupe) ; la generation entre dans l'activite", async () => {
    const w = await world();
    await grantModule(w.foyer.id, "meal-plan");
    const meal = (date: string) =>
      w.asLea.put(`/spaces/${w.foyer.id}/meal-plan/meals/${date}/DINNER`, {
        kind: "TEXT",
        text: "Pizza",
      });
    expect((await meal(day(1))).status).toBe(200);
    expect((await meal(day(2))).status).toBe(200);
    const changed = await notificationsOf(w.olga.id, "meal-plan.meal.changed");
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ spaceId: w.foyer.id, actorId: w.lea.id, count: 2 });
    expect(await notificationsOf(w.lea.id, "meal-plan.meal.changed")).toEqual([]);

    const applied = await w.asOlga.post(`/spaces/${w.foyer.id}/meal-plan/generate/apply`, {
      cells: [
        {
          date: day(3),
          mealTime: "DINNER",
          pick: { kind: "RECIPE", recipeId: w.recipe.id },
          seenUpdatedAt: null,
        },
      ],
    });
    expect(applied.status, JSON.stringify(applied.body)).toBe(200);
    expect((await activityOf(w.foyer.id)).at(-1)).toEqual(["meal-plan.plan.generated", w.olga.id]);
    const generated = await notificationsOf(w.lea.id, "meal-plan.plan.generated");
    expect(generated[0]).toMatchObject({ spaceId: w.foyer.id, actorId: w.olga.id });
  });
});

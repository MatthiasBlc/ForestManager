// Adaptation d'une recette pour un espace (C3.6) : copie liee a l'original et a
// sa revision de depart, badge "Original modifie", comparaison, marquer comme vu
// [D17, D105, D140, D166].
import { NOT_FOUND_UUID } from "@fm/test-utils";
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, recipeBody, unitId } from "./helpers/recipes.ts";

const app = createTestApp();

/** Foyer : Lea OWNER (autrice), Matthias MEMBER. Colloc : Matthias OWNER, Paul MEMBER. */
async function world() {
  const [lea, matthias, paul, olga] = await Promise.all(
    Array.from({ length: 4 }, () => createUser())
  );
  if (!lea || !matthias || !paul || !olga) throw new Error("users");
  const foyer = await createSpace(lea.id, { name: "Foyer" });
  await addMember(foyer.id, matthias.id);
  const colloc = await createSpace(matthias.id, { name: "Colloc" });
  await addMember(colloc.id, paul.id);
  const ailleurs = await createSpace(olga.id, { name: "Ailleurs" });
  const [asLea, asMatthias, asPaul] = await Promise.all([
    loginAs(lea, app),
    loginAs(matthias, app),
    loginAs(paul, app),
  ]);
  const original = await createRecipe(asLea, foyer.id, { title: "Gratin de pâtes" });
  return { lea, matthias, paul, foyer, colloc, ailleurs, asLea, asMatthias, asPaul, original };
}

const recipesOf = (spaceId: string) => `/spaces/${spaceId}/recipes`;

describe("adapter une recette (F-ADAPTER)", () => {
  it("cree une recette de l'espace cible, liee a l'original et a sa revision", async () => {
    const w = await world();
    const res = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${w.original.id}/adapt`, {
      targetSpaceId: w.colloc.id,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      homeSpaceId: w.colloc.id,
      title: "Gratin de pâtes",
      author: { id: w.matthias.id },
      currentRevision: 1,
      adaptedFrom: {
        id: w.original.id,
        title: "Gratin de pâtes",
        author: { id: w.lea.id },
        homeSpace: { id: w.foyer.id, name: "Foyer" },
        deleted: false,
        changed: false,
      },
      can: { edit: true },
    });
    expect(res.body.blocks[0].ingredients).toHaveLength(2);
    const row = await db.recipe.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row).toMatchObject({ adaptedFromId: w.original.id, adaptedFromRevision: 1 });

    const original = await w.asLea.get(`${recipesOf(w.foyer.id)}/${w.original.id}`);
    expect(original.body).toMatchObject({ adaptedFrom: null, adaptationCount: 1 });
  });

  it("garde les tags globaux, pas les tags de l'espace d'origine", async () => {
    const w = await world();
    const tag = await db.tag.findFirstOrThrow({ where: { scope: "GLOBAL" } });
    const spaceTag = await w.asLea.post(`${recipesOf(w.foyer.id)}/tags`, { name: "Dimanche" });
    const tagged = await createRecipe(w.asLea, w.foyer.id, {
      globalTagIds: [tag.id],
      spaceTagIds: [spaceTag.body.id],
    });
    const res = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${tagged.id}/adapt`, {
      targetSpaceId: w.colloc.id,
    });
    expect(res.body.tags.map((t: { id: string }) => t.id)).toEqual([tag.id]);
  });

  it("vers l'espace courant ou l'espace perso : permis (seule copie possible, D140)", async () => {
    const w = await world();
    for (const target of [w.foyer.id, w.matthias.personalSpaceId]) {
      const res = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${w.original.id}/adapt`, {
        targetSpaceId: target,
      });
      expect(res.status).toBe(201);
      expect(res.body.homeSpaceId).toBe(target);
    }
  });

  it("refus : espace cible dont on n'est pas membre, recette invisible ici", async () => {
    const w = await world();
    const notMember = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${w.original.id}/adapt`, {
      targetSpaceId: w.ailleurs.id,
    });
    expect(notMember.status).toBe(404);
    expect(notMember.body.error.code).toBe("SPACE_001");
    const unknown = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${w.original.id}/adapt`, {
      targetSpaceId: NOT_FOUND_UUID,
    });
    expect(unknown.body.error.code).toBe("SPACE_001");
    const hidden = await w.asMatthias.post(`${recipesOf(w.colloc.id)}/${w.original.id}/adapt`, {
      targetSpaceId: w.colloc.id,
    });
    expect(hidden.body.error.code).toBe("RECIPE_001");
  });

  it("module Recettes inactif dans l'espace cible : MODULE_001", async () => {
    const w = await world();
    await db.spaceModule.updateMany({
      where: { spaceId: w.colloc.id, moduleCode: "recipes" },
      data: { enabled: false },
    });
    const res = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${w.original.id}/adapt`, {
      targetSpaceId: w.colloc.id,
    });
    expect(res.body.error.code).toBe("MODULE_001");
  });

  it("garde les recettes liees, meme non visibles dans l'espace cible", async () => {
    const w = await world();
    const sauce = await createRecipe(w.asLea, w.foyer.id, {
      title: "Sauce",
      isBase: true,
      yieldUnitId: await unitId("ml"),
      yieldQuantity: 300,
    });
    const body = await recipeBody(w.asLea, { title: "Plat" });
    const dish = await createRecipe(w.asLea, w.foyer.id, {
      blocks: [
        ...body.blocks,
        { kind: "RECIPE", recipeId: sauce.id, quantity: 150, unitId: await unitId("ml") },
      ],
    });
    const res = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${dish.id}/adapt`, {
      targetSpaceId: w.colloc.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.blocks[1]).toMatchObject({
      kind: "RECIPE",
      recipeId: sauce.id,
      status: "HIDDEN",
    });
  });
});

describe("comparer avec l'original (E-COMPARER-ORIGINAL)", () => {
  async function adapted() {
    const w = await world();
    const res = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${w.original.id}/adapt`, {
      targetSpaceId: w.colloc.id,
    });
    const adaptation = res.body as { id: string };
    const compare = `${recipesOf(w.colloc.id)}/${adaptation.id}/compare`;
    return { ...w, adaptation, compare };
  }

  it("l'original change : badge, puis les trois contenus a comparer", async () => {
    const w = await adapted();
    const edit = await w.asLea.put(`${recipesOf(w.foyer.id)}/${w.original.id}`, {
      ...(await recipeBody(w.asLea, { title: "Gratin de pâtes", cookMinutes: 35 })),
      revision: 1,
    });
    expect(edit.status).toBe(200);
    await w.asMatthias.put(`${recipesOf(w.colloc.id)}/${w.adaptation.id}`, {
      ...(await recipeBody(w.asMatthias, { title: "Gratin au beurre" })),
      revision: 1,
    });

    const detail = await w.asPaul.get(`${recipesOf(w.colloc.id)}/${w.adaptation.id}`);
    expect(detail.body.adaptedFrom).toMatchObject({ changed: true, deleted: false });

    const res = await w.asPaul.get(w.compare);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      original: {
        id: w.original.id,
        title: "Gratin de pâtes",
        homeSpace: { name: "Foyer" },
        currentRevision: 2,
        lastChange: { by: { id: w.lea.id } },
      },
      baseRevision: 1,
      base: { title: "Gratin de pâtes", cookMinutes: 30 },
      current: { cookMinutes: 35 },
      adaptation: { title: "Gratin au beurre" },
      canMarkSeen: false,
    });
    expect(res.body.base.blocks[0].ingredients[0]).toMatchObject({ name: "Pâtes", quantity: 500 });
  });

  it("marquer comme vu aligne l'adaptation sur l'original actuel", async () => {
    const w = await adapted();
    await w.asLea.put(`${recipesOf(w.foyer.id)}/${w.original.id}`, {
      ...(await recipeBody(w.asLea, { cookMinutes: 35 })),
      revision: 1,
    });
    const denied = await w.asPaul.post(`${w.compare}/seen`);
    expect(denied.status).toBe(403);
    const seen = await w.asMatthias.post(`${w.compare}/seen`);
    expect(seen.status).toBe(204);
    const detail = await w.asMatthias.get(`${recipesOf(w.colloc.id)}/${w.adaptation.id}`);
    expect(detail.body.adaptedFrom.changed).toBe(false);
    const res = await w.asMatthias.get(w.compare);
    expect(res.body).toMatchObject({ baseRevision: 2, original: { lastChange: null } });
  });

  it("original supprime : l'adaptation vit seule", async () => {
    const w = await adapted();
    await w.asLea.delete(`${recipesOf(w.foyer.id)}/${w.original.id}`);
    const detail = await w.asMatthias.get(`${recipesOf(w.colloc.id)}/${w.adaptation.id}`);
    expect(detail.body.adaptedFrom).toMatchObject({ deleted: true, changed: false });
    const res = await w.asMatthias.get(w.compare);
    expect(res.body).toMatchObject({ original: { deleted: true }, current: null });
  });

  it("une recette qui n'est pas une adaptation : RECIPE_011", async () => {
    const w = await adapted();
    const res = await w.asLea.get(`${recipesOf(w.foyer.id)}/${w.original.id}/compare`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RECIPE_011");
  });
});

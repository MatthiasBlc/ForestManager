// "Depuis mes recettes" (C7c.1) : depuis un espace de groupe, l'auteur y partage
// d'un coup plusieurs de ses recettes, par reference, avec leurs sous-recettes
// du meme auteur ; tout ou rien, une ligne d'activite par lot [D203, D208, D26].
import { NOT_FOUND_UUID } from "@fm/test-utils";
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, unitId } from "./helpers/recipes.ts";

const app = createTestApp();

/** Coloc : Lea OWNER, Matthias MEMBER. Famille : Matthias OWNER, Lea MEMBER. */
async function world() {
  const [lea, matthias] = await Promise.all([createUser(), createUser()]);
  const coloc = await createSpace(lea.id, { name: "Coloc" });
  await addMember(coloc.id, matthias.id);
  const famille = await createSpace(matthias.id, { name: "Famille" });
  await addMember(famille.id, lea.id);
  const [asLea, asMatthias] = await Promise.all([loginAs(lea, app), loginAs(matthias, app)]);
  return { lea, matthias, coloc, famille, asLea, asMatthias };
}

const recipesOf = (spaceId: string) => `/spaces/${spaceId}/recipes`;

async function titlesIn(client: Client, spaceId: string): Promise<string[]> {
  const res = await client.get(recipesOf(spaceId));
  return (res.body.data as { title: string }[]).map((r) => r.title).sort();
}

const titles = (body: { data: { title: string }[] }) => body.data.map((r) => r.title).sort();

const link = async (recipeId: string) => ({
  kind: "RECIPE",
  recipeId,
  quantity: 100,
  unitId: await unitId("ml"),
});

async function activityOf(spaceId: string) {
  return (
    await db.activityEvent.findMany({ where: { spaceId }, orderBy: { createdAt: "asc" } })
  ).map((event) => ({ type: event.type, actorId: event.actorId, data: event.data }));
}

describe("recettes a ajouter (GET /mine?addable=true)", () => {
  it("liste mes recettes pas encore visibles dans l'espace, ni supprimees ni masquees", async () => {
    const w = await world();
    const perso = w.lea.personalSpaceId;
    await createRecipe(w.asLea, perso, { title: "Dahl" });
    await createRecipe(w.asLea, w.famille.id, { title: "Gratin" });
    await createRecipe(w.asLea, w.coloc.id, { title: "Tarte" });
    const curry = await createRecipe(w.asLea, perso, { title: "Curry" });
    await w.asLea.put(`${recipesOf(perso)}/${curry.id}/shares`, { spaceIds: [w.coloc.id] });
    const hidden = await createRecipe(w.asLea, perso, { title: "Masquee" });
    await db.recipe.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });
    const gone = await createRecipe(w.asLea, perso, { title: "Supprimee" });
    await db.recipe.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    await createRecipe(w.asMatthias, w.famille.id, { title: "Poulet" });

    const res = await w.asLea.get(`${recipesOf(w.coloc.id)}/mine?addable=true`);
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(["Dahl", "Gratin"]);
    // Sans le filtre, "Mes recettes" reste complet.
    const all = await w.asLea.get(`${recipesOf(w.coloc.id)}/mine`);
    expect(titles(all.body)).toEqual(["Curry", "Dahl", "Gratin", "Masquee", "Tarte"]);
    // Recherche comme la liste.
    const searched = await w.asLea.get(`${recipesOf(w.coloc.id)}/mine?addable=true&q=dah`);
    expect(titles(searched.body)).toEqual(["Dahl"]);
  });

  it("refuse le filtre dans l'espace perso (SPACE_003)", async () => {
    const w = await world();
    const res = await w.asLea.get(`${recipesOf(w.lea.personalSpaceId)}/mine?addable=true`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SPACE_003");
  });
});

describe("apercu des sous-recettes (POST /add-mine/preview)", () => {
  it("liste les sous-recettes emportees, sans doublon ni celles deja la ou deja choisies", async () => {
    const w = await world();
    const perso = w.lea.personalSpaceId;
    const sauce = await createRecipe(w.asLea, perso, { title: "Sauce teriyaki", isBase: true });
    const bechamel = await createRecipe(w.asLea, w.famille.id, { title: "Bechamel", isBase: true });
    const pate = await createRecipe(w.asMatthias, w.famille.id, { title: "Pate", isBase: true });
    const dejaLa = await createRecipe(w.asLea, perso, { title: "Bouillon", isBase: true });
    await w.asLea.put(`${recipesOf(perso)}/${dejaLa.id}/shares`, { spaceIds: [w.coloc.id] });
    const saumon = await createRecipe(w.asLea, perso, {
      title: "Saumon teriyaki",
      blocks: [await link(sauce.id), await link(dejaLa.id)],
    });
    const poulet = await createRecipe(w.asLea, perso, {
      title: "Poulet teriyaki",
      blocks: [await link(sauce.id)],
    });
    const lasagnes = await createRecipe(w.asLea, w.famille.id, {
      title: "Lasagnes",
      blocks: [await link(bechamel.id), await link(pate.id)],
    });

    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/add-mine/preview`, {
      recipeIds: [saumon.id, poulet.id, lasagnes.id, bechamel.id],
    });
    expect(res.status).toBe(200);
    expect(res.body.withIt).toEqual([
      { id: sauce.id, title: "Sauce teriyaki", included: true },
      { id: pate.id, title: "Pate", included: false },
    ]);
  });
});

describe("ajout en lot (POST /add-mine)", () => {
  it("partage par reference les recettes choisies et leurs sous-recettes ; une ligne d'activite", async () => {
    const w = await world();
    const perso = w.lea.personalSpaceId;
    const sauce = await createRecipe(w.asLea, perso, { title: "Sauce teriyaki", isBase: true });
    const saumon = await createRecipe(w.asLea, perso, {
      title: "Saumon teriyaki",
      blocks: [await link(sauce.id)],
    });
    const dahl = await createRecipe(w.asLea, perso, { title: "Dahl" });
    const gratin = await createRecipe(w.asLea, w.famille.id, { title: "Gratin" });

    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/add-mine`, {
      recipeIds: [saumon.id, dahl.id, gratin.id],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ added: 3 });
    expect(await titlesIn(w.asMatthias, w.coloc.id)).toEqual([
      "Dahl",
      "Gratin",
      "Sauce teriyaki",
      "Saumon teriyaki",
    ]);
    // Meme recette, pas de copie.
    expect(await db.recipe.count({ where: { authorId: w.lea.id } })).toBe(4);
    const via = await db.recipeShare.findFirstOrThrow({
      where: { recipeId: sauce.id, spaceId: w.coloc.id },
    });
    expect(via).toMatchObject({ viaRecipeId: saumon.id, sharedById: w.lea.id });

    expect(await activityOf(w.coloc.id)).toEqual([
      {
        type: "recipes.recipes.added",
        actorId: w.lea.id,
        data: { count: 3, titles: ["Saumon teriyaki", "Dahl", "Gratin"] },
      },
    ]);
  });

  it("une seule recette : l'activite habituelle du partage", async () => {
    const w = await world();
    const dahl = await createRecipe(w.asLea, w.lea.personalSpaceId, { title: "Dahl" });
    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/add-mine`, { recipeIds: [dahl.id] });
    expect(res.body).toEqual({ added: 1 });
    expect((await activityOf(w.coloc.id)).map((e) => e.type)).toEqual(["recipes.recipe.shared"]);
  });

  it("une recette deja visible est ignoree ; rien de visible a ajouter = pas d'activite", async () => {
    const w = await world();
    const tarte = await createRecipe(w.asLea, w.coloc.id, { title: "Tarte" });
    const dahl = await createRecipe(w.asLea, w.lea.personalSpaceId, { title: "Dahl" });
    const first = await w.asLea.post(`${recipesOf(w.coloc.id)}/add-mine`, {
      recipeIds: [tarte.id, dahl.id],
    });
    expect(first.body).toEqual({ added: 1 });
    const again = await w.asLea.post(`${recipesOf(w.coloc.id)}/add-mine`, {
      recipeIds: [dahl.id],
    });
    expect(again.body).toEqual({ added: 0 });
    expect(await activityOf(w.coloc.id)).toHaveLength(2); // creation de Tarte + partage de Dahl
  });

  it("tout ou rien : une recette d'un autre, supprimee, masquee ou inconnue refuse tout", async () => {
    const w = await world();
    const perso = w.lea.personalSpaceId;
    const dahl = await createRecipe(w.asLea, perso, { title: "Dahl" });
    const poulet = await createRecipe(w.asMatthias, w.famille.id, { title: "Poulet" });
    const gone = await createRecipe(w.asLea, perso, { title: "Supprimee" });
    await db.recipe.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    const hidden = await createRecipe(w.asLea, perso, { title: "Masquee" });
    await db.recipe.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });

    for (const bad of [poulet.id, gone.id, hidden.id, NOT_FOUND_UUID]) {
      const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/add-mine`, {
        recipeIds: [dahl.id, bad],
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("RECIPE_001");
    }
    expect(await db.recipeShare.count({ where: { spaceId: w.coloc.id } })).toBe(0);
  });

  it("refuse une recette nee dans un espace que l'auteur a quitte", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.famille.id, { title: "Gratin" });
    await db.membership.update({
      where: { spaceId_userId: { spaceId: w.famille.id, userId: w.lea.id } },
      data: { leftAt: new Date() },
    });
    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/add-mine`, {
      recipeIds: [gratin.id],
    });
    expect(res.body.error.code).toBe("RECIPE_001");
  });

  it("valide la selection : 1 a 50 recettes, sans doublon ; espace perso refuse", async () => {
    const w = await world();
    const dahl = await createRecipe(w.asLea, w.lea.personalSpaceId, { title: "Dahl" });
    const url = `${recipesOf(w.coloc.id)}/add-mine`;
    expect((await w.asLea.post(url, { recipeIds: [] })).status).toBe(400);
    expect((await w.asLea.post(url, { recipeIds: [dahl.id, dahl.id] })).status).toBe(400);
    const many = Array.from({ length: 51 }, () => crypto.randomUUID());
    expect((await w.asLea.post(url, { recipeIds: many })).status).toBe(400);

    const perso = await w.asLea.post(`${recipesOf(w.lea.personalSpaceId)}/add-mine`, {
      recipeIds: [dahl.id],
    });
    expect(perso.body.error.code).toBe("SPACE_003");
    const preview = await w.asLea.post(`${recipesOf(w.lea.personalSpaceId)}/add-mine/preview`, {
      recipeIds: [dahl.id],
    });
    expect(preview.body.error.code).toBe("SPACE_003");
  });

  it("un non-membre recoit SPACE_001", async () => {
    const w = await world();
    const stranger = await createUser();
    const asStranger = await loginAs(stranger, app);
    const dahl = await createRecipe(asStranger, stranger.personalSpaceId, { title: "Dahl" });
    const res = await asStranger.post(`${recipesOf(w.coloc.id)}/add-mine`, {
      recipeIds: [dahl.id],
    });
    expect(res.body.error.code).toBe("SPACE_001");
  });
});

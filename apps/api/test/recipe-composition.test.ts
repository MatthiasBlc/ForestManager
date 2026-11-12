// Recettes composees (C3.4) : blocs lies a d'autres recettes, lien vivant, pas
// de boucle, 3 niveaux au plus, sous-recette supprimee ou invisible [D24, D107].
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, recipeBody, unitId } from "./helpers/recipes.ts";

const app = createTestApp();

async function setup() {
  const user = await createUser();
  const client = await loginAs(user, app);
  const base = `/spaces/${user.personalSpaceId}/recipes`;
  return { user, client, base, spaceId: user.personalSpaceId };
}

const link = async (recipeId: string, quantity = 150, unit: string | null = "ml") => ({
  kind: "RECIPE",
  recipeId,
  quantity,
  unitId: unit ? await unitId(unit) : null,
});

/** Recette dont le seul bloc lie `children` (portions). */
async function composed(client: Client, spaceId: string, children: string[], title = "Plat") {
  return createRecipe(client, spaceId, {
    title,
    blocks: await Promise.all(children.map((id) => link(id, 1, null))),
  });
}

describe("bloc lie (D24, D107)", () => {
  it("un plat lie une sauce : la sauce est depliee dans le plat, version actuelle", async () => {
    const { client, base, spaceId } = await setup();
    const sauce = await createRecipe(client, spaceId, {
      title: "Sauce teriyaki",
      isBase: true,
      yieldQuantity: 300,
      yieldUnitId: await unitId("ml"),
    });
    const plat = await createRecipe(client, spaceId, {
      title: "Saumon teriyaki",
      blocks: [await link(sauce.id), (await recipeBody(client)).blocks[0]],
    });

    const res = await client.get(`${base}/${plat.id}`);
    expect(res.status).toBe(200);
    expect(res.body.blocks[0]).toMatchObject({
      kind: "RECIPE",
      recipeId: sauce.id,
      quantity: 150,
      unitId: await unitId("ml"),
      status: "AVAILABLE",
      recipe: { id: sauce.id, title: "Sauce teriyaki", yieldQuantity: 300, isBase: true },
    });
    expect(res.body.blocks[0].recipe.blocks[0].steps).toEqual([
      "Cuire les pates.",
      "Gratiner 20 min.",
    ]);
    expect(res.body.blocks[1].kind).toBe("LOCAL");

    const list = await client.get(base);
    const summary = list.body.data.find((r: { id: string }) => r.id === plat.id);
    expect(summary.isComposed).toBe(true);
    expect((await client.get(`${base}/${sauce.id}`)).body.usedBy).toBe(1);

    // Lien vivant : corriger la sauce corrige le plat.
    await client.put(
      `${base}/${sauce.id}`,
      await recipeBody(client, { revision: 1, title: "Sauce teriyaki maison", yieldQuantity: 300 })
    );
    expect((await client.get(`${base}/${plat.id}`)).body.blocks[0].recipe.title).toBe(
      "Sauce teriyaki maison"
    );
  });

  it("deplie les sous-recettes sur 3 niveaux", async () => {
    const { client, base, spaceId } = await setup();
    const fond = await createRecipe(client, spaceId, { title: "Fond" });
    const sauce = await composed(client, spaceId, [fond.id], "Sauce");
    const plat = await composed(client, spaceId, [sauce.id], "Plat");
    const res = await client.get(`${base}/${plat.id}`);
    expect(res.body.blocks[0].recipe.blocks[0].recipe.title).toBe("Fond");
  });

  it("refuse un lien vers une recette inconnue ou d'un autre espace", async () => {
    const { user, client, base } = await setup();
    const other = await createSpace(user.id);
    const elsewhere = await createRecipe(client, other.id, { title: "Ailleurs" });
    for (const id of [elsewhere.id, "00000000-0000-4000-8000-000000000000"]) {
      const res = await client.post(base, await recipeBody(client, { blocks: [await link(id)] }));
      expect(res.body.error.code).toBe("VALIDATION_001");
    }
  });

  it("refuse une boucle : la recette elle-meme ou par une chaine (RECIPE_007)", async () => {
    const { client, base, spaceId } = await setup();
    const fond = await createRecipe(client, spaceId, { title: "Fond" });
    const sauce = await composed(client, spaceId, [fond.id], "Sauce");
    const self = await client.put(
      `${base}/${fond.id}`,
      await recipeBody(client, { revision: 1, blocks: [await link(fond.id, 1, null)] })
    );
    expect(self.body.error.code).toBe("RECIPE_007");
    const chain = await client.put(
      `${base}/${fond.id}`,
      await recipeBody(client, { revision: 1, blocks: [await link(sauce.id, 1, null)] })
    );
    expect(chain.body.error.code).toBe("RECIPE_007");
  });

  it("refuse plus de 3 niveaux, en comptant les recettes qui l'utilisent (RECIPE_008)", async () => {
    const { client, base, spaceId } = await setup();
    const os = await createRecipe(client, spaceId, { title: "Os" });
    const fond = await composed(client, spaceId, [os.id], "Fond");
    const sauce = await composed(client, spaceId, [fond.id], "Sauce");
    const tooDeep = await client.post(
      base,
      await recipeBody(client, { blocks: [await link(sauce.id, 1, null)] })
    );
    expect(tooDeep.body.error.code).toBe("RECIPE_008");

    // Os, utilisee a 3 niveaux, ne peut plus lier une autre recette.
    const extra = await createRecipe(client, spaceId, { title: "Extra" });
    const res = await client.put(
      `${base}/${os.id}`,
      await recipeBody(client, { revision: 1, blocks: [await link(extra.id, 1, null)] })
    );
    expect(res.body.error.code).toBe("RECIPE_008");
  });

  it("sous-recette supprimee : bloc DELETED, le plat reste modifiable avec ce lien", async () => {
    const { client, base, spaceId } = await setup();
    const sauce = await createRecipe(client, spaceId, { title: "Sauce" });
    const plat = await composed(client, spaceId, [sauce.id]);
    expect((await client.delete(`${base}/${sauce.id}`)).status).toBe(204);

    const res = await client.get(`${base}/${plat.id}`);
    expect(res.body.blocks[0]).toMatchObject({ status: "DELETED", recipe: null });
    const update = await client.put(
      `${base}/${plat.id}`,
      await recipeBody(client, {
        revision: 1,
        title: "Plat 2",
        blocks: [await link(sauce.id, 2, null)],
      })
    );
    expect(update.status).toBe(200);
    // Un nouveau lien vers une recette supprimee est refuse.
    const fresh = await client.post(
      base,
      await recipeBody(client, { blocks: [await link(sauce.id, 1, null)] })
    );
    expect(fresh.body.error.code).toBe("VALIDATION_001");
  });

  it("sous-recette invisible dans l'espace : bloc HIDDEN sans contenu", async () => {
    const { user, client, base, spaceId } = await setup();
    const sauce = await createRecipe(client, spaceId, { title: "Sauce" });
    const plat = await composed(client, spaceId, [sauce.id]);
    const other = await createSpace(user.id);
    await db.recipe.update({ where: { id: sauce.id }, data: { homeSpaceId: other.id } });
    const res = await client.get(`${base}/${plat.id}`);
    expect(res.body.blocks[0]).toMatchObject({
      status: "HIDDEN",
      recipe: null,
      recipeId: sauce.id,
    });
  });

  it("les revisions gardent les liens : historique et restauration", async () => {
    const { client, base, spaceId } = await setup();
    const sauce = await createRecipe(client, spaceId, { title: "Sauce" });
    const plat = await composed(client, spaceId, [sauce.id]);
    await client.put(
      `${base}/${plat.id}`,
      await recipeBody(client, {
        revision: 1,
        title: "Plat",
        blocks: [await link(sauce.id, 3, null)],
      })
    );
    const history = (await client.get(`${base}/${plat.id}/revisions`)).body.data;
    expect(history[0].changes).toEqual(["blocks"]);
    const restored = await client.post(`${base}/${plat.id}/revisions/1/restore`, { revision: 2 });
    expect(restored.status).toBe(200);
    expect(restored.body.blocks[0]).toMatchObject({ kind: "RECIPE", quantity: 1 });
  });
});

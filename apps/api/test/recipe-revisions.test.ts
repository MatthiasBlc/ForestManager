// Revisions d'une recette (C3.3) : historique avec les changements de chaque
// revision, restauration par une nouvelle revision [D05, D30, D55, F-REC-8].
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser } from "./helpers/factories.ts";
import { createRecipe, ingredient, recipeBody, unitId } from "./helpers/recipes.ts";
import { ACTORS, clientAs, expectPermission, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

describe("historique des revisions (F-REC-8)", () => {
  it("liste les revisions de la plus recente a la plus ancienne, avec leurs changements", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const recipe = await createRecipe(client, user.personalSpaceId);
    const path = `/spaces/${user.personalSpaceId}/recipes/${recipe.id}`;
    await client.put(
      path,
      await recipeBody(client, { revision: 1, title: "Gratin", cookMinutes: 40 })
    );
    await client.put(
      path,
      await recipeBody(client, {
        revision: 2,
        title: "Gratin",
        cookMinutes: 40,
        notes: "Au four chaud.",
        blocks: [
          {
            kind: "LOCAL",
            ingredients: [
              {
                ingredientId: await ingredient(client, "Pâtes"),
                quantity: 400,
                unitId: await unitId("g"),
              },
            ],
            steps: ["Cuire les pates.", "Gratiner 20 min."],
          },
        ],
      })
    );

    const res = await client.get(`${path}/revisions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject([
      { number: 3, source: "EDIT", changes: ["notes", "ingredients"] },
      { number: 2, source: "EDIT", changes: ["title", "times"] },
      { number: 1, source: "CREATE", changes: [] },
    ]);
    expect(res.body.data[0].author).toMatchObject({ id: user.id, username: user.username });
  });

  it("tout membre qui voit la recette voit son historique", async () => {
    const f = await groupFixture();
    const recipe = await createRecipe(await loginAs(f.member, app), f.spaceId);
    for (const actor of ACTORS) {
      const client = await clientAs(actor, f, app);
      const allowed = actor === "MEMBER" || actor === "MODERATOR" || actor === "OWNER";
      expectPermission(
        actor,
        allowed,
        await client.get(`/spaces/${f.spaceId}/recipes/${recipe.id}/revisions`)
      );
    }
  });

  it("recette inconnue ou supprimee : RECIPE_001", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const base = `/spaces/${user.personalSpaceId}/recipes`;
    expect(
      (await client.get(`${base}/00000000-0000-4000-8000-000000000000/revisions`)).body.error.code
    ).toBe("RECIPE_001");
    const recipe = await createRecipe(client, user.personalSpaceId);
    await client.delete(`${base}/${recipe.id}`);
    expect((await client.get(`${base}/${recipe.id}/revisions`)).body.error.code).toBe("RECIPE_001");
  });
});

describe("restaurer une revision (D55)", () => {
  it("cree une revision RESTORE avec le contenu restaure, sans rien effacer", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const recipe = await createRecipe(client, user.personalSpaceId);
    const path = `/spaces/${user.personalSpaceId}/recipes/${recipe.id}`;
    await client.put(
      path,
      await recipeBody(client, {
        revision: 1,
        title: "Gratin rate",
        blocks: [{ kind: "LOCAL", ingredients: [], steps: ["Oublier au four."] }],
      })
    );

    const res = await client.post(`${path}/revisions/1/restore`, { revision: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Gratin de pates", currentRevision: 3 });
    expect(res.body.blocks[0].steps).toEqual(["Cuire les pates.", "Gratiner 20 min."]);
    expect(res.body.blocks[0].ingredients.map((l: { name: string }) => l.name)).toEqual([
      "Pâtes",
      "Sel",
    ]);
    const history = (await client.get(`${path}/revisions`)).body.data;
    expect(history.map((r: { number: number; source: string }) => [r.number, r.source])).toEqual([
      [3, "RESTORE"],
      [2, "EDIT"],
      [1, "CREATE"],
    ]);
  });

  it("garde les tags actuels (ils ne font pas partie des revisions, D19)", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const recipe = await createRecipe(client, user.personalSpaceId);
    const path = `/spaces/${user.personalSpaceId}/recipes/${recipe.id}`;
    const tag = await db.tag.findFirstOrThrow({ where: { scope: "GLOBAL" } });
    await client.put(path, await recipeBody(client, { revision: 1, globalTagIds: [tag.id] }));
    const res = await client.post(`${path}/revisions/1/restore`, { revision: 2 });
    expect(res.body.tags.map((t: { id: string }) => t.id)).toEqual([tag.id]);
  });

  it("un ingredient fusionne depuis est remplace par sa cible (D120)", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const recipe = await createRecipe(client, user.personalSpaceId);
    const path = `/spaces/${user.personalSpaceId}/recipes/${recipe.id}`;
    await client.put(path, await recipeBody(client, { revision: 1, title: "Autre" }));
    const salt = await ingredient(client, "Sel");
    const target = await ingredient(client, "Sel fin");
    await db.ingredient.update({ where: { id: salt }, data: { mergedIntoId: target } });
    const res = await client.post(`${path}/revisions/1/restore`, { revision: 2 });
    expect(res.status).toBe(200);
    expect(res.body.blocks[0].ingredients[1].ingredientId).toBe(target);
  });

  it("refuse une revision de depart depassee (RECIPE_004)", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const recipe = await createRecipe(client, user.personalSpaceId);
    const path = `/spaces/${user.personalSpaceId}/recipes/${recipe.id}`;
    await client.put(path, await recipeBody(client, { revision: 1, title: "Autre" }));
    const res = await client.post(`${path}/revisions/1/restore`, { revision: 1 });
    expect(res.body.error.code).toBe("RECIPE_004");
  });

  it("refuse la revision actuelle (RECIPE_005) et une revision inconnue (RECIPE_006)", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const recipe = await createRecipe(client, user.personalSpaceId);
    const path = `/spaces/${user.personalSpaceId}/recipes/${recipe.id}`;
    expect(
      (await client.post(`${path}/revisions/1/restore`, { revision: 1 })).body.error.code
    ).toBe("RECIPE_005");
    expect(
      (await client.post(`${path}/revisions/9/restore`, { revision: 1 })).body.error.code
    ).toBe("RECIPE_006");
  });

  it("meme droit que modifier : un membre non auteur refuse, un moderateur accepte", async () => {
    const f = await groupFixture();
    const author = await loginAs(f.member, app);
    const recipe = await createRecipe(author, f.spaceId);
    const path = `/spaces/${f.spaceId}/recipes/${recipe.id}`;
    await author.put(path, await recipeBody(author, { revision: 1, title: "Autre" }));
    const extra = await loginAs(f.extra, app);
    expect((await extra.post(`${path}/revisions/1/restore`, { revision: 2 })).body.error.code).toBe(
      "SPACE_002"
    );
    const moderator = await loginAs(f.moderator, app);
    const res = await moderator.post(`${path}/revisions/1/restore`, { revision: 2 });
    expect(res.status).toBe(200);
    const last = await db.recipeRevision.findFirstOrThrow({
      where: { recipeId: recipe.id, number: 3 },
    });
    expect(last.authorId).toBe(f.moderator.id);
  });
});

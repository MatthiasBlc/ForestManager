// Recettes simples (C3.2) : creer, lire, modifier, supprimer, lister avec
// recherche, filtres, tri et pagination ; tags poses sur une recette.
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createUser } from "./helpers/factories.ts";
import { createRecipe, ingredient, recipeBody, unitId } from "./helpers/recipes.ts";
import { ACTORS, clientAs, expectPermission, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

async function globalTagId(name: string): Promise<string> {
  const tag = await db.tag.findFirstOrThrow({
    where: { scope: "GLOBAL", translations: { some: { name } } },
  });
  return tag.id;
}

describe("creer et lire une recette (F-REC-1, F-REC-4)", () => {
  it("un membre cree une recette : revision 1, bloc local, ingredients nommes", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const res = await member.post(
      `/spaces/${f.spaceId}/recipes`,
      await recipeBody(member, { notes: "Meilleur le lendemain." })
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Gratin de pates",
      homeSpaceId: f.spaceId,
      author: { id: f.member.id, username: f.member.username },
      yieldQuantity: 4,
      yieldUnitId: null,
      prepMinutes: 15,
      cookMinutes: 30,
      restMinutes: null,
      totalMinutes: 45,
      isBase: false,
      notes: "Meilleur le lendemain.",
      currentRevision: 1,
      can: { edit: true, delete: true },
    });
    const [block] = res.body.blocks;
    expect(block).toMatchObject({
      kind: "LOCAL",
      title: null,
      steps: ["Cuire les pates.", "Gratiner 20 min."],
    });
    expect(block.ingredients).toEqual([
      expect.objectContaining({ name: "Pâtes", quantity: 500, optional: false }),
      expect.objectContaining({ name: "Sel", quantity: null }),
    ]);

    const revision = await db.recipeRevision.findFirstOrThrow({ where: { recipeId: res.body.id } });
    expect(revision).toMatchObject({ number: 1, source: "CREATE", authorId: f.member.id });
    expect(revision.snapshot).toMatchObject({ title: "Gratin de pates" });

    const other = await loginAs(f.extra, app);
    const read = await other.get(`/spaces/${f.spaceId}/recipes/${res.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ id: res.body.id, can: { edit: false, delete: false } });
  });

  it("un ingredient fusionne est remplace par sa cible a l'enregistrement (D120)", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const target = await ingredient(client, "Courgette");
    const alias = await ingredient(client, "Zucchini");
    await db.ingredient.update({
      where: { id: alias },
      data: { status: "MERGED", mergedIntoId: target },
    });
    const res = await client.post(
      `/spaces/${user.personalSpaceId}/recipes`,
      await recipeBody(client, {
        blocks: [
          {
            kind: "LOCAL",
            ingredients: [{ ingredientId: alias, quantity: 2, unitId: null }],
            steps: [],
          },
        ],
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.blocks[0].ingredients[0]).toMatchObject({
      ingredientId: target,
      name: "Courgette",
    });
  });

  it("refuse un contenu invalide : titre vide, ingredient ou unite inconnus, bloc lie", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const path = `/spaces/${user.personalSpaceId}/recipes`;
    const unknown = "00000000-0000-4000-8000-000000000000";
    const cases = [
      { title: " " },
      { yieldQuantity: 0 },
      { prepMinutes: -1 },
      { sourceUrl: "javascript:alert(1)" },
      { blocks: [] },
      {
        blocks: [
          {
            kind: "LOCAL",
            ingredients: [{ ingredientId: unknown, quantity: 1, unitId: null }],
            steps: [],
          },
        ],
      },
      {
        blocks: [
          {
            kind: "LOCAL",
            ingredients: [
              { ingredientId: await ingredient(client, "Riz"), quantity: 1, unitId: unknown },
            ],
            steps: [],
          },
        ],
      },
      { blocks: [{ kind: "RECIPE", subRecipeId: unknown, subQuantity: 1 }] },
      { globalTagIds: [unknown] },
    ];
    for (const overrides of cases) {
      const res = await client.post(path, await recipeBody(client, overrides));
      expect(res.body.error?.code, JSON.stringify(overrides)).toBe("VALIDATION_001");
    }
  });

  it("une recette d'un autre espace ou supprimee est introuvable ici", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const elsewhere = await createRecipe(owner, f.owner.personalSpaceId);
    expect((await owner.get(`/spaces/${f.spaceId}/recipes/${elsewhere.id}`)).body.error.code).toBe(
      "RECIPE_001"
    );
    const outsider = await loginAs(f.outsider, app);
    const mine = await createRecipe(owner, f.spaceId);
    expect((await outsider.get(`/spaces/${f.spaceId}/recipes/${mine.id}`)).body.error.code).toBe(
      "SPACE_001"
    );
  });

  for (const actor of ACTORS) {
    const allowed = actor === "MEMBER" || actor === "MODERATOR" || actor === "OWNER";
    it(`creer une recette dans un groupe - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await groupFixture();
      const helper = await loginAs(f.owner, app);
      const body = await recipeBody(helper);
      const client = await clientAs(actor, f, app);
      expectPermission(actor, allowed, await client.post(`/spaces/${f.spaceId}/recipes`, body));
    });
  }
});

describe("modifier une recette (D05, D57, D122)", () => {
  it("l'auteur modifie : nouvelle revision EDIT, blocs remplaces", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const recipe = await createRecipe(member, f.spaceId);
    const res = await member.put(
      `/spaces/${f.spaceId}/recipes/${recipe.id}`,
      await recipeBody(member, {
        revision: 1,
        title: "Gratin du dimanche",
        yieldQuantity: 6,
        isBase: true,
        blocks: [
          {
            kind: "LOCAL",
            title: "Pate",
            ingredients: [
              {
                ingredientId: await ingredient(member, "Farine"),
                quantity: 250,
                unitId: await unitId("g"),
              },
            ],
            steps: ["Petrir."],
          },
          { kind: "LOCAL", title: "Garniture", ingredients: [], steps: ["Garnir."] },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: "Gratin du dimanche",
      yieldQuantity: 6,
      isBase: true,
      currentRevision: 2,
    });
    expect(res.body.blocks.map((b: { title: string }) => b.title)).toEqual(["Pate", "Garniture"]);
    const revisions = await db.recipeRevision.findMany({
      where: { recipeId: recipe.id },
      orderBy: { number: "asc" },
    });
    expect(revisions.map((r) => [r.number, r.source])).toEqual([
      [1, "CREATE"],
      [2, "EDIT"],
    ]);
  });

  it("refuse une modification faite sur une revision depassee (RECIPE_004)", async () => {
    const user = await createUser();
    const client = await loginAs(user, app);
    const recipe = await createRecipe(client, user.personalSpaceId);
    const path = `/spaces/${user.personalSpaceId}/recipes/${recipe.id}`;
    expect((await client.put(path, await recipeBody(client, { revision: 1 }))).status).toBe(200);
    expect(
      (await client.put(path, await recipeBody(client, { revision: 1 }))).body.error.code
    ).toBe("RECIPE_004");
  });

  it("un membre non auteur ne modifie pas ; un moderateur de l'espace d'origine oui", async () => {
    const f = await groupFixture();
    const author = await loginAs(f.member, app);
    const recipe = await createRecipe(author, f.spaceId);
    const path = `/spaces/${f.spaceId}/recipes/${recipe.id}`;
    const extra = await loginAs(f.extra, app);
    expect((await extra.put(path, await recipeBody(extra, { revision: 1 }))).body.error.code).toBe(
      "SPACE_002"
    );
    const moderator = await loginAs(f.moderator, app);
    const read = await moderator.get(path);
    expect(read.body.can).toEqual({
      edit: true,
      delete: false,
      share: false,
      removeFromSpace: false,
    });
    expect((await moderator.put(path, await recipeBody(moderator, { revision: 1 }))).status).toBe(
      200
    );
  });
});

describe("supprimer une recette (F-REC-10, D57)", () => {
  it("l'auteur supprime : la recette disparait de la liste et du detail", async () => {
    const f = await groupFixture();
    const member = await loginAs(f.member, app);
    const recipe = await createRecipe(member, f.spaceId);
    const path = `/spaces/${f.spaceId}/recipes/${recipe.id}`;
    expect((await member.delete(path)).status).toBe(204);
    expect((await member.get(path)).body.error.code).toBe("RECIPE_001");
    expect((await member.get(`/spaces/${f.spaceId}/recipes`)).body.data).toEqual([]);
    const row = await db.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(row.deletedAt).not.toBeNull();
  });

  it("un moderateur ne supprime que si l'auteur n'est plus membre", async () => {
    const f = await groupFixture();
    const author = await loginAs(f.member, app);
    const recipe = await createRecipe(author, f.spaceId);
    const path = `/spaces/${f.spaceId}/recipes/${recipe.id}`;
    const moderator = await loginAs(f.moderator, app);
    expect((await moderator.delete(path)).body.error.code).toBe("SPACE_002");
    expect((await (await loginAs(f.extra, app)).delete(path)).body.error.code).toBe("SPACE_002");
    await db.membership.update({
      where: { spaceId_userId: { spaceId: f.spaceId, userId: f.member.id } },
      data: { leftAt: new Date() },
    });
    expect((await moderator.get(path)).body.can).toEqual({
      edit: true,
      delete: true,
      share: true,
      removeFromSpace: false,
    });
    expect((await moderator.delete(path)).status).toBe(204);
  });
});

describe("liste, recherche, filtres et tri (F-REC-11)", () => {
  async function library() {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const member = await loginAs(f.member, app);
    const quick = await owner.post(`/spaces/${f.spaceId}/recipes/tags`, { name: "Semaine" });
    const veggie = await globalTagId("Végétarien");
    const lentils = await ingredient(owner, "Lentilles corail");
    const local = (ingredientId: string) => [
      { kind: "LOCAL", ingredients: [{ ingredientId, quantity: 200, unitId: null }], steps: [] },
    ];
    const dahl = await createRecipe(owner, f.spaceId, {
      title: "Dahl de lentilles",
      prepMinutes: 10,
      cookMinutes: 25,
      globalTagIds: [veggie],
      spaceTagIds: [quick.body.id],
      blocks: local(lentils),
    });
    const tarte = await createRecipe(member, f.spaceId, {
      title: "Tarte aux pommes",
      prepMinutes: 20,
      cookMinutes: 35,
      globalTagIds: [veggie],
    });
    const sauce = await createRecipe(owner, f.spaceId, {
      title: "Sauce tériyaki",
      prepMinutes: 5,
      cookMinutes: 5,
      isBase: true,
      spaceTagIds: [quick.body.id],
    });
    const salade = await createRecipe(member, f.spaceId, {
      title: "Salade de lentilles",
      prepMinutes: null,
      cookMinutes: null,
      blocks: local(lentils),
    });
    return {
      f,
      owner,
      member,
      ids: { dahl: dahl.id, tarte: tarte.id, sauce: sauce.id, salade: salade.id },
      quick: quick.body.id as string,
      veggie,
      lentils,
    };
  }

  const titles = (res: { body: { data: { title: string }[] } }) =>
    res.body.data.map((r) => r.title);

  it("liste les recettes de l'espace, les plus recentes d'abord, avec un resume", async () => {
    const { f, owner } = await library();
    const res = await owner.get(`/spaces/${f.spaceId}/recipes`);
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual([
      "Salade de lentilles",
      "Sauce tériyaki",
      "Tarte aux pommes",
      "Dahl de lentilles",
    ]);
    expect(res.body.nextCursor).toBeNull();
    const dahl = res.body.data.find((r: { title: string }) => r.title === "Dahl de lentilles");
    expect(dahl).toMatchObject({
      yieldQuantity: 4,
      totalMinutes: 35,
      isBase: false,
      isComposed: false,
      author: { id: f.owner.id },
      tags: expect.arrayContaining([
        expect.objectContaining({ scope: "GLOBAL", name: "Végétarien" }),
        expect.objectContaining({ scope: "SPACE", name: "Semaine" }),
      ]),
    });
  });

  it("recherche sans casse ni accents, filtre par tag, ingredient, temps, auteur, base", async () => {
    const { f, owner, quick, veggie, lentils } = await library();
    const list = (query: string) => owner.get(`/spaces/${f.spaceId}/recipes?${query}`);
    expect(titles(await list("q=TERIYAKI"))).toEqual(["Sauce tériyaki"]);
    expect(titles(await list("q=lentil&sort=title"))).toEqual([
      "Dahl de lentilles",
      "Salade de lentilles",
    ]);
    expect(titles(await list(`tagIds=${veggie}&sort=title`))).toEqual([
      "Dahl de lentilles",
      "Tarte aux pommes",
    ]);
    expect(titles(await list(`tagIds=${veggie},${quick}`))).toEqual(["Dahl de lentilles"]);
    expect(titles(await list(`ingredientIds=${lentils}&sort=title`))).toEqual([
      "Dahl de lentilles",
      "Salade de lentilles",
    ]);
    expect(titles(await list("maxMinutes=40&sort=time"))).toEqual([
      "Sauce tériyaki",
      "Dahl de lentilles",
    ]);
    expect(titles(await list(`authorId=${f.member.id}&sort=title`))).toEqual([
      "Salade de lentilles",
      "Tarte aux pommes",
    ]);
    expect(titles(await list("base=true"))).toEqual(["Sauce tériyaki"]);
    expect(titles(await list("sort=time"))).toEqual([
      "Sauce tériyaki",
      "Dahl de lentilles",
      "Tarte aux pommes",
      "Salade de lentilles",
    ]);
    expect((await list("sort=nope")).body.error.code).toBe("VALIDATION_001");
    expect((await list("tagIds=nope")).body.error.code).toBe("VALIDATION_001");
  });

  it("pagine par curseur sans doublon ni oubli, quel que soit le tri", async () => {
    const { f, owner } = await library();
    for (const sort of ["recent", "title", "time"]) {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const query: string = `limit=3&sort=${sort}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
        const res = await owner.get(`/spaces/${f.spaceId}/recipes?${query}`);
        expect(res.status).toBe(200);
        seen.push(...titles(res));
        cursor = res.body.nextCursor as string | null;
      } while (cursor);
      expect(seen, sort).toHaveLength(4);
      expect(new Set(seen).size).toBe(4);
    }
    expect((await owner.get(`/spaces/${f.spaceId}/recipes?cursor=garbage`)).body.error.code).toBe(
      "VALIDATION_001"
    );
  });

  it("un non-membre ne liste pas ; un espace sans recette renvoie une liste vide", async () => {
    const { f } = await library();
    const outsider = await loginAs(f.outsider, app);
    expect((await outsider.get(`/spaces/${f.spaceId}/recipes`)).body.error.code).toBe("SPACE_001");
    expect((await outsider.get(`/spaces/${f.outsider.personalSpaceId}/recipes`)).body).toEqual({
      data: [],
      nextCursor: null,
    });
  });
});

describe("tags d'une recette (D19)", () => {
  it("tout membre pose les tags d'espace ; la fusion d'un tag suit sur les recettes", async () => {
    const f = await groupFixture();
    const author = await loginAs(f.member, app);
    const recipe = await createRecipe(author, f.spaceId);
    const extra = await loginAs(f.extra, app);
    const tags = `/spaces/${f.spaceId}/recipes/tags`;
    const hiver = (await extra.post(tags, { name: "Hiver" })).body.id as string;
    const froid = (await extra.post(tags, { name: "Froid" })).body.id as string;
    const path = `/spaces/${f.spaceId}/recipes/${recipe.id}/space-tags`;
    const res = await extra.put(path, { tagIds: [hiver, froid] });
    expect(res.status).toBe(200);
    expect(res.body.tags.map((t: { name: string }) => t.name).sort()).toEqual(["Froid", "Hiver"]);

    const moderator = await loginAs(f.moderator, app);
    expect((await moderator.post(`${tags}/${froid}/merge`, { intoTagId: hiver })).status).toBe(204);
    const read = await extra.get(`/spaces/${f.spaceId}/recipes/${recipe.id}`);
    expect(read.body.tags.map((t: { name: string }) => t.name)).toEqual(["Hiver"]);

    const otherSpaceTag = await loginAs(f.outsider, app).then((c) =>
      c.post(`/spaces/${f.outsider.personalSpaceId}/recipes/tags`, { name: "Ailleurs" })
    );
    expect((await extra.put(path, { tagIds: [otherSpaceTag.body.id] })).body.error.code).toBe(
      "VALIDATION_001"
    );
  });

  it("les tags globaux suivent les droits de modification", async () => {
    const f = await groupFixture();
    const author = await loginAs(f.member, app);
    const veggie = await globalTagId("Végétarien");
    const recipe = await createRecipe(author, f.spaceId, { globalTagIds: [veggie] });
    const read = await author.get(`/spaces/${f.spaceId}/recipes/${recipe.id}`);
    expect(read.body.tags).toEqual([expect.objectContaining({ id: veggie, scope: "GLOBAL" })]);
    expect(
      (
        await (
          await loginAs(f.extra, app)
        ).put(`/spaces/${f.spaceId}/recipes/${recipe.id}/space-tags`, { tagIds: [veggie] })
      ).body.error.code
    ).toBe("VALIDATION_001");
  });
});

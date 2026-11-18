// Familles de tags [D216] : familles d'espace gerees par les moderateurs, tag
// d'espace range dans une famille, catalogue des tags d'un espace (familles
// globales puis d'espace, tags avec leur famille et leur nombre de recettes).
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createSpace } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";
import { groupFixture } from "./helpers/roles.ts";

const app = createTestApp();
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

interface Family {
  id: string;
  scope: string;
  name: string;
}

interface CatalogTag {
  id: string;
  scope: string;
  name: string;
  familyId: string | null;
  recipeCount: number;
}

describe("familles d'espace (moderateurs)", () => {
  it("cree en fin de liste, renomme, nom pris, reordonne, supprime", async () => {
    const f = await groupFixture();
    const moderator = await loginAs(f.moderator, app);
    const base = `/spaces/${f.spaceId}/recipes/tag-families`;

    const category = await moderator.post(base, { name: "Categorie" });
    expect(category.status).toBe(201);
    expect(category.body).toMatchObject({ scope: "SPACE", name: "Categorie" });
    const tier = (await moderator.post(base, { name: "Palier" })).body as Family;
    expect((await moderator.post(base, { name: "  catégorie " })).body.error.code).toBe(
      "RECIPE_019"
    );

    const renamed = await moderator.patch(`${base}/${tier.id}`, { name: "Paliers" });
    expect(renamed.body).toMatchObject({ id: tier.id, name: "Paliers" });
    expect(
      (await moderator.patch(`${base}/${tier.id}`, { name: "Categorie" })).body.error.code
    ).toBe("RECIPE_019");

    const ordered = await moderator.put(`${base}/order`, { ids: [tier.id, category.body.id] });
    expect(ordered.status).toBe(200);
    expect(ordered.body.data.map((x: Family) => x.id)).toEqual([tier.id, category.body.id]);
    expect((await moderator.put(`${base}/order`, { ids: [tier.id] })).body.error.code).toBe(
      "RECIPE_020"
    );

    expect((await moderator.delete(`${base}/${tier.id}`)).status).toBe(204);
    expect((await moderator.delete(`${base}/${tier.id}`)).body.error.code).toBe("RECIPE_018");

    // Une famille d'un autre espace est introuvable ici.
    const elsewhere = await createSpace(f.moderator.id);
    const foreign = (
      await moderator.post(`/spaces/${elsewhere.id}/recipes/tag-families`, { name: "Saison" })
    ).body as Family;
    expect((await moderator.patch(`${base}/${foreign.id}`, { name: "X" })).body.error.code).toBe(
      "RECIPE_018"
    );
  });

  it("range un tag d'espace dans une famille de cet espace seulement", async () => {
    const f = await groupFixture();
    const moderator = await loginAs(f.moderator, app);
    const base = `/spaces/${f.spaceId}/recipes`;
    const tier = (await moderator.post(`${base}/tag-families`, { name: "Palier" })).body as Family;
    const tag = (await moderator.post(`${base}/tags`, { name: "Incontournable" })).body as {
      id: string;
    };

    const moved = await moderator.patch(`${base}/tags/${tag.id}`, { familyId: tier.id });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ id: tag.id, name: "Incontournable" });
    expect((await db.tag.findUniqueOrThrow({ where: { id: tag.id } })).familyId).toBe(tier.id);

    // Renommer sans familyId ne change pas la famille.
    await moderator.patch(`${base}/tags/${tag.id}`, { name: "Indispensable" });
    expect((await db.tag.findUniqueOrThrow({ where: { id: tag.id } })).familyId).toBe(tier.id);

    const elsewhere = await createSpace(f.moderator.id);
    const foreign = (
      await moderator.post(`/spaces/${elsewhere.id}/recipes/tag-families`, { name: "Saison" })
    ).body as Family;
    for (const familyId of [foreign.id, UNKNOWN]) {
      expect((await moderator.patch(`${base}/tags/${tag.id}`, { familyId })).body.error.code).toBe(
        "RECIPE_018"
      );
    }
    expect((await moderator.patch(`${base}/tags/${tag.id}`, {})).body.error.code).toBe(
      "VALIDATION_001"
    );

    // Supprimer la famille laisse le tag sans famille.
    await moderator.delete(`${base}/tag-families/${tier.id}`);
    expect((await db.tag.findUniqueOrThrow({ where: { id: tag.id } })).familyId).toBeNull();
    await moderator.patch(`${base}/tags/${tag.id}`, { familyId: null });
  });
});

describe("catalogue des tags d'un espace", () => {
  it("familles globales puis d'espace ; tags avec famille et recettes visibles ici", async () => {
    const f = await groupFixture();
    const owner = await loginAs(f.owner, app);
    const member = await loginAs(f.member, app);
    const base = `/spaces/${f.spaceId}/recipes`;

    const global = await db.tagFamily.create({
      data: { scope: "GLOBAL", name: "Saison", sortOrder: 0 },
    });
    await db.tagFamilyTranslation.create({
      data: { familyId: global.id, locale: "fr", name: "Saison" },
    });
    const veggie = await db.tag.findFirstOrThrow({
      where: { scope: "GLOBAL", slug: "vegetarien" },
    });
    await db.tag.update({ where: { id: veggie.id }, data: { familyId: global.id } });
    const tier = (await owner.post(`${base}/tag-families`, { name: "Palier" })).body as Family;
    const must = (await owner.post(`${base}/tags`, { name: "Incontournable" })).body.id as string;
    await owner.patch(`${base}/tags/${must}`, { familyId: tier.id });
    const unused = (await owner.post(`${base}/tags`, { name: "A tester" })).body.id as string;

    // Deux recettes ici (une nee ici, une partagee), une supprimee, une ailleurs.
    const here = await createRecipe(member, f.spaceId, { globalTagIds: [veggie.id] });
    await member.put(`${base}/${here.id}/space-tags`, { tagIds: [must] });
    const home = await createSpace(f.member.id);
    const shared = await createRecipe(member, home.id, { globalTagIds: [veggie.id] });
    await member.put(`/spaces/${home.id}/recipes/${shared.id}/shares`, { spaceIds: [f.spaceId] });
    await member.put(`${base}/${shared.id}/space-tags`, { tagIds: [must] });
    const gone = await createRecipe(member, f.spaceId, { globalTagIds: [veggie.id] });
    await member.delete(`${base}/${gone.id}`);
    await createRecipe(member, home.id, { globalTagIds: [veggie.id] });

    const res = await member.get(`${base}/tag-catalog`);
    expect(res.status).toBe(200);
    expect(res.body.families).toEqual([
      { id: global.id, scope: "GLOBAL", name: "Saison" },
      { id: tier.id, scope: "SPACE", name: "Palier" },
    ]);
    const tags = res.body.tags as CatalogTag[];
    expect(tags.find((t) => t.id === veggie.id)).toEqual({
      id: veggie.id,
      scope: "GLOBAL",
      name: "Végétarien",
      familyId: global.id,
      recipeCount: 2,
    });
    expect(tags.find((t) => t.id === must)).toMatchObject({ familyId: tier.id, recipeCount: 2 });
    expect(tags.find((t) => t.id === unused)).toMatchObject({ familyId: null, recipeCount: 0 });
    // Seuls les tags d'espace de cet espace.
    expect(
      tags
        .filter((t) => t.scope === "SPACE")
        .map((t) => t.id)
        .sort()
    ).toEqual([must, unused].sort());
  });
});

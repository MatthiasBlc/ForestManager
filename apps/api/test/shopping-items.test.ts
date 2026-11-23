// Liste de courses (C9) : articles a la main, section favorite d'un produit,
// fusion par produit et par section, coches (hors ligne comprises), ordre,
// retirer les achetes et Annuler [D228, D231].
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { grantModule } from "./helpers/factories.ts";
import { ingredient, unitId } from "./helpers/recipes.ts";
import { groupFixture } from "./helpers/roles.ts";

const app = createTestApp();
const NOT_FOUND = "00000000-0000-4000-8000-000000000000";

beforeAll(async () => {
  await db.module.update({ where: { code: "shopping" }, data: { status: "AVAILABLE" } });
});

interface Section {
  id: string;
  name: string;
  aisleId: string | null;
}

async function setup() {
  const f = await groupFixture();
  await grantModule(f.spaceId, "shopping");
  const member = await loginAs(f.member, app);
  const base = `/spaces/${f.spaceId}/shopping`;
  const list = await member.get(base);
  const sections = list.body.sections as Section[];
  return { f, member, base, sections };
}

/** Ingredient du catalogue range dans le rayon de `section`. */
async function ingredientIn(client: Client, name: string, section: Section | undefined) {
  const id = await ingredient(client, name);
  if (section?.aisleId)
    await db.ingredient.update({ where: { id }, data: { aisleId: section.aisleId } });
  return id;
}

async function items(client: Client, base: string) {
  return (await client.get(base)).body.items as {
    id: string;
    sectionId: string | null;
    label: string | null;
    ingredient: { id: string; name: string } | null;
    parts: { quantity: number; unitId: string | null }[];
    sortOrder: number;
    checkedAt: string | null;
    checkedBy: { id: string } | null;
  }[];
}

describe("articles a la main (D228)", () => {
  it("texte libre sans quantite, dans Autres ; ingredient dans la section de son rayon", async () => {
    const { member, base, sections } = await setup();
    const produce = sections[0];
    const pepper = await ingredientIn(member, "Poivron", produce);

    const sponge = await member.post(`${base}/items`, { label: "Éponge" });
    expect(sponge.status).toBe(201);
    expect(sponge.body).toMatchObject({
      label: "Éponge",
      ingredient: null,
      sectionId: null,
      parts: [],
      checkedAt: null,
      sources: [],
    });

    const piece = await unitId("piece");
    const res = await member.post(`${base}/items`, {
      ingredientId: pepper,
      parts: [{ quantity: 2, unitId: piece }],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ingredient: { id: pepper, name: "poivron" },
      label: null,
      sectionId: produce?.id,
      parts: [{ quantity: 2, unitId: piece }],
    });
  });

  it("additionne sur la ligne non cochee du meme produit dans la meme section", async () => {
    const { member, base, sections } = await setup();
    const pepper = await ingredientIn(member, "Poivron", sections[0]);
    const piece = await unitId("piece");
    const g = await unitId("g");
    const first = await member.post(`${base}/items`, {
      ingredientId: pepper,
      parts: [{ quantity: 2, unitId: piece }],
    });
    const second = await member.post(`${base}/items`, {
      ingredientId: pepper,
      parts: [
        { quantity: 1, unitId: piece },
        { quantity: 200, unitId: g },
      ],
    });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.parts).toEqual([
      { quantity: 200, unitId: g },
      { quantity: 3, unitId: piece },
    ]);
    await member.post(`${base}/items`, { label: "lait" });
    const merged = await member.post(`${base}/items`, { label: "LAIT " });
    expect(merged.status).toBe(200);
    expect((await items(member, base)).length).toBe(2);
  });

  it("refuse un ingredient ou une unite inconnus, et une liste pleine", async () => {
    const { member, base } = await setup();
    expect((await member.post(`${base}/items`, { ingredientId: NOT_FOUND })).body.error.code).toBe(
      "SHOPPING_008"
    );
    expect(
      (
        await member.post(`${base}/items`, {
          label: "lait",
          parts: [{ quantity: 1, unitId: NOT_FOUND }],
        })
      ).body.error.code
    ).toBe("SHOPPING_008");

    const space = (await db.shoppingSettings.findFirstOrThrow({ orderBy: { updatedAt: "desc" } }))
      .spaceId;
    await db.shoppingItem.createMany({
      data: Array.from({ length: 300 }, (_, i) => ({
        spaceId: space,
        label: `article ${i}`,
        productKey: `label:article ${i}`,
      })),
    });
    expect((await member.post(`${base}/items`, { label: "un de trop" })).body.error.code).toBe(
      "SHOPPING_007"
    );
  });
});

describe("section favorite d'un produit (D231)", () => {
  it("le premier deplacement fixe la favorite ; ensuite deplacer ne change que la ligne", async () => {
    const { member, base, sections } = await setup();
    const [produce, other, third] = sections;
    if (!produce || !other || !third) throw new Error("sections expected");
    const pepper = await ingredientIn(member, "Poivron", produce);

    const item = await member.post(`${base}/items`, { ingredientId: pepper });
    const moved = await member.patch(`${base}/items/${item.body.id}`, { sectionId: other.id });
    expect(moved.status).toBe(200);
    expect(moved.body.sectionId).toBe(other.id);
    await member.delete(`${base}/items/${item.body.id}`);

    const again = await member.post(`${base}/items`, { ingredientId: pepper });
    expect(again.body.sectionId).toBe(other.id);

    // Favorite deja fixee : l'ecart de la semaine ne la change pas.
    await member.patch(`${base}/items/${again.body.id}`, { sectionId: third.id });
    await member.delete(`${base}/items/${again.body.id}`);
    expect((await member.post(`${base}/items`, { ingredientId: pepper })).body.sectionId).toBe(
      other.id
    );
  });

  it("'Toujours ranger ici' change la favorite ; un texte libre aussi a la sienne", async () => {
    const { member, base, sections } = await setup();
    const [first, second] = sections;
    if (!first || !second) throw new Error("sections expected");
    const item = await member.post(`${base}/items`, { label: "Piles" });
    await member.patch(`${base}/items/${item.body.id}`, { sectionId: first.id });
    const res = await member.patch(`${base}/items/${item.body.id}`, {
      sectionId: second.id,
      rememberSection: true,
    });
    expect(res.body.sectionId).toBe(second.id);
    await member.delete(`${base}/items/${item.body.id}`);
    expect((await member.post(`${base}/items`, { label: "piles" })).body.sectionId).toBe(second.id);
  });

  it("un produit peut etre sur deux lignes, une par section", async () => {
    const { member, base, sections } = await setup();
    const [produce, other] = sections;
    if (!produce || !other) throw new Error("sections expected");
    const pepper = await ingredientIn(member, "Poivron", produce);
    const piece = await unitId("piece");

    // Favorite : primeur. Cette semaine, une ligne part dans une autre section.
    const first = await member.post(`${base}/items`, {
      ingredientId: pepper,
      parts: [{ quantity: 1, unitId: piece }],
    });
    await member.patch(`${base}/items/${first.body.id}`, {
      sectionId: other.id,
    });
    await member.patch(`${base}/items/${first.body.id}`, {
      sectionId: produce.id,
      rememberSection: true,
    });
    await member.patch(`${base}/items/${first.body.id}`, { sectionId: other.id });
    const second = await member.post(`${base}/items`, {
      ingredientId: pepper,
      parts: [{ quantity: 2, unitId: piece }],
    });
    expect(second.status).toBe(201);
    expect(second.body.sectionId).toBe(produce.id);
    const list = await items(member, base);
    expect(list.map((i) => [i.sectionId, i.parts[0]?.quantity])).toEqual([
      [other.id, 1],
      [produce.id, 2],
    ]);
  });

  it("section supprimee : ses articles vont dans Autres, sa favorite est oubliee", async () => {
    const { member, base, sections } = await setup();
    const [first, second] = sections;
    if (!first || !second) throw new Error("sections expected");
    const item = await member.post(`${base}/items`, { label: "Piles" });
    await member.patch(`${base}/items/${item.body.id}`, { sectionId: second.id });
    await member.delete(`${base}/sections/${second.id}`);
    expect((await items(member, base))[0]?.sectionId).toBeNull();
    expect(await db.shoppingPlacement.count({ where: { sectionId: second.id } })).toBe(0);

    const missing = await member.patch(`${base}/items/${item.body.id}`, { sectionId: second.id });
    expect(missing.body.error.code).toBe("SHOPPING_002");
  });
});

describe("coches (D228)", () => {
  it("cocher et decocher, par qui", async () => {
    const { f, member, base } = await setup();
    const item = await member.post(`${base}/items`, { label: "lait" });
    const checked = await member.patch(`${base}/items/${item.body.id}`, { checked: true });
    expect(checked.body.checkedAt).not.toBeNull();
    expect(checked.body.checkedBy).toMatchObject({ id: f.member.id });
    const unchecked = await member.patch(`${base}/items/${item.body.id}`, { checked: false });
    expect(unchecked.body).toMatchObject({ checkedAt: null, checkedBy: null });
  });

  it("une coche hors ligne plus ancienne que la derniere est ignoree", async () => {
    const { member, base } = await setup();
    const item = await member.post(`${base}/items`, { label: "lait" });
    const url = `${base}/items/${item.body.id}`;
    await member.patch(url, { checked: true, checkedChangedAt: "2026-11-23T10:05:00.000Z" });
    const stale = await member.patch(url, {
      checked: false,
      checkedChangedAt: "2026-11-23T10:00:00.000Z",
    });
    expect(stale.status).toBe(200);
    expect(stale.body.checkedAt).not.toBeNull();
    const fresh = await member.patch(url, {
      checked: false,
      checkedChangedAt: "2026-11-23T10:06:00.000Z",
    });
    expect(fresh.body.checkedAt).toBeNull();
  });

  it("article d'un autre espace ou supprime : introuvable", async () => {
    const { member, base } = await setup();
    const other = await setup();
    const item = await other.member.post(`${other.base}/items`, { label: "lait" });
    expect(
      (await member.patch(`${base}/items/${item.body.id}`, { checked: true })).body.error.code
    ).toBe("SHOPPING_001");
    expect((await member.delete(`${base}/items/${NOT_FOUND}`)).body.error.code).toBe(
      "SHOPPING_001"
    );
  });

  it("modifie les quantites d'un article", async () => {
    const { member, base } = await setup();
    const item = await member.post(`${base}/items`, { label: "lait" });
    const res = await member.patch(`${base}/items/${item.body.id}`, {
      parts: [{ quantity: 2, unitId: null }],
    });
    expect(res.body.parts).toEqual([{ quantity: 2, unitId: null }]);
  });
});

describe("ordre dans une section (D228)", () => {
  it("nouvel article en fin de section ; ordre complet de la section", async () => {
    const { member, base } = await setup();
    const a = (await member.post(`${base}/items`, { label: "a" })).body.id as string;
    const b = (await member.post(`${base}/items`, { label: "b" })).body.id as string;
    const c = (await member.post(`${base}/items`, { label: "c" })).body.id as string;
    expect((await items(member, base)).map((i) => i.id)).toEqual([a, b, c]);

    const res = await member.put(`${base}/items/order`, { sectionId: null, ids: [c, a, b] });
    expect(res.status).toBe(204);
    expect((await items(member, base)).map((i) => i.id)).toEqual([c, a, b]);

    const partial = await member.put(`${base}/items/order`, { sectionId: null, ids: [c, a] });
    expect(partial.body.error.code).toBe("SHOPPING_005");
  });
});

describe("retirer les achetes, puis Annuler (D228)", () => {
  it("retire les articles coches et les restaure tels quels", async () => {
    const { member, base, sections } = await setup();
    const produce = sections[0];
    const pepper = await ingredientIn(member, "Poivron", produce);
    const piece = await unitId("piece");
    const kept = await member.post(`${base}/items`, { label: "lait" });
    const bought = await member.post(`${base}/items`, {
      ingredientId: pepper,
      parts: [{ quantity: 2, unitId: piece }],
    });
    await member.patch(`${base}/items/${bought.body.id}`, { checked: true });

    const cleared = await member.post(`${base}/checked/clear`);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.map((i: { id: string }) => i.id)).toEqual([bought.body.id]);
    expect((await items(member, base)).map((i) => i.id)).toEqual([kept.body.id]);

    const removed = cleared.body.data[0];
    const restored = await member.post(`${base}/items/restore`, {
      items: [
        {
          id: removed.id,
          sectionId: removed.sectionId,
          ingredientId: removed.ingredient.id,
          label: null,
          parts: removed.parts,
          sortOrder: removed.sortOrder,
          checkedAt: removed.checkedAt,
          sources: [],
        },
      ],
    });
    expect(restored.status).toBe(200);
    const list = await items(member, base);
    expect(list.find((i) => i.id === bought.body.id)).toMatchObject({
      sectionId: produce?.id,
      parts: [{ quantity: 2, unitId: piece }],
      checkedAt: removed.checkedAt,
    });
    // Restaurer deux fois ne double rien.
    await member.post(`${base}/items/restore`, {
      items: [
        {
          id: removed.id,
          sectionId: removed.sectionId,
          ingredientId: removed.ingredient.id,
          label: null,
          parts: removed.parts,
          sortOrder: removed.sortOrder,
          checkedAt: removed.checkedAt,
          sources: [],
        },
      ],
    });
    expect((await items(member, base)).length).toBe(2);
  });
});

describe("droit de modifier (D141)", () => {
  it("editRole MODERATOR : un membre lit mais ne coche pas", async () => {
    const { f, member, base } = await setup();
    const item = await member.post(`${base}/items`, { label: "lait" });
    const owner = await loginAs(f.owner, app);
    await owner.put(`${base}/settings`, { editRole: "MODERATOR" });
    expect((await member.get(base)).status).toBe(200);
    expect(
      (await member.patch(`${base}/items/${item.body.id}`, { checked: true })).body.error.code
    ).toBe("SPACE_002");
  });
});

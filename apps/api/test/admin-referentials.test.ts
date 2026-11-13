// Admin, C4.3 : referentiels. Ingredients (A05) et fusion (A05b, D120), unites (A06),
// rayons (A07, D125), tags globaux (A08). Unites et rayons ne sont pas vides entre
// deux fichiers de test : ce fichier rend l'etat d'origine a la fin.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seed } from "../prisma/seed.ts";
import { createClient, createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { createAdmin, loginAdmin, type TestAdmin } from "./helpers/admin.ts";
import { db } from "./helpers/db.ts";
import { createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, unitId } from "./helpers/recipes.ts";

const app = createTestApp();
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

let admin: TestAdmin;
/** Une seule connexion : un code TOTP ne sert qu'une fois (D174). */
let client: Client;
let member: Client;
let spaceId: string;
let initialAisles: { id: string; sortOrder: number }[];
let initialUnitIds: string[];

beforeAll(async () => {
  admin = await createAdmin();
  client = await loginAdmin(admin, app);
  const user = await createUser();
  member = await loginAs(user, app);
  spaceId = (await createSpace(user.id)).id;
  initialAisles = await db.aisle.findMany({ select: { id: true, sortOrder: true } });
  initialUnitIds = (await db.unit.findMany({ select: { id: true } })).map((u) => u.id);
});

afterAll(async () => {
  await db.unit.deleteMany({ where: { id: { notIn: initialUnitIds } } });
  await db.aisle.deleteMany({ where: { id: { notIn: initialAisles.map((a) => a.id) } } });
  for (const { id, sortOrder } of initialAisles) {
    await db.aisle.update({ where: { id }, data: { sortOrder } });
  }
});

async function lastAudit() {
  return db.adminAuditLog.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: "desc" },
  });
}

/** Ingredient cree par un membre (NEW), utilise dans une recette si `recipeTitle`. */
async function memberIngredient(name: string, recipeTitle?: string) {
  const id = (await member.post("/ingredients", { name })).body.id as string;
  if (recipeTitle) {
    await createRecipe(member, spaceId, {
      title: recipeTitle,
      blocks: [
        {
          kind: "LOCAL",
          ingredients: [{ ingredientId: id, quantity: 2, unitId: await unitId("piece") }],
          steps: ["Melanger."],
        },
      ],
    });
  }
  return id;
}

async function verified(name: string) {
  const res = await client.post("/admin/ingredients", { fr: { name } });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

function fullBody(overrides: Record<string, unknown> = {}) {
  return {
    fr: { name: "x", namePlural: null },
    en: null,
    aisleId: null,
    defaultUnitId: null,
    unitWeights: [],
    ...overrides,
  };
}

describe("acces aux routes", () => {
  it("toutes les routes de C4.3 demandent une session admin complete", async () => {
    const anonymous = await createClient(app);
    const calls = [
      anonymous.get("/admin/ingredients"),
      anonymous.post("/admin/ingredients", { fr: { name: "a" } }),
      anonymous.get(`/admin/ingredients/${UNKNOWN}`),
      anonymous.put(`/admin/ingredients/${UNKNOWN}`, fullBody()),
      anonymous.post(`/admin/ingredients/${UNKNOWN}/merge`, { intoId: UNKNOWN }),
      anonymous.get("/admin/units"),
      anonymous.post("/admin/units", {}),
      anonymous.patch(`/admin/units/${UNKNOWN}`, {}),
      anonymous.get("/admin/aisles"),
      anonymous.post("/admin/aisles", { fr: "a" }),
      anonymous.patch(`/admin/aisles/${UNKNOWN}`, { fr: "a" }),
      anonymous.put("/admin/aisles/order", { ids: [UNKNOWN] }),
      anonymous.get("/admin/tags"),
      anonymous.post("/admin/tags", { fr: "a" }),
      anonymous.patch(`/admin/tags/${UNKNOWN}`, { fr: "a" }),
      anonymous.post(`/admin/tags/${UNKNOWN}/merge`, { intoTagId: UNKNOWN }),
      anonymous.delete(`/admin/tags/${UNKNOWN}`),
    ];
    for (const res of await Promise.all(calls)) expect(res.body.error.code).toBe("ADMIN_002");
    // Une session utilisateur ne donne aucun droit admin.
    expect((await member.get("/admin/ingredients")).body.error.code).toBe("ADMIN_002");
  });
});

describe("ingredients (A05)", () => {
  it("liste les nouveaux avec createur, recettes et doublon probable ; compteurs des onglets", async () => {
    const target = await verified("tomate cerise");
    const dup = await memberIngredient("tomates cerises", "Compotee de tomates cerises");
    const other = await memberIngredient("sumac");

    const res = await client.get("/admin/ingredients?tab=NEW");
    expect(res.status).toBe(200);
    const byId = new Map(res.body.data.map((i: { id: string }) => [i.id, i]));
    expect(byId.get(dup)).toMatchObject({
      name: "tomates cerises",
      status: "NEW",
      recipeCount: 1,
      probableDuplicate: true,
    });
    expect(byId.get(other)).toMatchObject({ probableDuplicate: false, recipeCount: 0 });
    expect(byId.has(target)).toBe(false);
    expect(res.body.counts.NEW).toBeGreaterThanOrEqual(2);
    expect(res.body.total).toBe(res.body.counts.NEW);

    const verifiedTab = await client.get("/admin/ingredients?tab=VERIFIED&query=TOMATE");
    expect(verifiedTab.body.data.map((i: { id: string }) => i.id)).toEqual([target]);
  });

  it("onglets sans traduction et sans rayon ; recherche aussi par le nom anglais", async () => {
    const id = await verified("cebette");
    const untranslated = await client.get("/admin/ingredients?tab=UNTRANSLATED&query=cebette");
    expect(untranslated.body.data.map((i: { id: string }) => i.id)).toEqual([id]);
    const aisle = await db.aisle.findFirstOrThrow();
    await client.put(
      `/admin/ingredients/${id}`,
      fullBody({ fr: { name: "cébette" }, en: { name: "spring onion" }, aisleId: aisle.id })
    );
    expect(
      (await client.get("/admin/ingredients?tab=UNTRANSLATED&query=cebette")).body.data
    ).toEqual([]);
    expect((await client.get("/admin/ingredients?tab=NO_AISLE&query=cebette")).body.data).toEqual(
      []
    );
    const byEnglish = await client.get("/admin/ingredients?query=spring");
    expect(byEnglish.body.data.map((i: { id: string }) => i.id)).toEqual([id]);
  });

  it("detail : noms, recettes, ressemblants et doublon probable", async () => {
    const target = await verified("poivron rouge");
    const id = await memberIngredient("poivrons rouges", "Piperade");
    const res = await client.get(`/admin/ingredients/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "NEW",
      fr: { name: "poivrons rouges", namePlural: null },
      en: null,
      recipeCount: 1,
      recipes: [{ title: "Piperade" }],
      duplicateOfId: target,
    });
    expect(res.body.similar[0]).toMatchObject({ id: target, status: "ACTIVE", recipeCount: 0 });
    expect((await client.get(`/admin/ingredients/${UNKNOWN}`)).body.error.code).toBe("ADMIN_008");
  });

  it("ajoute un ingredient verifie ; nom deja pris refuse ; audit", async () => {
    const res = await client.post("/admin/ingredients", {
      fr: { name: "Kecap manis" },
      en: { name: "Kecap manis" },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "ACTIVE", en: { name: "Kecap manis" } });
    expect(await lastAudit()).toMatchObject({
      action: "ingredient.created",
      targetType: "ingredient",
      targetId: res.body.id,
    });
    const again = await client.post("/admin/ingredients", { fr: { name: "kécap  MANIS" } });
    expect(again.body.error.code).toBe("ADMIN_009");
  });

  it("enregistre noms, rayon, unite par defaut et poids ; marque comme verifie", async () => {
    const id = await memberIngredient("oeuf");
    const aisle = await db.aisle.findFirstOrThrow({ where: { code: "dairy" } });
    const piece = await unitId("piece");
    const body = fullBody({
      fr: { name: "œuf", namePlural: "œufs" },
      en: { name: "egg", namePlural: "eggs" },
      aisleId: aisle.id,
      defaultUnitId: piece,
      unitWeights: [{ unitId: piece, grams: 60 }],
    });
    const saved = await client.put(`/admin/ingredients/${id}`, body);
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      status: "NEW",
      fr: { name: "œuf", namePlural: "œufs" },
      en: { name: "egg", namePlural: "eggs" },
      aisleId: aisle.id,
      defaultUnitId: piece,
      unitWeights: [{ unitId: piece, grams: 60 }],
    });
    expect(await lastAudit()).toMatchObject({ action: "ingredient.updated", targetId: id });
    // La saisie des membres retrouve l'ingredient par son nouveau nom.
    expect((await member.post("/ingredients", { name: "Oeuf" })).body.id).toBe(id);

    const done = await client.put(`/admin/ingredients/${id}`, {
      ...body,
      en: null,
      unitWeights: [],
      verify: true,
    });
    expect(done.body).toMatchObject({ status: "ACTIVE", en: null, unitWeights: [] });
    expect(await lastAudit()).toMatchObject({ action: "ingredient.verified", targetId: id });
  });

  it("refuse un nom pris, un rayon inconnu, un poids sur une unite qui n'est pas une piece", async () => {
    const id = await memberIngredient("navet");
    await verified("carotte");
    const put = (overrides: Record<string, unknown>) =>
      client.put(`/admin/ingredients/${id}`, fullBody({ fr: { name: "navet" }, ...overrides }));
    expect((await put({ fr: { name: "Carotte" } })).body.error.code).toBe("ADMIN_009");
    expect((await put({ aisleId: UNKNOWN })).body.error.code).toBe("ADMIN_011");
    expect((await put({ defaultUnitId: UNKNOWN })).body.error.code).toBe("ADMIN_011");
    const g = await unitId("g");
    expect((await put({ unitWeights: [{ unitId: g, grams: 3 }] })).body.error.code).toBe(
      "ADMIN_011"
    );
    expect((await client.put(`/admin/ingredients/${UNKNOWN}`, fullBody())).body.error.code).toBe(
      "ADMIN_008"
    );
  });
});

describe("fusion d'ingredients (A05b, D120)", () => {
  it("repointe les recettes, garde les quantites, laisse un synonyme ; audit", async () => {
    const target = await verified("courgette");
    const source = await memberIngredient("courgettes", "Tian");
    const older = await memberIngredient("zucchini");
    // "zucchini" a deja ete fusionne dans "courgettes" : il suit la nouvelle cible.
    await client.post(`/admin/ingredients/${older}/merge`, { intoId: source });

    const res = await client.post(`/admin/ingredients/${source}/merge`, { intoId: target });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: target, recipeCount: 1 });
    expect(res.body.synonyms).toEqual(expect.arrayContaining(["courgettes", "zucchini"]));

    const line = await db.recipeIngredient.findFirstOrThrow({ where: { ingredientId: target } });
    expect(line.quantity).toBe(2);
    expect(await db.recipeIngredient.count({ where: { ingredientId: source } })).toBe(0);
    expect(await db.ingredient.findUniqueOrThrow({ where: { id: source } })).toMatchObject({
      status: "MERGED",
      mergedIntoId: target,
    });
    expect((await db.ingredient.findUniqueOrThrow({ where: { id: older } })).mergedIntoId).toBe(
      target
    );
    expect(await lastAudit()).toMatchObject({
      action: "ingredient.merged",
      targetId: source,
      data: { intoId: target, recipeCount: 1 },
    });
    // La saisie propose encore le synonyme et le remplace par la cible.
    expect((await member.post("/ingredients", { name: "Courgettes" })).body).toMatchObject({
      id: target,
    });
    // Un ingredient fusionne n'apparait plus dans les listes.
    expect((await client.get("/admin/ingredients?query=courgettes")).body.data).toEqual([
      expect.objectContaining({ id: target }),
    ]);
  });

  it("refuse la fusion dans soi-meme, dans un fusionne ou d'un fusionne", async () => {
    const a = await memberIngredient("blette");
    const b = await memberIngredient("blettes");
    const c = await verified("bette");
    expect(
      (await client.post(`/admin/ingredients/${a}/merge`, { intoId: a })).body.error.code
    ).toBe("ADMIN_010");
    await client.post(`/admin/ingredients/${b}/merge`, { intoId: c });
    expect(
      (await client.post(`/admin/ingredients/${a}/merge`, { intoId: b })).body.error.code
    ).toBe("ADMIN_010");
    expect(
      (await client.post(`/admin/ingredients/${b}/merge`, { intoId: a })).body.error.code
    ).toBe("ADMIN_010");
    expect(
      (await client.post(`/admin/ingredients/${a}/merge`, { intoId: UNKNOWN })).body.error.code
    ).toBe("ADMIN_008");
  });
});

describe("unites (A06)", () => {
  it("liste les unites avec francais et anglais", async () => {
    const res = await client.get("/admin/units");
    expect(res.status).toBe(200);
    expect(res.body.data).toContainEqual(
      expect.objectContaining({
        code: "tbsp",
        dimension: "VOLUME",
        toBase: 15,
        fr: expect.objectContaining({ abbreviation: "c. à soupe" }),
      })
    );
  });

  it("ajoute et modifie une unite ; code pris refuse ; regle du facteur ; audit", async () => {
    const body = {
      code: "punnet",
      dimension: "COUNT",
      toBase: null,
      fr: { name: "barquette", namePlural: "barquettes", abbreviation: "barq." },
      en: { name: "punnet", abbreviation: "punnet" },
    };
    const created = await client.post("/admin/units", body);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "punnet", metric: false, en: { namePlural: null } });
    expect(await lastAudit()).toMatchObject({ action: "unit.created", targetId: created.body.id });
    expect((await client.post("/admin/units", body)).body.error.code).toBe("ADMIN_009");
    expect(
      (await client.post("/admin/units", { ...body, code: "bowl", toBase: 250 })).body.error.code
    ).toBe("VALIDATION_001");

    const updated = await client.patch(`/admin/units/${created.body.id}`, {
      dimension: "VOLUME",
      toBase: 250,
      fr: { name: "bol", abbreviation: "bol" },
      en: null,
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      code: "punnet",
      dimension: "VOLUME",
      toBase: 250,
      fr: { name: "bol", namePlural: null },
      en: null,
    });
    expect(await lastAudit()).toMatchObject({ action: "unit.updated" });
    // Les membres voient le nouveau nom.
    const units = (await member.get("/units")).body.data as { code: string; name: string }[];
    expect(units.find((u) => u.code === "punnet")?.name).toBe("bol");
    expect(
      (
        await client.patch(`/admin/units/${UNKNOWN}`, {
          dimension: "NONE",
          toBase: null,
          fr: { name: "a", abbreviation: "a" },
        })
      ).body.error.code
    ).toBe("ADMIN_008");
  });
});

describe("rayons (A07, D125)", () => {
  it("liste dans l'ordre du parcours avec le nombre d'ingredients et les sans rayon", async () => {
    await memberIngredient("panais");
    const res = await client.get("/admin/aisles");
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      code: "fruits-vegetables",
      fr: "Fruits et légumes",
      en: null,
    });
    expect(res.body.unclassifiedCount).toBeGreaterThanOrEqual(1);
  });

  it("ajoute en fin de liste, traduit, reordonne ; audit", async () => {
    const created = await client.post("/admin/aisles", { fr: "Bio et vrac", en: "Organic" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "bio-et-vrac", en: "Organic", ingredientCount: 0 });
    expect(await lastAudit()).toMatchObject({ action: "aisle.created" });
    const list = (await client.get("/admin/aisles")).body.data as { id: string }[];
    expect(list.at(-1)?.id).toBe(created.body.id);

    const renamed = await client.patch(`/admin/aisles/${created.body.id}`, { fr: "Vrac", en: "" });
    expect(renamed.body).toMatchObject({ fr: "Vrac", en: null, code: "bio-et-vrac" });
    expect(await lastAudit()).toMatchObject({ action: "aisle.updated" });

    const ids = list.map((a) => a.id).reverse();
    const ordered = await client.put("/admin/aisles/order", { ids });
    expect(ordered.status).toBe(200);
    expect(ordered.body.data.map((a: { id: string }) => a.id)).toEqual(ids);
    expect(await lastAudit()).toMatchObject({ action: "aisle.reordered" });
    expect((await client.put("/admin/aisles/order", { ids: ids.slice(1) })).body.error.code).toBe(
      "ADMIN_012"
    );
  });
});

describe("tags globaux (A08)", () => {
  async function tagRecipe(tagIds: string[], title: string) {
    return createRecipe(member, spaceId, { title, globalTagIds: tagIds });
  }

  it("liste avec traduction et nombre de recettes ; cree, renomme, nom pris ; audit", async () => {
    const created = await client.post("/admin/tags", { fr: "Sans lactose" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ fr: "Sans lactose", en: null, recipeCount: 0 });
    expect(await lastAudit()).toMatchObject({ action: "tag.created" });
    await tagRecipe([created.body.id], "Riz au lait vegetal");
    const list = (await client.get("/admin/tags")).body.data as { id: string }[];
    expect(list.find((t) => t.id === created.body.id)).toMatchObject({ recipeCount: 1 });

    const renamed = await client.patch(`/admin/tags/${created.body.id}`, {
      fr: "Sans lait",
      en: "Dairy-free",
    });
    expect(renamed.body).toMatchObject({ fr: "Sans lait", en: "Dairy-free" });
    expect(await lastAudit()).toMatchObject({ action: "tag.updated" });
    const memberTags = (await member.get("/tags")).body.data as { name: string }[];
    expect(memberTags.map((t) => t.name)).toContain("Sans lait");
    expect((await client.post("/admin/tags", { fr: "sans LAIT" })).body.error.code).toBe(
      "ADMIN_009"
    );
    expect(
      (await client.patch(`/admin/tags/${created.body.id}`, { fr: "Dessert" })).body.error.code
    ).toBe("ADMIN_009");
  });

  it("fusionne (deplace les recettes) et supprime (retire de toutes les recettes)", async () => {
    const a = (await client.post("/admin/tags", { fr: "Express" })).body.id as string;
    const b = (await client.post("/admin/tags", { fr: "Minute" })).body.id as string;
    const c = (await client.post("/admin/tags", { fr: "Ephemere" })).body.id as string;
    await tagRecipe([a], "Omelette");
    await tagRecipe([a, b], "Croque");

    const merged = await client.post(`/admin/tags/${a}/merge`, { intoTagId: b });
    expect(merged.status).toBe(200);
    expect(merged.body).toMatchObject({ id: b, recipeCount: 2 });
    expect(await lastAudit()).toMatchObject({ action: "tag.merged", targetId: a });
    const ids = ((await client.get("/admin/tags")).body.data as { id: string }[]).map((t) => t.id);
    expect(ids).not.toContain(a);
    expect((await client.post(`/admin/tags/${b}/merge`, { intoTagId: a })).body.error.code).toBe(
      "ADMIN_010"
    );

    await tagRecipe([c], "Tarte");
    expect((await client.delete(`/admin/tags/${c}`)).status).toBe(204);
    expect(await db.recipeGlobalTag.count({ where: { tagId: c } })).toBe(0);
    expect(await lastAudit()).toMatchObject({ action: "tag.deleted", targetId: c });
    expect((await client.delete(`/admin/tags/${c}`)).body.error.code).toBe("ADMIN_008");
  });
});

describe("seed relance sur une base modifiee par l'admin", () => {
  it("ne reecrit ni ne recree rien", async () => {
    const tbsp = await db.unit.findUniqueOrThrow({ where: { code: "tbsp" } });
    await client.patch(`/admin/units/${tbsp.id}`, {
      dimension: "VOLUME",
      toBase: 14.8,
      fr: { name: "grande cuillere", abbreviation: "c. s." },
    });
    const produce = await db.aisle.findUniqueOrThrow({ where: { code: "fruits-vegetables" } });
    await client.patch(`/admin/aisles/${produce.id}`, { fr: "Primeur" });
    const tags = (await client.get("/admin/tags")).body.data as { id: string; fr: string }[];
    const quick = tags.find((t) => t.fr === "Rapide");
    const starter = tags.find((t) => t.fr === "Entrée");
    if (!quick || !starter) throw new Error("seed tags missing");
    await client.patch(`/admin/tags/${quick.id}`, { fr: "Vite fait" });
    await client.delete(`/admin/tags/${starter.id}`);

    await seed(db);

    const unit = await client.get("/admin/units");
    expect(unit.body.data.find((u: { code: string }) => u.code === "tbsp")).toMatchObject({
      toBase: 14.8,
      fr: { name: "grande cuillere", abbreviation: "c. s." },
    });
    const aisles = (await client.get("/admin/aisles")).body.data as { code: string; fr: string }[];
    expect(aisles.find((a) => a.code === "fruits-vegetables")?.fr).toBe("Primeur");
    const after = ((await client.get("/admin/tags")).body.data as { fr: string }[]).map(
      (t) => t.fr
    );
    expect(after).toContain("Vite fait");
    expect(after).not.toContain("Rapide");
    expect(after).not.toContain("Entrée");

    // Etat d'origine pour les fichiers suivants (unites et rayons ne sont pas vides).
    await db.unitTranslation.update({
      where: { unitId_locale: { unitId: tbsp.id, locale: "fr" } },
      data: {
        name: "cuillère à soupe",
        namePlural: "cuillères à soupe",
        abbreviation: "c. à soupe",
      },
    });
    await db.unit.update({ where: { id: tbsp.id }, data: { toBase: 15 } });
    await db.aisleTranslation.update({
      where: { aisleId_locale: { aisleId: produce.id, locale: "fr" } },
      data: { name: "Fruits et légumes" },
    });
  });
});

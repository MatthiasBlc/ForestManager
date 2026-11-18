// Reimport d'un export de recettes dans l'espace courant [D192, D225] : aller-retour
// export -> import, sous-recettes reliees, unites et ingredients inconnus, tout ou rien.
import {
  recipeSchema,
  recipesExportSchema,
  type ExportedRecipe,
  type Recipe,
  type RecipeBlock,
} from "@fm/shared";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, ingredient, unitId } from "./helpers/recipes.ts";

const app = createTestApp();

const recipesOf = (spaceId: string) => `/spaces/${spaceId}/recipes`;

/** Exporte l'espace en JSON et relit `recettes.json` comme le ferait le navigateur. */
async function exportSpace(client: Client, spaceId: string): Promise<ExportedRecipe[]> {
  const created = await client.post("/me/exports", { scope: "SPACE", spaceId, format: "JSON" });
  expect(created.status).toBe(202);
  const id = created.body.id as string;
  for (let i = 0; i < 100; i++) {
    const status = (await client.get(`/me/exports/${id}`)).body.status as string;
    if (status !== "PENDING") break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const res = await client.agent
    .get(`/api/v1/me/exports/${id}/download`)
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        callback(null, Buffer.concat(chunks));
      });
    });
  const files = unzipSync(new Uint8Array(res.body as Buffer));
  return recipesExportSchema.parse(JSON.parse(strFromU8(files["recettes.json"]!))).recipes;
}

function exported(ref: string, extra: Partial<ExportedRecipe> = {}): ExportedRecipe {
  return {
    ref,
    title: `Recette ${ref}`,
    description: null,
    author: "quelqu_un",
    space: "Ailleurs",
    isBase: false,
    yield: { quantity: 4, unit: null },
    prepMinutes: null,
    cookMinutes: null,
    restMinutes: null,
    tags: [],
    blocks: [{ kind: "LOCAL", title: null, ingredients: [], steps: ["Servir."] }],
    notes: null,
    sourceUrl: null,
    photo: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...extra,
  };
}

async function world() {
  const [lea, sam] = await Promise.all([createUser(), createUser()]);
  const famille = await createSpace(lea.id, { name: "Famille" });
  const coloc = await createSpace(lea.id, { name: "Coloc" });
  await addMember(coloc.id, sam.id);
  const [asLea, asSam] = await Promise.all([loginAs(lea, app), loginAs(sam, app)]);
  return { lea, sam, famille, coloc, asLea, asSam };
}

async function detail(client: Client, spaceId: string, recipeId: string): Promise<Recipe> {
  const res = await client.get(`${recipesOf(spaceId)}/${recipeId}`);
  expect(res.status).toBe(200);
  return recipeSchema.parse(res.body);
}

function local(block: RecipeBlock | undefined) {
  if (block?.kind !== "LOCAL") throw new Error("bloc LOCAL attendu");
  return block;
}

describe("POST /import-export", () => {
  it("aller-retour : les recettes renaissent dans l'espace courant, liees entre elles", async () => {
    const w = await world();
    const veggie = await db.tag.findFirstOrThrow({
      where: { scope: "GLOBAL", translations: { some: { name: "Végétarien" } } },
    });
    const dimanche = await w.asLea.post(`${recipesOf(w.famille.id)}/tags`, { name: "Du dimanche" });
    const sauce = await createRecipe(w.asLea, w.famille.id, {
      title: "Sauce tomate",
      isBase: true,
      yieldQuantity: 500,
      yieldUnitId: await unitId("ml"),
      globalTagIds: [veggie.id],
      spaceTagIds: [dimanche.body.id],
    });
    await createRecipe(w.asLea, w.famille.id, {
      title: "Lasagnes",
      notes: "Meilleures le lendemain.",
      sourceUrl: "https://example.org/lasagnes",
      blocks: [
        { kind: "RECIPE", recipeId: sauce.id, quantity: 300, unitId: await unitId("ml") },
        {
          kind: "LOCAL",
          title: "Montage",
          ingredients: [
            {
              ingredientId: await ingredient(w.asLea, "Pâtes à lasagne"),
              quantity: 12,
              unitId: await unitId("piece"),
              note: "precuites",
            },
          ],
          steps: ["Alterner les couches."],
        },
      ],
    });
    const recipes = await exportSpace(w.asLea, w.famille.id);

    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/import-export`, { recipes });
    expect(res.status).toBe(201);
    const created = res.body.data as { ref: string; recipeId: string }[];
    expect(created.map((c) => c.ref)).toEqual(recipes.map((r) => r.ref));
    const idOf = (title: string) =>
      created.find((c) => c.ref === recipes.find((r) => r.title === title)!.ref)!.recipeId;

    const newSauce = await detail(w.asLea, w.coloc.id, idOf("Sauce tomate"));
    expect(newSauce).toMatchObject({
      title: "Sauce tomate",
      isBase: true,
      yieldQuantity: 500,
      author: { username: w.lea.username },
      homeSpace: { id: w.coloc.id },
      currentRevision: 1,
    });
    // Tag global retrouve ; tag d'espace recree dans l'espace courant [D216].
    const tags = newSauce.tags;
    expect(tags.filter((t) => t.scope === "GLOBAL").map((t) => t.id)).toEqual([veggie.id]);
    const spaceTags = tags.filter((t) => t.scope === "SPACE");
    expect(spaceTags.map((t) => t.name)).toEqual(["Du dimanche"]);
    expect(spaceTags[0]!.id).not.toBe(dimanche.body.id);

    const lasagnes = await detail(w.asLea, w.coloc.id, idOf("Lasagnes"));
    expect(lasagnes).toMatchObject({
      notes: "Meilleures le lendemain.",
      sourceUrl: "https://example.org/lasagnes",
    });
    expect(lasagnes.blocks[0]).toMatchObject({
      kind: "RECIPE",
      quantity: 300,
      recipe: { id: idOf("Sauce tomate") },
    });
    expect(lasagnes.blocks[1]).toMatchObject({
      kind: "LOCAL",
      title: "Montage",
      steps: ["Alterner les couches."],
    });
    expect(local(lasagnes.blocks[1]).ingredients[0]).toMatchObject({
      name: "pâtes à lasagne",
      quantity: 12,
      note: "precuites",
    });
    const revision = await db.recipeRevision.findFirstOrThrow({
      where: { recipeId: idOf("Lasagnes") },
    });
    expect(revision).toMatchObject({ number: 1, source: "IMPORT" });

    // Une seule ligne d'activite pour le lot.
    const events = await db.activityEvent.findMany({ where: { spaceId: w.coloc.id } });
    expect(events.map((e) => e.type)).toEqual(["recipes.recipes.added"]);
  });

  it("sous-recette hors du lot : liee a celle de meme titre dans l'espace, sinon retiree et notee", async () => {
    const w = await world();
    const bechamel = await createRecipe(w.asLea, w.coloc.id, { title: "Béchamel" });
    const recipe = exported("gratin", {
      title: "Gratin",
      notes: "Au four.",
      blocks: [
        {
          kind: "RECIPE",
          title: null,
          recipe: "bechamel",
          recipeTitle: "BECHAMEL",
          quantity: 200,
          unit: null,
        },
        {
          kind: "RECIPE",
          title: null,
          recipe: null,
          recipeTitle: "Pâte brisée",
          quantity: 1,
          unit: null,
        },
      ],
    });
    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/import-export`, {
      recipes: [recipe],
    });
    expect(res.status).toBe(201);
    const gratin = await detail(w.asLea, w.coloc.id, res.body.data[0].recipeId);
    expect(gratin.blocks).toHaveLength(1);
    expect(gratin.blocks[0]).toMatchObject({ kind: "RECIPE", recipe: { id: bechamel.id } });
    expect(gratin.notes).toBe("Au four.\n\nSous-recette non importée : Pâte brisée");
  });

  it("unite inconnue : quantite gardee, note ; ingredient inconnu cree pour la moderation", async () => {
    const w = await world();
    const recipe = exported("soupe", {
      yield: { quantity: 2, unit: "inconnue" },
      blocks: [
        {
          kind: "LOCAL",
          title: null,
          ingredients: [
            { name: "Topinambour violet", quantity: 3, unit: "zz", note: null, optional: true },
            { name: "Sel", quantity: null, unit: "to-taste", note: null, optional: false },
          ],
          steps: ["Mixer."],
        },
      ],
    });
    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/import-export`, {
      recipes: [recipe],
    });
    expect(res.status).toBe(201);
    const soupe = await detail(w.asLea, w.coloc.id, res.body.data[0].recipeId);
    expect(soupe.yieldUnitId).toBeNull();
    expect(local(soupe.blocks[0]).ingredients[0]).toMatchObject({
      name: "topinambour violet",
      quantity: 3,
      unitId: null,
      note: "unité : zz",
      optional: true,
    });
    expect(local(soupe.blocks[0]).ingredients[1]).toMatchObject({
      unitId: await unitId("to-taste"),
    });
    const created = await db.ingredientTranslation.findFirstOrThrow({
      where: { normalized: "topinambour violet" },
      include: { ingredient: true },
    });
    expect(created.ingredient.createdById).toBe(w.lea.id);
  });

  it("sous-recettes en boucle : rien n'est cree (RECIPE_023)", async () => {
    const w = await world();
    const link = (ref: string) => ({
      kind: "RECIPE" as const,
      title: null,
      recipe: ref,
      recipeTitle: ref,
      quantity: 1,
      unit: null,
    });
    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/import-export`, {
      recipes: [exported("a", { blocks: [link("b")] }), exported("b", { blocks: [link("a")] })],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RECIPE_023");
    expect(await db.recipe.count({ where: { homeSpaceId: w.coloc.id } })).toBe(0);
  });

  it("plus de trois niveaux de recettes liees : refus (RECIPE_008)", async () => {
    const w = await world();
    const link = (ref: string) => ({
      kind: "RECIPE" as const,
      title: null,
      recipe: ref,
      recipeTitle: ref,
      quantity: 1,
      unit: null,
    });
    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/import-export`, {
      recipes: [
        exported("a", { blocks: [link("b")] }),
        exported("b", { blocks: [link("c")] }),
        exported("c", { blocks: [link("d")] }),
        exported("d"),
      ],
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("RECIPE_008");
    expect(await db.recipe.count({ where: { homeSpaceId: w.coloc.id } })).toBe(0);
  });

  it("accepte 200 recettes d'un coup, refuse au-dela", async () => {
    const w = await world();
    const many = Array.from({ length: 200 }, (_, at) =>
      exported(`r-${at}`, { description: "x".repeat(200) })
    );
    const res = await w.asLea.post(`${recipesOf(w.coloc.id)}/import-export`, { recipes: many });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(200);
    const tooMany = await w.asLea.post(`${recipesOf(w.coloc.id)}/import-export`, {
      recipes: [...many, exported("r-200")],
    });
    expect(tooMany.status).toBe(400);
  }, 60_000);
});

describe("POST /import-export/preview", () => {
  it("renvoie les titres deja visibles dans l'espace, sans casse ni accents", async () => {
    const w = await world();
    await createRecipe(w.asLea, w.coloc.id, { title: "Crème brûlée" });
    await createRecipe(w.asLea, w.famille.id, { title: "Tarte" });
    const res = await w.asSam.post(`${recipesOf(w.coloc.id)}/import-export/preview`, {
      titles: ["CREME BRULEE", "Tarte", "Gratin"],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ existing: ["CREME BRULEE"] });
  });
});

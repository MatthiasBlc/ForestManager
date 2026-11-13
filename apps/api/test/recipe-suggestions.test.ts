// Suggestions de modification (C3.6) : proposer, examiner l'effet sur la version
// actuelle, accepter (revision SUGGESTION), refuser avec un mot, retirer,
// transformer en adaptation, decideur quand l'auteur est parti
// [D04, D18, D140, D163, D166].
import { describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, recipeBody } from "./helpers/recipes.ts";

const app = createTestApp();

/**
 * Foyer : Olga OWNER, Marc MODERATOR, Lea MEMBER (autrice), Matthias MEMBER.
 * Colloc : Matthias seul.
 */
async function world() {
  const [olga, marc, lea, matthias] = await Promise.all(
    Array.from({ length: 4 }, () => createUser())
  );
  if (!olga || !marc || !lea || !matthias) throw new Error("users");
  const foyer = await createSpace(olga.id, { name: "Foyer" });
  await addMember(foyer.id, marc.id, "MODERATOR");
  await addMember(foyer.id, lea.id);
  await addMember(foyer.id, matthias.id);
  const colloc = await createSpace(matthias.id, { name: "Colloc" });
  const [asLea, asMatthias, asMarc] = await Promise.all([
    loginAs(lea, app),
    loginAs(matthias, app),
    loginAs(marc, app),
  ]);
  const recipe = await createRecipe(asLea, foyer.id, { title: "Saumon teriyaki" });
  const base = `/spaces/${foyer.id}/recipes/${recipe.id}`;
  return { olga, marc, lea, matthias, foyer, colloc, asLea, asMatthias, asMarc, recipe, base };
}

type World = Awaited<ReturnType<typeof world>>;

async function suggest(w: World, overrides: Record<string, unknown> = {}, client?: Client) {
  const as = client ?? w.asMatthias;
  return as.post(`${w.base}/suggestions`, {
    ...(await recipeBody(as, { title: "Saumon teriyaki", cookMinutes: 40 })),
    revision: 1,
    message: "Le saumon reste cru à cœur en 30 minutes.",
    ...overrides,
  });
}

async function edit(w: World, revision: number, overrides: Record<string, unknown>) {
  const res = await w.asLea.put(w.base, {
    ...(await recipeBody(w.asLea, { title: "Saumon teriyaki", ...overrides })),
    revision,
  });
  expect(res.status).toBe(200);
}

describe("proposer une suggestion (E-SUGGESTION-EDITION)", () => {
  it("un membre propose ; l'autrice la voit dans la recette et dans ses bandeaux", async () => {
    const w = await world();
    const res = await suggest(w);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      recipe: { id: w.recipe.id, title: "Saumon teriyaki", homeSpaceId: w.foyer.id },
      proposer: { id: w.matthias.id },
      status: "PENDING",
      baseRevision: 1,
      message: "Le saumon reste cru à cœur en 30 minutes.",
    });
    const list = await w.asLea.get(`${w.base}/suggestions`);
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([res.body.id]);

    const inGroup = await w.asLea.get(`/spaces/${w.foyer.id}/recipes/suggestions`);
    expect(inGroup.body.data).toHaveLength(1);
    const inPersonal = await w.asLea.get(`/spaces/${w.lea.personalSpaceId}/recipes/suggestions`);
    expect(inPersonal.body.data).toHaveLength(1);
    // L'autrice est encore la : le moderateur ne tranche pas.
    const forMarc = await w.asMarc.get(`/spaces/${w.foyer.id}/recipes/suggestions`);
    expect(forMarc.body.data).toEqual([]);
  });

  it("refus : l'autrice elle-meme, une seconde suggestion en attente", async () => {
    const w = await world();
    const own = await suggest(w, {}, w.asLea);
    expect(own.status).toBe(403);
    expect(own.body.error.code).toBe("RECIPE_012");
    await suggest(w);
    const again = await suggest(w);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("RECIPE_013");
  });

  it("un moderateur peut aussi suggerer (12-Permissions : tout membre sauf l'auteur)", async () => {
    const w = await world();
    const res = await suggest(w, {}, w.asMarc);
    expect(res.status).toBe(201);
  });
});

describe("examiner et accepter (E-SUGGESTION)", () => {
  it("accepter cree la revision SUGGESTION au nom du suggereur", async () => {
    const w = await world();
    const created = await suggest(w);
    const detail = await w.asLea.get(`${w.base}/suggestions/${created.body.id}`);
    expect(detail.body).toMatchObject({
      currentRevision: 1,
      current: { cookMinutes: 30 },
      result: { cookMinutes: 40 },
      conflicts: [],
      can: { decide: true, withdraw: false, convert: false },
    });
    const accepted = await w.asLea.post(`${w.base}/suggestions/${created.body.id}/accept`, {
      revision: 1,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ currentRevision: 2, cookMinutes: 40 });
    const revisions = await w.asLea.get(`${w.base}/revisions`);
    expect(revisions.body.data[0]).toMatchObject({
      number: 2,
      source: "SUGGESTION",
      author: { id: w.matthias.id },
    });
    const after = await w.asMatthias.get(`${w.base}/suggestions/${created.body.id}`);
    expect(after.body).toMatchObject({ status: "ACCEPTED", decidedBy: { id: w.lea.id } });
    const again = await w.asLea.post(`${w.base}/suggestions/${created.body.id}/accept`, {
      revision: 2,
    });
    expect(again.body.error.code).toBe("RECIPE_014");
  });

  it("la recette a change depuis : fusion sur la version actuelle, conflits signales", async () => {
    const w = await world();
    const created = await suggest(w);
    await edit(w, 1, { notes: "Servir chaud." });
    const merged = await w.asLea.get(`${w.base}/suggestions/${created.body.id}`);
    expect(merged.body).toMatchObject({
      currentRevision: 2,
      result: { notes: "Servir chaud.", cookMinutes: 40 },
      conflicts: [],
    });

    await edit(w, 2, { notes: "Servir chaud.", cookMinutes: 50 });
    const conflict = await w.asLea.get(`${w.base}/suggestions/${created.body.id}`);
    expect(conflict.body.conflicts).toEqual(["cook"]);
    const stale = await w.asLea.post(`${w.base}/suggestions/${created.body.id}/accept`, {
      revision: 2,
    });
    expect(stale.body.error.code).toBe("RECIPE_004");
    const accepted = await w.asLea.post(`${w.base}/suggestions/${created.body.id}/accept`, {
      revision: 3,
    });
    expect(accepted.body).toMatchObject({ notes: "Servir chaud.", cookMinutes: 40 });
  });

  it("l'autrice partie, les moderateurs de l'origine tranchent (D18)", async () => {
    const w = await world();
    const created = await suggest(w);
    const denied = await w.asMarc.post(`${w.base}/suggestions/${created.body.id}/accept`, {
      revision: 1,
    });
    expect(denied.status).toBe(403);
    await db.membership.update({
      where: { spaceId_userId: { spaceId: w.foyer.id, userId: w.lea.id } },
      data: { leftAt: new Date() },
    });
    const banner = await w.asMarc.get(`/spaces/${w.foyer.id}/recipes/suggestions`);
    expect(banner.body.data).toHaveLength(1);
    const accepted = await w.asMarc.post(`${w.base}/suggestions/${created.body.id}/accept`, {
      revision: 1,
    });
    expect(accepted.status).toBe(200);
  });
});

describe("refuser, retirer, transformer en adaptation", () => {
  it("refus avec un mot, puis le suggereur en fait son adaptation (D140)", async () => {
    const w = await world();
    const created = await suggest(w);
    const rejected = await w.asLea.post(`${w.base}/suggestions/${created.body.id}/reject`, {
      message: "30 minutes suffisent avec des pavés fins.",
    });
    expect(rejected.status).toBe(204);
    const recipe = await w.asLea.get(w.base);
    expect(recipe.body.currentRevision).toBe(1);

    const mine = await w.asMatthias.get(`${w.base}/suggestions`);
    expect(mine.body.data[0]).toMatchObject({
      status: "REJECTED",
      decisionMessage: "30 minutes suffisent avec des pavés fins.",
      decidedBy: { id: w.lea.id },
    });
    // La liste de l'autrice ne garde que les suggestions en attente.
    const forLea = await w.asLea.get(`${w.base}/suggestions`);
    expect(forLea.body.data).toEqual([]);

    const converted = await w.asMatthias.post(`${w.base}/suggestions/${created.body.id}/convert`, {
      targetSpaceId: w.colloc.id,
    });
    expect(converted.status).toBe(201);
    expect(converted.body).toMatchObject({
      homeSpaceId: w.colloc.id,
      cookMinutes: 40,
      author: { id: w.matthias.id },
      adaptedFrom: { id: w.recipe.id, changed: false },
    });
    const after = await w.asMatthias.get(`${w.base}/suggestions/${created.body.id}`);
    expect(after.body).toMatchObject({
      status: "CONVERTED",
      convertedRecipeId: converted.body.id,
    });
  });

  it("transformer : seulement le suggereur, seulement une suggestion refusee", async () => {
    const w = await world();
    const created = await suggest(w);
    const pending = await w.asMatthias.post(`${w.base}/suggestions/${created.body.id}/convert`, {
      targetSpaceId: w.colloc.id,
    });
    expect(pending.body.error.code).toBe("RECIPE_014");
    await w.asLea.post(`${w.base}/suggestions/${created.body.id}/reject`, {});
    const other = await w.asLea.post(`${w.base}/suggestions/${created.body.id}/convert`, {
      targetSpaceId: w.lea.personalSpaceId,
    });
    expect(other.status).toBe(403);
  });

  it("retirer sa suggestion en attente ; personne d'autre ne la retire", async () => {
    const w = await world();
    const created = await suggest(w);
    const byLea = await w.asLea.post(`${w.base}/suggestions/${created.body.id}/withdraw`);
    expect(byLea.status).toBe(403);
    const res = await w.asMatthias.post(`${w.base}/suggestions/${created.body.id}/withdraw`);
    expect(res.status).toBe(204);
    const list = await w.asLea.get(`${w.base}/suggestions`);
    expect(list.body.data).toEqual([]);
    // Plus rien en attente : il peut en proposer une nouvelle.
    expect((await suggest(w)).status).toBe(201);
  });

  it("le suggereur quitte l'espace : sa suggestion en attente est annulee", async () => {
    const w = await world();
    const created = await suggest(w);
    const left = await w.asMatthias.post(`/spaces/${w.foyer.id}/leave`, {
      confirmDeletion: false,
    });
    expect(left.status).toBe(204);
    const row = await db.recipeSuggestion.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.status).toBe("CANCELLED");
  });
});

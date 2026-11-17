// Partage des recettes (C3.5) : partage par reference, sous-recettes partagees
// avec le plat, demandes et confiance de l'auteur, retrait d'un espace, vue
// "Mes recettes", depart d'un membre et purge de l'espace d'origine
// [D03, D18, D19, D26, D81, D82, D83, D84, D165].
import { NOT_FOUND_UUID } from "@fm/test-utils";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createContext } from "../src/core/http/app.ts";
import { purgeDeletedSpaces } from "../src/core/spaces/service.ts";
import { MODULES } from "../src/modules/index.ts";
import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, recipeBody, unitId } from "./helpers/recipes.ts";

const app = createTestApp();

/**
 * Foyer (origine) : Olga OWNER, Marc MODERATOR, Lea et Matthias MEMBER.
 * Famille : Matthias OWNER, Lea MEMBER, Paul MEMBER. Colloc : Matthias seul.
 */
async function world() {
  const [olga, marc, lea, matthias, paul] = await Promise.all(
    Array.from({ length: 5 }, () => createUser())
  );
  if (!olga || !marc || !lea || !matthias || !paul) throw new Error("users");
  const foyer = await createSpace(olga.id, { name: "Foyer" });
  await addMember(foyer.id, marc.id, "MODERATOR");
  await addMember(foyer.id, lea.id);
  await addMember(foyer.id, matthias.id);
  const famille = await createSpace(matthias.id, { name: "Famille" });
  await addMember(famille.id, lea.id);
  await addMember(famille.id, paul.id);
  const colloc = await createSpace(matthias.id, { name: "Colloc" });
  const [asLea, asMatthias] = await Promise.all([loginAs(lea, app), loginAs(matthias, app)]);
  return { olga, marc, lea, matthias, paul, foyer, famille, colloc, asLea, asMatthias };
}

type World = Awaited<ReturnType<typeof world>>;

const recipesOf = (spaceId: string) => `/spaces/${spaceId}/recipes`;

async function titlesIn(client: Client, spaceId: string): Promise<string[]> {
  const res = await client.get(recipesOf(spaceId));
  return (res.body.data as { title: string }[]).map((r) => r.title).sort();
}

async function share(client: Client, spaceId: string, recipeId: string, spaceIds: string[]) {
  return client.put(`${recipesOf(spaceId)}/${recipeId}/shares`, { spaceIds });
}

const link = async (recipeId: string, quantity = 150) => ({
  kind: "RECIPE",
  recipeId,
  quantity,
  unitId: await unitId("ml"),
});

function purge() {
  return purgeDeletedSpaces(
    createContext({ env: testEnv, db, logger: pino({ level: "silent" }), modules: MODULES })
  );
}

async function markForPurge(spaceId: string) {
  await db.space.update({
    where: { id: spaceId },
    data: { deletedAt: new Date(), purgeAfter: new Date(Date.now() - 1000) },
  });
}

describe("partage par reference (D03, F-REC-5)", () => {
  it("l'auteur partage sa recette : la meme recette apparait dans l'autre espace", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);

    const res = await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      homeSpace: { id: w.foyer.id, name: "Foyer" },
      canShare: true,
      spaces: [{ spaceId: w.famille.id, status: "SHARED" }],
      withIt: [],
    });
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Gratin de pates"]);

    // Une seule source de verite : la modification se voit partout.
    const edited = await w.asLea.put(
      `${recipesOf(w.foyer.id)}/${gratin.id}`,
      await recipeBody(w.asLea, { title: "Gratin du dimanche", revision: 1 })
    );
    expect(edited.status).toBe(200);
    const seen = await loginAs(w.paul, app).then((c) =>
      c.get(`${recipesOf(w.famille.id)}/${gratin.id}`)
    );
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject({
      id: gratin.id,
      title: "Gratin du dimanche",
      homeSpaceId: w.foyer.id,
      homeSpace: { id: w.foyer.id, name: "Foyer" },
      can: { edit: false, delete: false, share: false, removeFromSpace: false },
    });
  });

  it("l'auteur modifie et supprime depuis un espace de partage ; le detail liste les partages", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);

    const inFamille = await w.asLea.get(`${recipesOf(w.famille.id)}/${gratin.id}`);
    expect(inFamille.body).toMatchObject({
      can: { edit: true, delete: true, share: true, removeFromSpace: true },
      shareCount: 1,
      sharedIn: [{ id: w.famille.id, name: "Famille" }],
    });
    // Un moderateur de l'espace de partage ne modifie pas, il peut seulement retirer (D57).
    const asOwner = await w.asMatthias.get(`${recipesOf(w.famille.id)}/${gratin.id}`);
    expect(asOwner.body.can).toEqual({
      edit: false,
      delete: false,
      share: false,
      removeFromSpace: true,
    });

    expect((await w.asLea.delete(`${recipesOf(w.famille.id)}/${gratin.id}`)).status).toBe(204);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual([]);
    expect(await titlesIn(w.asLea, w.foyer.id)).toEqual([]);
  });

  it("decocher retire le partage ; recocher le retablit", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);

    const removed = await share(w.asLea, w.foyer.id, gratin.id, []);
    expect(removed.body.spaces).toEqual([]);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual([]);
    const row = await db.recipeShare.findFirstOrThrow({ where: { recipeId: gratin.id } });
    expect(row.removedById).toBe(w.lea.id);

    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Gratin de pates"]);
    expect(await db.recipeShare.count({ where: { recipeId: gratin.id } })).toBe(1);
  });

  it("refuse un espace dont l'auteur n'est pas membre, l'espace d'origine, et un non-auteur", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    expect((await share(w.asLea, w.foyer.id, gratin.id, [w.colloc.id])).body.error.code).toBe(
      "SPACE_001"
    );
    expect((await share(w.asLea, w.foyer.id, gratin.id, [w.foyer.id])).body.error.code).toBe(
      "RECIPE_009"
    );
    expect((await share(w.asMatthias, w.foyer.id, gratin.id, [w.famille.id])).body.error.code).toBe(
      "SPACE_002"
    );
  });

  it("decocher ne touche pas aux espaces ou l'auteur n'est plus membre", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);
    await db.membership.update({
      where: { spaceId_userId: { spaceId: w.famille.id, userId: w.lea.id } },
      data: { leftAt: new Date() },
    });
    await share(w.asLea, w.foyer.id, gratin.id, []);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Gratin de pates"]);
  });

  it("chaque espace a ses propres tags sur une recette partagee (D19)", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);
    const tag = await w.asMatthias.post(`${recipesOf(w.famille.id)}/tags`, { name: "Noel" });
    await w.asMatthias.put(`${recipesOf(w.famille.id)}/${gratin.id}/space-tags`, {
      tagIds: [tag.body.id],
    });

    const inFamille = await w.asMatthias.get(`${recipesOf(w.famille.id)}/${gratin.id}`);
    expect(inFamille.body.tags.map((t: { name: string }) => t.name)).toEqual(["Noel"]);
    const inFoyer = await w.asLea.get(`${recipesOf(w.foyer.id)}/${gratin.id}`);
    expect(inFoyer.body.tags).toEqual([]);
    const filtered = await w.asMatthias.get(`${recipesOf(w.famille.id)}?tagIds=${tag.body.id}`);
    expect(filtered.body.data).toHaveLength(1);
  });

  it("une recette partagee peut etre liee comme sous-recette dans l'espace de partage", async () => {
    const w = await world();
    const sauce = await createRecipe(w.asLea, w.foyer.id, { title: "Sauce", isBase: true });
    await share(w.asLea, w.foyer.id, sauce.id, [w.famille.id]);
    const plat = await createRecipe(w.asMatthias, w.famille.id, {
      title: "Plat",
      blocks: [await link(sauce.id)],
    });
    const res = await w.asMatthias.get(`${recipesOf(w.famille.id)}/${plat.id}`);
    expect(res.body.blocks[0]).toMatchObject({ status: "AVAILABLE", recipe: { title: "Sauce" } });
  });
});

describe("sous-recettes partagees avec le plat (D26)", () => {
  it("partager un plat partage les sous-recettes de son auteur, pas celles des autres", async () => {
    const w = await world();
    const teriyaki = await createRecipe(w.asLea, w.foyer.id, {
      title: "Sauce teriyaki",
      isBase: true,
      yieldQuantity: 300,
      yieldUnitId: await unitId("ml"),
    });
    const riz = await createRecipe(w.asMatthias, w.foyer.id, { title: "Riz", isBase: true });
    const plat = await createRecipe(w.asLea, w.foyer.id, {
      title: "Saumon teriyaki",
      blocks: [await link(teriyaki.id), await link(riz.id, 1)],
    });

    const preview = await w.asLea.get(`${recipesOf(w.foyer.id)}/${plat.id}/sharing`);
    expect(preview.status).toBe(200);
    expect(preview.body.withIt).toEqual([
      { id: teriyaki.id, title: "Sauce teriyaki", included: true },
      { id: riz.id, title: "Riz", included: false },
    ]);

    await share(w.asLea, w.foyer.id, plat.id, [w.famille.id]);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual([
      "Sauce teriyaki",
      "Saumon teriyaki",
    ]);
    const detail = await w.asMatthias.get(`${recipesOf(w.famille.id)}/${plat.id}`);
    expect(detail.body.blocks.map((b: { status: string }) => b.status)).toEqual([
      "AVAILABLE",
      "HIDDEN",
    ]);
    const via = await db.recipeShare.findFirstOrThrow({ where: { recipeId: teriyaki.id } });
    expect(via.viaRecipeId).toBe(plat.id);
  });

  it("retirer le plat retire ses sous-recettes, sauf si une autre recette de l'espace les utilise", async () => {
    const w = await world();
    const sauce = await createRecipe(w.asLea, w.foyer.id, { title: "Sauce", isBase: true });
    const pate = await createRecipe(w.asLea, w.foyer.id, { title: "Pate", isBase: true });
    const plat = await createRecipe(w.asLea, w.foyer.id, {
      title: "Plat",
      blocks: [await link(sauce.id), await link(pate.id)],
    });
    await share(w.asLea, w.foyer.id, plat.id, [w.famille.id]);
    // Matthias utilise la sauce dans une recette de Famille.
    await createRecipe(w.asMatthias, w.famille.id, {
      title: "Poulet",
      blocks: [await link(sauce.id)],
    });

    await share(w.asLea, w.foyer.id, plat.id, []);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Poulet", "Sauce"]);
  });
});

describe("demandes de partage et confiance (D81, D101)", () => {
  async function requestShare(w: World, recipeId: string, message?: string) {
    return w.asMatthias.post(`${recipesOf(w.foyer.id)}/${recipeId}/share-requests`, {
      targetSpaceId: w.famille.id,
      ...(message ? { message } : {}),
    });
  }

  it("un autre membre demande ; l'auteur voit la demande dans son espace perso et accepte", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    const sent = await requestShare(w, gratin.id, "Ta tante la reclame depuis Noel !");
    expect(sent.status).toBe(201);
    expect(sent.body).toEqual({ status: "PENDING" });
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual([]);
    // Une seule demande en attente par recette et espace cible.
    expect((await requestShare(w, gratin.id)).body).toEqual({ status: "PENDING" });
    expect(await db.recipeShareRequest.count({ where: { recipeId: gratin.id } })).toBe(1);

    const sharing = await w.asMatthias.get(`${recipesOf(w.foyer.id)}/${gratin.id}/sharing`);
    expect(sharing.body).toMatchObject({
      canShare: false,
      spaces: [{ spaceId: w.famille.id, status: "PENDING" }],
    });

    const inbox = await w.asLea.get(`${recipesOf(w.lea.personalSpaceId)}/share-requests`);
    expect(inbox.status).toBe(200);
    expect(inbox.body.data).toEqual([
      expect.objectContaining({
        recipe: { id: gratin.id, title: "Gratin de pates" },
        homeSpace: { id: w.foyer.id, name: "Foyer" },
        sourceSpace: { id: w.foyer.id, name: "Foyer" },
        targetSpace: { id: w.famille.id, name: "Famille", memberCount: 3 },
        requester: expect.objectContaining({ id: w.matthias.id }),
        message: "Ta tante la reclame depuis Noel !",
        trust: false,
      }),
    ]);
    // Rien pour le demandeur ni pour les moderateurs tant que l'auteur est la.
    const marc = await loginAs(w.marc, app);
    expect((await marc.get(`${recipesOf(w.foyer.id)}/share-requests`)).body.data).toEqual([]);

    const id = inbox.body.data[0].id as string;
    const approved = await w.asLea.post(
      `${recipesOf(w.lea.personalSpaceId)}/share-requests/${id}/approve`,
      {
        trustMembers: false,
      }
    );
    expect(approved.status).toBe(204);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Gratin de pates"]);
    const row = await db.recipeShare.findFirstOrThrow({ where: { recipeId: gratin.id } });
    expect(row).toMatchObject({ sharedById: w.matthias.id, approvedById: w.lea.id });
    expect((await db.recipeShareRequest.findUniqueOrThrow({ where: { id } })).status).toBe(
      "APPROVED"
    );
    // Deja traitee.
    const again = await w.asLea.post(
      `${recipesOf(w.lea.personalSpaceId)}/share-requests/${id}/approve`,
      {
        trustMembers: false,
      }
    );
    expect(again.body.error.code).toBe("RECIPE_010");
  });

  it("l'auteur refuse : rien n'est partage", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    await requestShare(w, gratin.id);
    const inbox = await w.asLea.get(`${recipesOf(w.foyer.id)}/share-requests`);
    expect(inbox.body.data).toHaveLength(1);
    const id = inbox.body.data[0].id as string;
    // Le demandeur ne tranche pas sa propre demande.
    const self = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/share-requests/${id}/reject`);
    expect(self.body.error.code).toBe("RECIPE_010");

    expect(
      (await w.asLea.post(`${recipesOf(w.foyer.id)}/share-requests/${id}/reject`)).status
    ).toBe(204);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual([]);
    expect((await db.recipeShareRequest.findUniqueOrThrow({ where: { id } })).status).toBe(
      "REJECTED"
    );
  });

  it("accepter en faisant confiance : les demandes suivantes depuis Foyer partagent directement", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    const tarte = await createRecipe(w.asLea, w.foyer.id, { title: "Tarte" });
    await requestShare(w, gratin.id);
    const [request] = (await w.asLea.get(`${recipesOf(w.foyer.id)}/share-requests`)).body.data;
    await w.asLea.post(`${recipesOf(w.foyer.id)}/share-requests/${request.id}/approve`, {
      trustMembers: true,
    });
    const membership = await db.membership.findUniqueOrThrow({
      where: { spaceId_userId: { spaceId: w.foyer.id, userId: w.lea.id } },
    });
    expect(membership.allowMembersToShare).toBe(true);

    const direct = await requestShare(w, tarte.id);
    expect(direct.status).toBe(201);
    expect(direct.body).toEqual({ status: "SHARED" });
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Gratin de pates", "Tarte"]);
  });

  it("auteur parti : les moderateurs de l'espace d'origine decident (D18)", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    expect((await w.asLea.post(`/spaces/${w.foyer.id}/leave`, {})).status).toBe(204);
    await requestShare(w, gratin.id);

    expect(
      (await w.asLea.get(`${recipesOf(w.lea.personalSpaceId)}/share-requests`)).body.data
    ).toEqual([]);
    const marc = await loginAs(w.marc, app);
    const inbox = await marc.get(`${recipesOf(w.foyer.id)}/share-requests`);
    expect(inbox.body.data).toEqual([expect.objectContaining({ trust: null })]);
    await marc.post(`${recipesOf(w.foyer.id)}/share-requests/${inbox.body.data[0].id}/approve`, {});
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Gratin de pates"]);
    // Les moderateurs partagent aussi directement.
    const sharing = await marc.get(`${recipesOf(w.foyer.id)}/${gratin.id}/sharing`);
    expect(sharing.body.canShare).toBe(true);
  });

  it("refuse un espace cible dont on n'est pas membre ou ou la recette est deja visible", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    const paul = await loginAs(w.paul, app);
    await addMember(w.foyer.id, w.paul.id);
    const outside = await paul.post(`${recipesOf(w.foyer.id)}/${gratin.id}/share-requests`, {
      targetSpaceId: w.colloc.id,
    });
    expect(outside.body.error.code).toBe("SPACE_001");
    const home = await w.asMatthias.post(`${recipesOf(w.foyer.id)}/${gratin.id}/share-requests`, {
      targetSpaceId: w.foyer.id,
    });
    expect(home.body.error.code).toBe("RECIPE_009");
  });

  it("le demandeur quitte l'espace cible : sa demande tombe", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    const paul = await loginAs(w.paul, app);
    await addMember(w.foyer.id, w.paul.id);
    await paul.post(`${recipesOf(w.foyer.id)}/${gratin.id}/share-requests`, {
      targetSpaceId: w.famille.id,
    });
    await paul.post(`/spaces/${w.famille.id}/leave`, {});
    expect((await w.asLea.get(`${recipesOf(w.foyer.id)}/share-requests`)).body.data).toEqual([]);
    const request = await db.recipeShareRequest.findFirstOrThrow({
      where: { recipeId: gratin.id },
    });
    expect(request.status).toBe("CANCELLED");
  });

  it("demande inconnue : RECIPE_010", async () => {
    const w = await world();
    const res = await w.asLea.post(
      `${recipesOf(w.foyer.id)}/share-requests/${NOT_FOUND_UUID}/approve`,
      {}
    );
    expect(res.body.error.code).toBe("RECIPE_010");
  });
});

describe("retirer d'un espace de partage (F-REC-9)", () => {
  it("un moderateur de l'espace de partage retire la recette ; elle reste a son auteur", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id);
    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);
    const paul = await loginAs(w.paul, app);
    expect(
      (await paul.delete(`${recipesOf(w.famille.id)}/${gratin.id}/share`)).body.error.code
    ).toBe("SPACE_002");
    expect(
      (await w.asLea.delete(`${recipesOf(w.foyer.id)}/${gratin.id}/share`)).body.error.code
    ).toBe("SPACE_002");

    expect(
      (await w.asMatthias.delete(`${recipesOf(w.famille.id)}/${gratin.id}/share`)).status
    ).toBe(204);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual([]);
    expect(await titlesIn(w.asLea, w.foyer.id)).toEqual(["Gratin de pates"]);
  });
});

describe("vue Mes recettes (D82)", () => {
  it("liste les recettes dont on est l'auteur dans tous ses espaces, avec leur espace d'origine", async () => {
    const w = await world();
    await createRecipe(w.asLea, w.foyer.id, { title: "Gratin" });
    await createRecipe(w.asLea, w.lea.personalSpaceId, { title: "Dahl" });
    await createRecipe(w.asLea, w.famille.id, { title: "Tarte" });
    await createRecipe(w.asMatthias, w.famille.id, { title: "Poulet" });
    const left = await createSpace(w.lea.id, { name: "Ancien" });
    await createRecipe(w.asLea, left.id, { title: "Perdue" });
    await db.space.update({ where: { id: left.id }, data: { deletedAt: new Date() } });

    const res = await w.asLea.get(`${recipesOf(w.lea.personalSpaceId)}/mine?sort=title`);
    expect(res.status).toBe(200);
    expect(
      res.body.data.map((r: { title: string; homeSpaceId: string }) => [r.title, r.homeSpaceId])
    ).toEqual([
      ["Dahl", w.lea.personalSpaceId],
      ["Gratin", w.foyer.id],
      ["Tarte", w.famille.id],
    ]);
    const searched = await w.asLea.get(`${recipesOf(w.lea.personalSpaceId)}/mine?q=gra`);
    expect(searched.body.data).toHaveLength(1);
  });

  it("Mes recettes filtrees par espace d'origine (onglet unique de l'espace perso)", async () => {
    const w = await world();
    await createRecipe(w.asLea, w.lea.personalSpaceId, { title: "Dahl" });
    await createRecipe(w.asLea, w.famille.id, { title: "Tarte" });
    const mine = `${recipesOf(w.lea.personalSpaceId)}/mine`;
    const famille = await w.asLea.get(`${mine}?homeSpaceId=${w.famille.id}`);
    expect(famille.status).toBe(200);
    expect(famille.body.data.map((r: { title: string }) => r.title)).toEqual(["Tarte"]);
    const perso = await w.asLea.get(`${mine}?homeSpaceId=${w.lea.personalSpaceId}`);
    expect(perso.body.data.map((r: { title: string }) => r.title)).toEqual(["Dahl"]);
    expect((await w.asLea.get(`${mine}?homeSpaceId=pas-un-uuid`)).status).toBe(400);
  });
});

describe("depart d'un membre (D18, D84)", () => {
  it("apercu du depart : recettes creees ici et recettes perso partagees ici ; rien n'est retire d'office", async () => {
    const w = await world();
    await createRecipe(w.asLea, w.famille.id, { title: "Tarte" });
    const dahl = await createRecipe(w.asLea, w.lea.personalSpaceId, { title: "Dahl" });
    const gratin = await createRecipe(w.asLea, w.foyer.id, { title: "Gratin" });
    await share(w.asLea, w.lea.personalSpaceId, dahl.id, [w.famille.id]);
    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);

    const preview = await w.asLea.get(`${recipesOf(w.famille.id)}/leave-preview`);
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({
      createdHere: 1,
      personalShared: [{ id: dahl.id, title: "Dahl" }],
    });

    expect((await w.asLea.post(`/spaces/${w.famille.id}/leave`, {})).status).toBe(204);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Dahl", "Gratin", "Tarte"]);
    // La recette creee dans Famille passe aux moderateurs (D18) ; le partage perso reste a Lea.
    const tarte = (await w.asMatthias.get(recipesOf(w.famille.id))).body.data.find(
      (r: { title: string }) => r.title === "Tarte"
    );
    const detail = await w.asMatthias.get(`${recipesOf(w.famille.id)}/${tarte.id}`);
    expect(detail.body.can).toMatchObject({ edit: true, delete: true });
  });
});

describe("purge de l'espace d'origine (D83, D165)", () => {
  it("les recettes partagees ailleurs sont rapatriees chez l'auteur, les autres effacees", async () => {
    const w = await world();
    const gratin = await createRecipe(w.asLea, w.foyer.id, { title: "Gratin" });
    const seul = await createRecipe(w.asLea, w.foyer.id, { title: "Seul" });
    const jetee = await createRecipe(w.asLea, w.foyer.id, { title: "Jetee" });
    await w.asLea.delete(`${recipesOf(w.foyer.id)}/${jetee.id}`);
    const tag = await w.asLea.post(`${recipesOf(w.foyer.id)}/tags`, { name: "Foyer" });
    await w.asLea.put(`${recipesOf(w.foyer.id)}/${gratin.id}/space-tags`, {
      tagIds: [tag.body.id],
    });
    await share(w.asLea, w.foyer.id, gratin.id, [w.famille.id]);
    // Une recette d'un autre espace partagee dans Foyer : son partage disparait avec Foyer.
    const poulet = await createRecipe(w.asMatthias, w.famille.id, { title: "Poulet" });
    await share(w.asMatthias, w.famille.id, poulet.id, [w.foyer.id]);

    await markForPurge(w.foyer.id);
    expect(await purge()).toBe(1);

    const moved = await db.recipe.findUniqueOrThrow({ where: { id: gratin.id } });
    expect(moved.homeSpaceId).toBe(w.lea.personalSpaceId);
    expect(await titlesIn(w.asMatthias, w.famille.id)).toEqual(["Gratin", "Poulet"]);
    expect(await db.recipe.count({ where: { id: { in: [seul.id, jetee.id] } } })).toBe(0);
    expect(await db.recipeShare.count({ where: { spaceId: w.foyer.id } })).toBe(0);
    expect(await db.recipeSpaceTag.count({ where: { recipeId: gratin.id } })).toBe(0);
  });

  it("auteur supprime : la recette prend pour origine son plus ancien espace de partage", async () => {
    const w = await world();
    const amis = await createSpace(w.lea.id, { name: "Amis" });
    const gratin = await createRecipe(w.asLea, w.lea.personalSpaceId, { title: "Gratin" });
    await share(w.asLea, w.lea.personalSpaceId, gratin.id, [w.famille.id]);
    await share(w.asLea, w.lea.personalSpaceId, gratin.id, [w.famille.id, amis.id]);
    await db.recipeShare.updateMany({
      where: { spaceId: amis.id },
      data: { sharedAt: new Date(Date.now() + 60_000) },
    });
    // Comme la suppression du compte : departs de tous les espaces, compte anonymise.
    await db.membership.updateMany({ where: { userId: w.lea.id }, data: { leftAt: new Date() } });
    await db.user.update({ where: { id: w.lea.id }, data: { deletedAt: new Date() } });
    await markForPurge(w.lea.personalSpaceId);
    await purge();

    const moved = await db.recipe.findUniqueOrThrow({ where: { id: gratin.id } });
    expect(moved.homeSpaceId).toBe(w.famille.id);
    expect(await db.recipeShare.count({ where: { recipeId: gratin.id, removedAt: null } })).toBe(1);
    // Geree par les moderateurs de Famille (auteur parti).
    const detail = await w.asMatthias.get(`${recipesOf(w.famille.id)}/${gratin.id}`);
    expect(detail.body.can).toMatchObject({ edit: true, delete: true });
  });

  it("une recette liee depuis un autre espace n'est pas effacee : elle suit son auteur", async () => {
    const w = await world();
    const sauce = await createRecipe(w.asLea, w.foyer.id, { title: "Sauce", isBase: true });
    await share(w.asLea, w.foyer.id, sauce.id, [w.famille.id]);
    const plat = await createRecipe(w.asMatthias, w.famille.id, {
      title: "Plat",
      blocks: [await link(sauce.id)],
    });
    await w.asMatthias.delete(`${recipesOf(w.famille.id)}/${sauce.id}/share`);

    await markForPurge(w.foyer.id);
    await purge();
    const kept = await db.recipe.findUniqueOrThrow({ where: { id: sauce.id } });
    expect(kept.homeSpaceId).toBe(w.lea.personalSpaceId);
    const detail = await w.asMatthias.get(`${recipesOf(w.famille.id)}/${plat.id}`);
    expect(detail.body.blocks[0].status).toBe("HIDDEN");
  });
});

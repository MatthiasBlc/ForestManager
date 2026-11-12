// Planning (C5.6) : generer un apercu sans rien ecrire [D110], le garder sans
// ecraser une case modifiee depuis le tirage [D184], expliquer les cases vides
// [D113], proposer un autre repas pour une case (droit de modifier, profil par
// defaut, recette actuelle ecartee).
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createSpace, grantModule } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";
import { ACTORS, clientAs, expectPermission, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();

beforeAll(async () => {
  await db.module.update({ where: { code: "meal-plan" }, data: { status: "AVAILABLE" } });
});

async function plannedGroup() {
  const f = await groupFixture();
  await grantModule(f.spaceId, "meal-plan");
  return f;
}

const planOf = (spaceId: string) => `/spaces/${spaceId}/meal-plan`;

async function defaultProfile(client: Client, spaceId: string): Promise<string> {
  const res = await client.get(`${planOf(spaceId)}/profiles`);
  return (res.body.data as { id: string; isDefault: boolean }[]).find((p) => p.isDefault)!.id;
}

type Proposal = {
  date: string;
  mealTime: string;
  pick: {
    kind: string;
    recipe?: { id: string; title: string };
    idea?: { id: string; name: string };
  } | null;
  reason: { code: string } | null;
  seenUpdatedAt: string | null;
};

async function preview(client: Client, spaceId: string, body: Record<string, unknown> = {}) {
  const res = await client.post(`${planOf(spaceId)}/generate`, {
    profileId: await defaultProfile(client, spaceId),
    from: "2026-11-09",
    to: "2026-11-15",
    ...body,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as {
    proposals: Proposal[];
    skipped: Record<string, number>;
    warnings: Record<string, unknown>[];
    profile: { name: string };
  };
}

const keep = (proposals: Proposal[]) =>
  proposals.flatMap((p) =>
    p.pick
      ? [
          {
            date: p.date,
            mealTime: p.mealTime,
            seenUpdatedAt: p.seenUpdatedAt,
            pick:
              p.pick.kind === "RECIPE"
                ? { kind: "RECIPE", recipeId: p.pick.recipe!.id }
                : { kind: "IDEA", ideaId: p.pick.idea!.id },
          },
        ]
      : []
  );

async function globalTag(name: string) {
  return db.tag.findFirstOrThrow({
    where: { scope: "GLOBAL", translations: { some: { name } } },
  });
}

describe("apercu (D110)", () => {
  it("propose une recette pour chaque repas vide, sans rien ecrire", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    for (const title of ["Dahl", "Curry", "Gratin", "Soupe"]) {
      await createRecipe(owner, f.spaceId, { title });
    }
    const result = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-10" });
    expect(result.profile.name).toBe("Standard");
    expect(result.proposals.map((p) => `${p.date}/${p.mealTime}`)).toEqual([
      "2026-11-09/LUNCH",
      "2026-11-09/DINNER",
      "2026-11-10/LUNCH",
      "2026-11-10/DINNER",
    ]);
    for (const p of result.proposals) {
      expect(p).toMatchObject({ pick: { kind: "RECIPE" }, reason: null, seenUpdatedAt: null });
    }
    expect(await db.mealSlot.count({ where: { spaceId: f.spaceId } })).toBe(0);
  });

  it("garde verrouilles et repas remplis ; remplacer reprend les autres avec leur etat", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    await createRecipe(owner, f.spaceId, { title: "Dahl" });
    await owner.put(`${planOf(f.spaceId)}/meals/2026-11-09/LUNCH`, {
      kind: "TEXT",
      text: "Cantine",
    });
    const locked = await owner.put(`${planOf(f.spaceId)}/meals/2026-11-09/DINNER`, {
      kind: "TEXT",
      text: "Anniversaire",
      locked: true,
    });
    expect(locked.status).toBe(200);
    const fill = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-09" });
    expect(fill.proposals).toEqual([]);
    expect(fill.skipped).toEqual({ excluded: 0, locked: 1, kept: 1, skippedMeals: 0 });
    const replace = await preview(owner, f.spaceId, {
      from: "2026-11-09",
      to: "2026-11-09",
      replace: true,
    });
    const lunch = await db.mealSlot.findFirstOrThrow({
      where: { spaceId: f.spaceId, mealTime: "LUNCH" },
    });
    expect(replace.proposals).toEqual([
      expect.objectContaining({
        mealTime: "LUNCH",
        pick: expect.objectContaining({ kind: "RECIPE" }),
        seenUpdatedAt: lunch.updatedAt.toISOString(),
      }),
    ]);
  });

  it("pool : recettes partagees comprises, ni recette de base ni recette masquee", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const elsewhere = await createSpace(f.owner.id);
    const shared = await createRecipe(owner, elsewhere.id, { title: "Partagee" });
    await owner.put(`/spaces/${elsewhere.id}/recipes/${shared.id}/shares`, {
      spaceIds: [f.spaceId],
    });
    await createRecipe(owner, f.spaceId, { title: "Sauce", isBase: true });
    const hidden = await createRecipe(owner, f.spaceId, { title: "Masquee" });
    await db.recipe.update({ where: { id: hidden.id }, data: { hiddenAt: new Date() } });
    // Sans delai, la seule recette proposable remplit toute la semaine.
    const profileId = await defaultProfile(owner, f.spaceId);
    await owner.patch(`${planOf(f.spaceId)}/profiles/${profileId}`, { cooldownDays: 0 });
    const result = await preview(owner, f.spaceId);
    const titles = new Set(result.proposals.map((p) => p.pick?.recipe?.title));
    expect(titles).toEqual(new Set(["Partagee"]));
  });

  it("sans recette : chaque case expliquee", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const result = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-09" });
    expect(result.proposals.map((p) => p.reason)).toEqual([
      { code: "NO_RECIPE" },
      { code: "NO_RECIPE" },
    ]);
  });

  it("epinglage sans recette du tag : raison avec le nom du tag", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    await createRecipe(owner, f.spaceId);
    const profileId = await defaultProfile(owner, f.spaceId);
    const fish = await globalTag("Rapide");
    await owner.put(`${planOf(f.spaceId)}/profiles/${profileId}/grid`, {
      cells: [{ weekday: "MON", mealTime: "DINNER", state: "PINNED", tagId: fish.id }],
    });
    const result = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-09" });
    expect(result.proposals[1]?.reason).toEqual({
      code: "PIN",
      tag: { id: fish.id, name: "Rapide" },
    });
  });

  it("regle de tag : suit les tags de l'espace et ignore un tag supprime", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const tag = await owner.post(`/spaces/${f.spaceId}/recipes/tags`, { name: "Interdit" });
    await createRecipe(owner, f.spaceId, { title: "Taguee", spaceTagIds: [tag.body.id] });
    const profileId = await defaultProfile(owner, f.spaceId);
    await owner.post(`${planOf(f.spaceId)}/profiles/${profileId}/rules`, {
      target: { kind: "TAG", tagId: tag.body.id },
      weight: 0,
    });
    const blocked = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-09" });
    expect(blocked.proposals[0]?.reason).toEqual({ code: "WEIGHT_ZERO" });
    await db.tag.update({ where: { id: tag.body.id }, data: { deletedAt: new Date() } });
    const freed = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-09" });
    expect(freed.proposals[0]?.pick?.recipe?.title).toBe("Taguee");
  });

  it("le delai regarde les repas deja places avant la periode", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const dahl = await createRecipe(owner, f.spaceId, { title: "Dahl" });
    await createRecipe(owner, f.spaceId, { title: "Curry" });
    await owner.put(`${planOf(f.spaceId)}/meals/2026-11-08/DINNER`, {
      kind: "RECIPE",
      recipeId: dahl.id,
    });
    const result = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-09" });
    // Curry le midi ; le soir, Curry vient d'etre propose et Dahl date d'hier.
    expect(result.proposals.map((p) => p.pick?.recipe?.title ?? p.reason?.code)).toEqual([
      "Curry",
      "COOLDOWN",
    ]);
  });

  it("idees : proposees en texte avec leur nom", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    await owner.post(`${planOf(f.spaceId)}/ideas`, { name: "Raclette" });
    const result = await preview(owner, f.spaceId, { from: "2026-11-09", to: "2026-11-09" });
    const picks = result.proposals.map((p) => p.pick);
    expect(picks).toContainEqual({
      kind: "IDEA",
      idea: { id: expect.any(String), name: "Raclette" },
    });
  });

  it("refuse une periode de plus de 31 jours et un profil d'un autre espace", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const long = await owner.post(`${planOf(f.spaceId)}/generate`, {
      profileId: await defaultProfile(owner, f.spaceId),
      from: "2026-11-01",
      to: "2026-12-02",
    });
    expect(long.body.error.code).toBe("VALIDATION_001");
    const other = await createSpace(f.owner.id);
    await grantModule(other.id, "meal-plan");
    const foreign = await owner.post(`${planOf(f.spaceId)}/generate`, {
      profileId: await defaultProfile(owner, other.id),
      from: "2026-11-09",
      to: "2026-11-09",
    });
    expect(foreign.body.error.code).toBe("MEAL_003");
  });
});

describe("garder ce planning (D110, D184)", () => {
  it("ecrit les propositions : recette avec son titre, idee en texte avec son commentaire", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const dahl = await createRecipe(owner, f.spaceId, { title: "Dahl" });
    const idea = await owner.post(`${planOf(f.spaceId)}/ideas`, {
      name: "Raclette",
      comment: "En hiver",
    });
    const res = await owner.post(`${planOf(f.spaceId)}/generate/apply`, {
      cells: [
        {
          date: "2026-11-09",
          mealTime: "LUNCH",
          pick: { kind: "RECIPE", recipeId: dahl.id },
          seenUpdatedAt: null,
        },
        {
          date: "2026-11-09",
          mealTime: "DINNER",
          pick: { kind: "IDEA", ideaId: idea.body.id },
          seenUpdatedAt: null,
        },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.conflicts).toEqual([]);
    expect(res.body.data).toMatchObject([
      { mealTime: "LUNCH", kind: "RECIPE", title: "Dahl", locked: false },
      { mealTime: "DINNER", kind: "TEXT", title: "Raclette", comment: "En hiver" },
    ]);
  });

  it("n'ecrase pas une case modifiee ou remplie depuis le tirage, et le signale", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    for (const title of ["Dahl", "Curry", "Gratin", "Soupe"]) {
      await createRecipe(owner, f.spaceId, { title });
    }
    await owner.put(`${planOf(f.spaceId)}/meals/2026-11-09/LUNCH`, {
      kind: "TEXT",
      text: "Cantine",
    });
    const result = await preview(owner, f.spaceId, {
      from: "2026-11-09",
      to: "2026-11-10",
      replace: true,
    });
    // Entre-temps, un membre change le midi du 9 et remplit le soir du 10.
    const member = await loginAs(f.member, app);
    await member.put(`${planOf(f.spaceId)}/meals/2026-11-09/LUNCH`, {
      kind: "TEXT",
      text: "Pique-nique",
    });
    await member.put(`${planOf(f.spaceId)}/meals/2026-11-10/DINNER`, {
      kind: "TEXT",
      text: "Resto",
    });
    const res = await owner.post(`${planOf(f.spaceId)}/generate/apply`, {
      cells: keep(result.proposals),
    });
    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([
      { date: "2026-11-09", mealTime: "LUNCH" },
      { date: "2026-11-10", mealTime: "DINNER" },
    ]);
    expect(res.body.data).toHaveLength(2);
    const lunch = await db.mealSlot.findFirstOrThrow({
      where: { spaceId: f.spaceId, mealTime: "LUNCH", date: new Date("2026-11-09") },
    });
    expect(lunch.text).toBe("Pique-nique");
  });

  it("refuse un repas que l'espace ne planifie pas", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const dahl = await createRecipe(owner, f.spaceId);
    await db.mealPlanSettings.create({ data: { spaceId: f.spaceId, mealTimes: ["DINNER"] } });
    const res = await owner.post(`${planOf(f.spaceId)}/generate/apply`, {
      cells: [
        {
          date: "2026-11-09",
          mealTime: "LUNCH",
          pick: { kind: "RECIPE", recipeId: dahl.id },
          seenUpdatedAt: null,
        },
      ],
    });
    expect(res.body.error.code).toBe("MEAL_001");
  });
});

describe("proposer un autre repas", () => {
  const suggest = (client: Client, spaceId: string, date = "2026-11-10", mealTime = "DINNER") =>
    client.post(`${planOf(spaceId)}/meals/${date}/${mealTime}/suggest`);

  it("remplace la recette par une autre", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const dahl = await createRecipe(member, f.spaceId, { title: "Dahl" });
    await createRecipe(member, f.spaceId, { title: "Curry" });
    await member.put(`${planOf(f.spaceId)}/meals/2026-11-10/DINNER`, {
      kind: "RECIPE",
      recipeId: dahl.id,
    });
    const res = await suggest(member, f.spaceId);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ meal: { kind: "RECIPE", title: "Curry" }, reason: null });
  });

  it("rien a proposer : le repas reste, avec la raison", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    const dahl = await createRecipe(member, f.spaceId, { title: "Dahl" });
    await member.put(`${planOf(f.spaceId)}/meals/2026-11-10/DINNER`, {
      kind: "RECIPE",
      recipeId: dahl.id,
    });
    const res = await suggest(member, f.spaceId);
    expect(res.body).toEqual({ meal: null, reason: { code: "NO_RECIPE" } });
    const row = await db.mealSlot.findFirstOrThrow({ where: { spaceId: f.spaceId } });
    expect(row.recipeId).toBe(dahl.id);
  });

  it("une case vide recoit une proposition ; un repas verrouille est refuse", async () => {
    const f = await plannedGroup();
    const member = await loginAs(f.member, app);
    await createRecipe(member, f.spaceId, { title: "Dahl" });
    expect((await suggest(member, f.spaceId)).body.meal.title).toBe("Dahl");
    await member.put(`${planOf(f.spaceId)}/meals/2026-11-11/DINNER`, {
      kind: "TEXT",
      text: "Resto",
      locked: true,
    });
    expect((await suggest(member, f.spaceId, "2026-11-11")).body.error.code).toBe("MEAL_009");
  });

  it("suit le role minimal du planning (D58)", async () => {
    const f = await plannedGroup();
    await db.mealPlanSettings.create({ data: { spaceId: f.spaceId, editRole: "MODERATOR" } });
    const member = await loginAs(f.member, app);
    expect((await suggest(member, f.spaceId)).body.error.code).toBe("SPACE_002");
  });
});

describe("droits (D58)", () => {
  for (const actor of ACTORS) {
    const manage = actor === "MODERATOR" || actor === "OWNER";
    it(`generer - ${actor} ${manage ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const owner = await loginAs(f.owner, app);
      const profileId = await defaultProfile(owner, f.spaceId);
      const client = await clientAs(actor, f, app);
      const res = await client.post(`${planOf(f.spaceId)}/generate`, {
        profileId,
        from: "2026-11-09",
        to: "2026-11-09",
      });
      expectPermission(actor, manage, res);
    });

    it(`garder un planning - ${actor} ${manage ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      const res = await client.post(`${planOf(f.spaceId)}/generate/apply`, {
        cells: [
          {
            date: "2026-11-09",
            mealTime: "LUNCH",
            pick: { kind: "RECIPE", recipeId: "00000000-0000-4000-8000-000000000000" },
            seenUpdatedAt: null,
          },
        ],
      });
      expectPermission(actor, manage, res);
    });

    const edit = actor === "MEMBER" || manage;
    it(`proposer un autre repas - ${actor} ${edit ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      const res = await client.post(`${planOf(f.spaceId)}/meals/2026-11-10/DINNER/suggest`);
      expectPermission(actor, edit, res);
    });
  }
});

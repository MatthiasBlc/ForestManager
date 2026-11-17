// Planning (C5.4) : profils de generation. Profil "Standard" d'office et
// toujours un profil par defaut [D183] ; regles sur un tag ou une recette avec
// poids, repas, frequences et delai [D184] ; grille jours x repas des exclusions
// et epinglages [D114] ; tags fusionnes suivis, tags supprimes signales [D184].
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp, loginAs, type Client } from "./helpers/app.ts";
import { db } from "./helpers/db.ts";
import { createSpace, grantModule } from "./helpers/factories.ts";
import { createRecipe } from "./helpers/recipes.ts";
import { ACTORS, clientAs, expectPermission, groupFixture } from "./helpers/roles.ts";

const app = createTestApp();
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

beforeAll(async () => {
  await db.module.update({ where: { code: "meal-plan" }, data: { status: "AVAILABLE" } });
});

async function plannedGroup() {
  const f = await groupFixture();
  await grantModule(f.spaceId, "meal-plan");
  return f;
}

const profilesOf = (spaceId: string) => `/spaces/${spaceId}/meal-plan/profiles`;

type ProfileBody = {
  id: string;
  name: string;
  isDefault: boolean;
  ruleCount: number;
  cooldownDays: number;
  useIdeas: boolean;
  rules: { id: string; target: Record<string, unknown> }[];
  grid: Record<string, unknown>[];
};

async function list(client: Client, spaceId: string) {
  const res = await client.get(profilesOf(spaceId));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data as ProfileBody[];
}

async function standard(client: Client, spaceId: string) {
  const [first] = await list(client, spaceId);
  return first!;
}

async function create(client: Client, spaceId: string, name = "Ete leger") {
  const res = await client.post(profilesOf(spaceId), { name });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as ProfileBody;
}

async function globalTag(name = "Végétarien") {
  return db.tag.findFirstOrThrow({
    where: { scope: "GLOBAL", translations: { some: { name } } },
  });
}

async function addRule(client: Client, spaceId: string, profileId: string, body: object) {
  return client.post(`${profilesOf(spaceId)}/${profileId}/rules`, body);
}

describe("profil Standard d'office (D183)", () => {
  it("un espace sans profil en recoit un, par defaut, sans regle", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const profiles = await list(owner, f.spaceId);
    expect(profiles).toEqual([
      expect.objectContaining({ name: "Standard", isDefault: true, ruleCount: 0 }),
    ]);
    // Une seule creation, meme relu plusieurs fois.
    await list(owner, f.spaceId);
    expect(await db.mealGenerationProfile.count({ where: { spaceId: f.spaceId } })).toBe(1);
  });

  it("detail : delai de 3 jours, idees incluses, ni regle ni grille", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const res = await owner.get(`${profilesOf(f.spaceId)}/${id}`);
    expect(res.body).toMatchObject({ cooldownDays: 3, useIdeas: true, rules: [], grid: [] });
  });
});

describe("creer, modifier, dupliquer, supprimer", () => {
  it("cree un profil qui n'est pas par defaut, liste par defaut d'abord puis par nom", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    await standard(owner, f.spaceId);
    await create(owner, f.spaceId, "Hiver");
    await create(owner, f.spaceId, "Ete leger");
    const profiles = await list(owner, f.spaceId);
    expect(profiles.map((p) => [p.name, p.isDefault])).toEqual([
      ["Standard", true],
      ["Ete leger", false],
      ["Hiver", false],
    ]);
  });

  it("modifie nom, description, delai et idees", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const res = await owner.patch(`${profilesOf(f.spaceId)}/${id}`, {
      name: "Semaine classique",
      description: "  ",
      cooldownDays: 5,
      useIdeas: false,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({
      name: "Semaine classique",
      description: null,
      cooldownDays: 5,
      useIdeas: false,
    });
  });

  it("une modification sans description la garde", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const url = `${profilesOf(f.spaceId)}/${id}`;
    await owner.patch(url, { description: "Pour la semaine" });
    const res = await owner.patch(url, { cooldownDays: 4 });
    expect(res.body).toMatchObject({ description: "Pour la semaine", cooldownDays: 4 });
  });

  it("refuse un delai hors bornes", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    for (const cooldownDays of [-1, 31, 1.5]) {
      const res = await owner.patch(`${profilesOf(f.spaceId)}/${id}`, { cooldownDays });
      expect(res.body.error.code, String(cooldownDays)).toBe("VALIDATION_001");
    }
  });

  it("choisir un autre profil par defaut retire le precedent", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const before = await standard(owner, f.spaceId);
    const summer = await create(owner, f.spaceId);
    await owner.patch(`${profilesOf(f.spaceId)}/${summer.id}`, { isDefault: true });
    const profiles = await list(owner, f.spaceId);
    expect(profiles.find((p) => p.id === summer.id)?.isDefault).toBe(true);
    expect(profiles.find((p) => p.id === before.id)?.isDefault).toBe(false);
  });

  it("dupliquer copie reglages, regles et grille, sans etre par defaut", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const tag = await globalTag();
    await owner.patch(`${profilesOf(f.spaceId)}/${id}`, { cooldownDays: 6 });
    await addRule(owner, f.spaceId, id, { target: { kind: "TAG", tagId: tag.id }, weight: 1.5 });
    await owner.put(`${profilesOf(f.spaceId)}/${id}/grid`, {
      cells: [
        { weekday: "THU", mealTime: "LUNCH", state: "EXCLUDED" },
        { weekday: "FRI", mealTime: "DINNER", state: "PINNED", tagId: tag.id },
      ],
    });
    const res = await owner.post(`${profilesOf(f.spaceId)}/${id}/duplicate`);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Standard (copie)",
      isDefault: false,
      cooldownDays: 6,
      ruleCount: 1,
      rules: [{ weight: 1.5, target: { kind: "TAG", tag: { id: tag.id } } }],
    });
    expect(res.body.grid).toHaveLength(2);
  });

  it("supprime un profil qui n'est pas par defaut", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    await standard(owner, f.spaceId);
    const summer = await create(owner, f.spaceId);
    expect((await owner.delete(`${profilesOf(f.spaceId)}/${summer.id}`)).status).toBe(204);
    expect((await list(owner, f.spaceId)).map((p) => p.name)).toEqual(["Standard"]);
    expect((await owner.get(`${profilesOf(f.spaceId)}/${summer.id}`)).body.error.code).toBe(
      "MEAL_003"
    );
  });

  it("le profil par defaut se supprime en designant son remplacant", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const before = await standard(owner, f.spaceId);
    const summer = await create(owner, f.spaceId);
    const url = `${profilesOf(f.spaceId)}/${before.id}`;
    expect((await owner.delete(url)).body.error.code).toBe("MEAL_006");
    expect((await owner.delete(url, { defaultId: before.id })).body.error.code).toBe("MEAL_006");
    expect((await owner.delete(url, { defaultId: summer.id })).status).toBe(204);
    expect(await list(owner, f.spaceId)).toEqual([
      expect.objectContaining({ id: summer.id, isDefault: true }),
    ]);
  });

  it("le dernier profil ne se supprime pas", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    expect((await owner.delete(`${profilesOf(f.spaceId)}/${id}`)).body.error.code).toBe("MEAL_005");
  });

  it("profil d'un autre espace ou inconnu : MEAL_003", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const other = await createSpace(f.owner.id);
    await grantModule(other.id, "meal-plan");
    const elsewhere = await standard(owner, other.id);
    for (const id of [elsewhere.id, UNKNOWN]) {
      expect((await owner.get(`${profilesOf(f.spaceId)}/${id}`)).body.error.code).toBe("MEAL_003");
    }
  });

  it("au plus 20 profils par espace", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    await db.mealGenerationProfile.createMany({
      data: Array.from({ length: 19 }, (_, i) => ({ spaceId: f.spaceId, name: `P${String(i)}` })),
    });
    expect((await owner.post(profilesOf(f.spaceId), { name: "Trop" })).body.error.code).toBe(
      "MEAL_007"
    );
    expect((await owner.post(`${profilesOf(f.spaceId)}/${id}/duplicate`)).body.error.code).toBe(
      "MEAL_007"
    );
  });
});

describe("regles (D184)", () => {
  it("regle de tag : poids, repas, frequence par semaine par defaut, delai de tag", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const tag = await globalTag();
    const res = await addRule(owner, f.spaceId, id, {
      target: { kind: "TAG", tagId: tag.id },
      weight: 1.35,
      mealTime: "DINNER",
      frequencyMin: 2,
      frequencyMax: 3,
      tagCooldownDays: 2,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      target: { kind: "TAG", tag: { id: tag.id, name: "Végétarien", status: "ACTIVE" } },
      weight: 1.35,
      mealTime: "DINNER",
      frequencyMin: 2,
      frequencyMax: 3,
      frequencyPer: "PER_WEEK",
      tagCooldownDays: 2,
    });
    expect((await standard(owner, f.spaceId)).ruleCount).toBe(1);
  });

  it("regle sur un tag de l'espace ; refuse le tag d'un autre espace", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const mine = await owner.post(`/spaces/${f.spaceId}/recipes/tags`, { name: "Dimanche" });
    const other = await createSpace(f.owner.id);
    const foreign = await owner.post(`/spaces/${other.id}/recipes/tags`, { name: "Ailleurs" });
    expect(
      (await addRule(owner, f.spaceId, id, { target: { kind: "TAG", tagId: mine.body.id } })).status
    ).toBe(201);
    const res = await addRule(owner, f.spaceId, id, {
      target: { kind: "TAG", tagId: foreign.body.id },
    });
    expect(res.body.error.code).toBe("RECIPE_003");
  });

  it("regle de recette : visible dans l'espace, sans frequence ni delai de tag", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const recipe = await createRecipe(owner, f.spaceId, { title: "Dahl" });
    const ok = await addRule(owner, f.spaceId, id, {
      target: { kind: "RECIPE", recipeId: recipe.id },
      weight: 0.5,
    });
    expect(ok.body).toMatchObject({
      target: { kind: "RECIPE", recipe: { id: recipe.id, title: "Dahl" } },
      frequencyPer: null,
    });
    const withFrequency = await addRule(owner, f.spaceId, id, {
      target: { kind: "RECIPE", recipeId: recipe.id },
      frequencyMax: 1,
    });
    expect(withFrequency.body.error.code).toBe("VALIDATION_001");
    const elsewhere = await createRecipe(owner, (await createSpace(f.owner.id)).id);
    const invisible = await addRule(owner, f.spaceId, id, {
      target: { kind: "RECIPE", recipeId: elsewhere.id },
    });
    expect(invisible.body.error.code).toBe("RECIPE_001");
  });

  it("refuse un poids hors pas de 5 %, ou un minimum au-dessus du maximum", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const target = { kind: "TAG", tagId: (await globalTag()).id };
    for (const body of [
      { target, weight: 1.33 },
      { target, weight: 2.05 },
      { target, frequencyMin: 3, frequencyMax: 2 },
      { target, frequencyMin: 0 },
    ]) {
      const res = await addRule(owner, f.spaceId, id, body);
      expect(res.body.error.code, JSON.stringify(body)).toBe("VALIDATION_001");
    }
  });

  it("modifie puis supprime une regle", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const target = { kind: "TAG", tagId: (await globalTag()).id };
    const rule = (await addRule(owner, f.spaceId, id, { target })).body as { id: string };
    const url = `${profilesOf(f.spaceId)}/${id}/rules/${rule.id}`;
    const updated = await owner.put(url, {
      target,
      weight: 0,
      frequencyMax: 4,
      frequencyPer: "PER_PERIOD",
    });
    expect(updated.body).toMatchObject({ weight: 0, frequencyMax: 4, frequencyPer: "PER_PERIOD" });
    expect((await owner.delete(url)).status).toBe(204);
    expect((await owner.delete(url)).body.error.code).toBe("MEAL_004");
  });

  it("une regle d'un autre profil : MEAL_004", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const summer = await create(owner, f.spaceId);
    const target = { kind: "TAG", tagId: (await globalTag()).id };
    const rule = (await addRule(owner, f.spaceId, id, { target })).body as { id: string };
    const res = await owner.delete(`${profilesOf(f.spaceId)}/${summer.id}/rules/${rule.id}`);
    expect(res.body.error.code).toBe("MEAL_004");
  });

  it("au plus 30 regles par profil", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const tag = await globalTag();
    await db.mealGenerationRule.createMany({
      data: Array.from({ length: 30 }, (_, position) => ({
        profileId: id,
        tagId: tag.id,
        position,
      })),
    });
    const res = await addRule(owner, f.spaceId, id, { target: { kind: "TAG", tagId: tag.id } });
    expect(res.body.error.code).toBe("MEAL_008");
  });

  it("regles dans l'ordre de declaration", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const first = await globalTag("Végétarien");
    const second = await globalTag("Rapide");
    await addRule(owner, f.spaceId, id, { target: { kind: "TAG", tagId: first.id } });
    await addRule(owner, f.spaceId, id, { target: { kind: "TAG", tagId: second.id } });
    const res = await owner.get(`${profilesOf(f.spaceId)}/${id}`);
    expect(res.body.rules.map((r: ProfileBody["rules"][number]) => r.target)).toMatchObject([
      { tag: { id: first.id } },
      { tag: { id: second.id } },
    ]);
  });
});

describe("tags fusionnes ou supprimes, recette invisible (D184)", () => {
  it("un tag fusionne suit sa cible, un tag supprime est signale", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const merged = await owner.post(`/spaces/${f.spaceId}/recipes/tags`, { name: "Veggie" });
    const gone = await owner.post(`/spaces/${f.spaceId}/recipes/tags`, { name: "Ancien" });
    const target = await globalTag();
    await addRule(owner, f.spaceId, id, { target: { kind: "TAG", tagId: merged.body.id } });
    await owner.put(`${profilesOf(f.spaceId)}/${id}/grid`, {
      cells: [{ weekday: "FRI", mealTime: "DINNER", state: "PINNED", tagId: gone.body.id }],
    });
    await db.tag.update({
      where: { id: merged.body.id },
      data: { mergedIntoId: target.id, deletedAt: new Date() },
    });
    await db.tag.update({ where: { id: gone.body.id }, data: { deletedAt: new Date() } });
    const res = await owner.get(`${profilesOf(f.spaceId)}/${id}`);
    expect(res.body.rules[0].target.tag).toEqual({
      id: target.id,
      name: "Végétarien",
      status: "ACTIVE",
    });
    expect(res.body.grid[0].tag).toMatchObject({
      id: gone.body.id,
      name: "Ancien",
      status: "DELETED",
    });
  });

  it("une recette retiree de l'espace laisse une regle sans titre", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const recipe = await createRecipe(owner, f.spaceId);
    await addRule(owner, f.spaceId, id, { target: { kind: "RECIPE", recipeId: recipe.id } });
    await owner.delete(`/spaces/${f.spaceId}/recipes/${recipe.id}`);
    const res = await owner.get(`${profilesOf(f.spaceId)}/${id}`);
    expect(res.body.rules[0].target).toEqual({
      kind: "RECIPE",
      recipe: { id: recipe.id, title: null },
    });
  });
});

describe("grille jours x repas (D114)", () => {
  it("remplace exclusions et epinglages d'un coup", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const tag = await globalTag();
    const url = `${profilesOf(f.spaceId)}/${id}/grid`;
    await owner.put(url, {
      cells: [
        { weekday: "THU", mealTime: "LUNCH", state: "EXCLUDED" },
        { weekday: "FRI", mealTime: "DINNER", state: "PINNED", tagId: tag.id },
      ],
    });
    const res = await owner.put(url, {
      cells: [{ weekday: "MON", mealTime: "LUNCH", state: "EXCLUDED" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.grid).toEqual([{ weekday: "MON", mealTime: "LUNCH", state: "EXCLUDED" }]);
  });

  it("grille triee par jour de la semaine puis midi avant soir", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const res = await owner.put(`${profilesOf(f.spaceId)}/${id}/grid`, {
      cells: [
        { weekday: "SUN", mealTime: "LUNCH", state: "EXCLUDED" },
        { weekday: "MON", mealTime: "DINNER", state: "EXCLUDED" },
        { weekday: "MON", mealTime: "LUNCH", state: "EXCLUDED" },
      ],
    });
    expect(
      res.body.grid.map((c: { weekday: string; mealTime: string }) => `${c.weekday}/${c.mealTime}`)
    ).toEqual(["MON/LUNCH", "MON/DINNER", "SUN/LUNCH"]);
  });

  it("refuse deux etats pour une case et un tag inconnu", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const { id } = await standard(owner, f.spaceId);
    const url = `${profilesOf(f.spaceId)}/${id}/grid`;
    const twice = await owner.put(url, {
      cells: [
        { weekday: "THU", mealTime: "LUNCH", state: "EXCLUDED" },
        { weekday: "THU", mealTime: "LUNCH", state: "PINNED", tagId: (await globalTag()).id },
      ],
    });
    expect(twice.body.error.code).toBe("VALIDATION_001");
    const unknown = await owner.put(url, {
      cells: [{ weekday: "THU", mealTime: "LUNCH", state: "PINNED", tagId: UNKNOWN }],
    });
    expect(unknown.body.error.code).toBe("RECIPE_003");
  });
});

describe("droits (D58)", () => {
  for (const actor of ACTORS) {
    const allowed = actor === "MODERATOR" || actor === "OWNER";
    it(`lister les profils - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      expectPermission(actor, allowed, await client.get(profilesOf(f.spaceId)));
    });

    it(`creer un profil - ${actor} ${allowed ? "autorise" : "refuse"}`, async () => {
      const f = await plannedGroup();
      const client = await clientAs(actor, f, app);
      expectPermission(actor, allowed, await client.post(profilesOf(f.spaceId), { name: "X" }));
    });
  }

  it("espace perso : son proprietaire gere ses profils (F-MPL-1)", async () => {
    const f = await plannedGroup();
    const owner = await loginAs(f.owner, app);
    const personal = await db.space.findFirstOrThrow({
      where: { kind: "PERSONAL", memberships: { some: { userId: f.owner.id } } },
    });
    await grantModule(personal.id, "meal-plan");
    expect(await list(owner, personal.id)).toHaveLength(1);
  });
});

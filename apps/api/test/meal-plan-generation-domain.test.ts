// Planning (C5.5) : algorithme de generation, domaine pur [D184, D113, D24].
// Tests deterministes grace a la graine injectee : chaque contrainte, leurs
// conflits, les idees, le calendrier continu (repas avant et apres la periode).
import { describe, expect, it } from "vitest";

import {
  generate,
  type GenerationInput,
  type PoolRecipe,
  type ProfileRule,
} from "../src/modules/meal-plan/domain/generate.ts";
import { seededRandom } from "../src/modules/meal-plan/domain/random.ts";

const recipe = (id: string, tagIds: string[] = [], isBase = false): PoolRecipe => ({
  id,
  tagIds,
  isBase,
});

const rule = (over: Partial<ProfileRule> & { id: string }): ProfileRule => ({
  tagId: null,
  recipeId: null,
  weight: 1,
  mealTime: null,
  frequencyMin: null,
  frequencyMax: null,
  frequencyPer: null,
  tagCooldownDays: null,
  ...over,
});

/** Semaine du lundi 9 au dimanche 15 novembre 2026, midi et soir, sans repas. */
function input(over: Partial<GenerationInput> = {}): GenerationInput {
  return {
    from: "2026-11-09",
    to: "2026-11-15",
    mealTimes: ["LUNCH", "DINNER"],
    weekStartsOn: "MON",
    meals: [],
    context: [],
    profile: { cooldownDays: 0, useIdeas: false, rules: [], exclusions: [], pins: [] },
    recipes: Array.from({ length: 20 }, (_, i) => recipe(`r${String(i)}`)),
    ideas: [],
    replace: false,
    random: seededRandom(42),
    ...over,
  };
}

const picked = (result: ReturnType<typeof generate>) =>
  result.proposals.map((p) => (p.pick ? p.pick.id : null));

const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

describe("tirage", () => {
  it("meme graine, meme planning ; graine differente, planning different", () => {
    const a = generate(input({ random: seededRandom(1) }));
    const b = generate(input({ random: seededRandom(1) }));
    const c = generate(input({ random: seededRandom(2) }));
    expect(picked(a)).toEqual(picked(b));
    expect(picked(a)).not.toEqual(picked(c));
  });

  it("une proposition par repas planifie, dans l'ordre du calendrier", () => {
    const result = generate(input({ mealTimes: ["DINNER"], from: "2026-11-09", to: "2026-11-11" }));
    expect(result.proposals.map((p) => `${p.date}/${p.mealTime}`)).toEqual([
      "2026-11-09/DINNER",
      "2026-11-10/DINNER",
      "2026-11-11/DINNER",
    ]);
    expect(result.proposals.every((p) => p.pick?.kind === "RECIPE")).toBe(true);
  });

  it("une recette de base n'est jamais proposee (D24)", () => {
    const result = generate(
      input({
        recipes: [recipe("sauce", [], true), recipe("plat")],
        from: "2026-11-09",
        to: "2026-11-09",
      })
    );
    expect(picked(result)).toEqual(["plat", "plat"]);
  });

  it("sans aucune recette : chaque case vide, expliquee", () => {
    const result = generate(input({ recipes: [], from: "2026-11-09", to: "2026-11-09" }));
    expect(result.proposals).toEqual([
      { date: "2026-11-09", mealTime: "LUNCH", pick: null, reason: { code: "NO_RECIPE" } },
      { date: "2026-11-09", mealTime: "DINNER", pick: null, reason: { code: "NO_RECIPE" } },
    ]);
  });
});

describe("cases sautees : verrou, repas gardes, Pas de repas, exclusions", () => {
  it("garde les repas remplis, ne remplit que les cases vides", () => {
    const result = generate(
      input({
        from: "2026-11-09",
        to: "2026-11-09",
        meals: [
          {
            date: "2026-11-09",
            mealTime: "LUNCH",
            kind: "TEXT",
            recipeId: null,
            tagIds: [],
            locked: false,
          },
        ],
      })
    );
    expect(result.proposals.map((p) => p.mealTime)).toEqual(["DINNER"]);
    expect(result.skipped).toEqual({ excluded: 0, locked: 0, kept: 1, skippedMeals: 0 });
  });

  it("remplacer : seuls les repas verrouilles et Pas de repas restent", () => {
    const result = generate(
      input({
        from: "2026-11-09",
        to: "2026-11-10",
        mealTimes: ["DINNER"],
        replace: true,
        meals: [
          {
            date: "2026-11-09",
            mealTime: "DINNER",
            kind: "RECIPE",
            recipeId: "r1",
            tagIds: [],
            locked: true,
          },
          {
            date: "2026-11-10",
            mealTime: "DINNER",
            kind: "SKIPPED",
            recipeId: null,
            tagIds: [],
            locked: false,
          },
        ],
      })
    );
    expect(result.proposals).toEqual([]);
    expect(result.skipped).toEqual({ excluded: 0, locked: 1, kept: 0, skippedMeals: 1 });
    const replaced = generate(
      input({
        from: "2026-11-09",
        to: "2026-11-09",
        mealTimes: ["DINNER"],
        replace: true,
        meals: [
          {
            date: "2026-11-09",
            mealTime: "DINNER",
            kind: "TEXT",
            recipeId: null,
            tagIds: [],
            locked: false,
          },
        ],
      })
    );
    expect(replaced.proposals).toHaveLength(1);
  });

  it("une case exclue par le profil n'est pas generee (jour de la semaine)", () => {
    const result = generate(
      input({
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [],
          exclusions: [{ weekday: "THU", mealTime: "LUNCH" }],
          pins: [],
        },
      })
    );
    expect(result.proposals.some((p) => p.date === "2026-11-12" && p.mealTime === "LUNCH")).toBe(
      false
    );
    expect(result.proposals).toHaveLength(13);
    expect(result.skipped.excluded).toBe(1);
  });
});

describe("epinglage (D114)", () => {
  it("une case epinglee ne recoit qu'une recette du tag", () => {
    const recipes = [
      recipe("poisson1", ["fish"]),
      recipe("poisson2", ["fish"]),
      ...input().recipes,
    ];
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = generate(
        input({
          recipes,
          random: seededRandom(seed),
          profile: {
            cooldownDays: 0,
            useIdeas: false,
            rules: [],
            exclusions: [],
            pins: [{ weekday: "FRI", mealTime: "DINNER", tagId: "fish" }],
          },
        })
      );
      const friday = result.proposals.find(
        (p) => p.date === "2026-11-13" && p.mealTime === "DINNER"
      );
      expect(["poisson1", "poisson2"]).toContain(friday?.pick?.id);
    }
  });

  it("aucune recette du tag epingle : case vide expliquee", () => {
    const result = generate(
      input({
        from: "2026-11-13",
        to: "2026-11-13",
        mealTimes: ["DINNER"],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [],
          exclusions: [],
          pins: [{ weekday: "FRI", mealTime: "DINNER", tagId: "fish" }],
        },
      })
    );
    expect(result.proposals[0]).toMatchObject({
      pick: null,
      reason: { code: "PIN", tagId: "fish" },
    });
  });
});

describe("delai entre deux fois la meme recette (calendrier continu)", () => {
  it("pas deux fois la meme recette a moins de N jours dans la periode", () => {
    const result = generate(
      input({
        recipes: Array.from({ length: 8 }, (_, i) => recipe(`r${String(i)}`)),
        profile: { cooldownDays: 3, useIdeas: false, rules: [], exclusions: [], pins: [] },
      })
    );
    const seen = new Map<string, string>();
    for (const p of result.proposals) {
      const id = p.pick?.id;
      if (!id) continue;
      const before = seen.get(id);
      if (before) expect(daysApart(before, p.date)).toBeGreaterThan(3);
      seen.set(id, p.date);
    }
  });

  it("regarde les repas deja places avant et apres la periode", () => {
    const result = generate(
      input({
        from: "2026-11-10",
        to: "2026-11-10",
        mealTimes: ["DINNER"],
        recipes: [recipe("hier"), recipe("demain"), recipe("libre")],
        context: [
          { date: "2026-11-09", mealTime: "DINNER", recipeId: "hier", tagIds: [] },
          { date: "2026-11-12", mealTime: "LUNCH", recipeId: "demain", tagIds: [] },
        ],
        profile: { cooldownDays: 3, useIdeas: false, rules: [], exclusions: [], pins: [] },
      })
    );
    expect(picked(result)).toEqual(["libre"]);
  });

  it("toutes les recettes deja cuisinees recemment : case vide expliquee", () => {
    const result = generate(
      input({
        from: "2026-11-10",
        to: "2026-11-10",
        mealTimes: ["DINNER"],
        recipes: [recipe("hier")],
        context: [{ date: "2026-11-09", mealTime: "DINNER", recipeId: "hier", tagIds: [] }],
        profile: { cooldownDays: 3, useIdeas: false, rules: [], exclusions: [], pins: [] },
      })
    );
    expect(result.proposals[0]).toMatchObject({
      pick: null,
      reason: { code: "COOLDOWN", days: 3 },
    });
  });
});

describe("regles de tag : delai, frequence maximale (D184)", () => {
  const pasta = [recipe("p1", ["pasta"]), recipe("p2", ["pasta"]), recipe("p3", ["pasta"])];

  it("delai entre deux recettes d'un meme tag", () => {
    const result = generate(
      input({
        mealTimes: ["DINNER"],
        recipes: pasta,
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [rule({ id: "a", tagId: "pasta", tagCooldownDays: 2 })],
          exclusions: [],
          pins: [],
        },
      })
    );
    expect(result.proposals.map((p) => (p.pick ? p.date : null))).toEqual([
      "2026-11-09",
      null,
      null,
      "2026-11-12",
      null,
      null,
      "2026-11-15",
    ]);
    expect(result.proposals[1]?.reason).toEqual({ code: "TAG_COOLDOWN", tagIds: ["pasta"] });
  });

  it("frequence maximale par semaine du calendrier, repas hors periode compris", () => {
    const result = generate(
      input({
        from: "2026-11-12",
        to: "2026-11-15",
        mealTimes: ["DINNER"],
        recipes: [...pasta, recipe("autre")],
        // Deja deux pates lundi et mardi de la meme semaine, hors periode.
        context: [
          { date: "2026-11-09", mealTime: "DINNER", recipeId: "p1", tagIds: ["pasta"] },
          { date: "2026-11-10", mealTime: "DINNER", recipeId: "p2", tagIds: ["pasta"] },
        ],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [rule({ id: "a", tagId: "pasta", frequencyMax: 2, frequencyPer: "PER_WEEK" })],
          exclusions: [],
          pins: [],
        },
      })
    );
    expect(picked(result)).toEqual(["autre", "autre", "autre", "autre"]);
  });

  it("la semaine suivante repart de zero", () => {
    const result = generate(
      input({
        from: "2026-11-15",
        to: "2026-11-16",
        mealTimes: ["DINNER"],
        recipes: pasta,
        context: [{ date: "2026-11-14", mealTime: "DINNER", recipeId: "p1", tagIds: ["pasta"] }],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [rule({ id: "a", tagId: "pasta", frequencyMax: 1, frequencyPer: "PER_WEEK" })],
          exclusions: [],
          pins: [],
        },
      })
    );
    // Dimanche 15 : meme semaine que samedi 14 (deja une) ; lundi 16 : nouvelle semaine.
    expect(result.proposals[0]).toMatchObject({ pick: null, reason: { code: "FREQUENCY_MAX" } });
    expect(result.proposals[1]?.pick?.kind).toBe("RECIPE");
  });

  it("frequence maximale sur la periode", () => {
    const result = generate(
      input({
        mealTimes: ["DINNER"],
        recipes: [...pasta, recipe("autre")],
        random: seededRandom(7),
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [
            rule({
              id: "a",
              tagId: "pasta",
              weight: 2,
              frequencyMax: 1,
              frequencyPer: "PER_PERIOD",
            }),
          ],
          exclusions: [],
          pins: [],
        },
      })
    );
    expect(picked(result).filter((id) => id?.startsWith("p"))).toHaveLength(1);
  });

  it("un epinglage passe outre la frequence maximale, avec un avertissement", () => {
    const result = generate(
      input({
        from: "2026-11-13",
        to: "2026-11-13",
        mealTimes: ["DINNER"],
        recipes: pasta,
        context: [{ date: "2026-11-09", mealTime: "DINNER", recipeId: "p1", tagIds: ["pasta"] }],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [rule({ id: "a", tagId: "pasta", frequencyMax: 1, frequencyPer: "PER_WEEK" })],
          exclusions: [],
          pins: [{ weekday: "FRI", mealTime: "DINNER", tagId: "pasta" }],
        },
      })
    );
    expect(result.proposals[0]?.pick?.kind).toBe("RECIPE");
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "MAX_EXCEEDED",
        ruleId: "a",
        tagId: "pasta",
        max: 1,
        actual: 2,
      }),
    ]);
  });
});

describe("poids (D184)", () => {
  it("poids nul : jamais propose ; limite a un repas si la regle l'est", () => {
    const recipes = [recipe("salade", ["light"]), recipe("plat")];
    const profile = {
      cooldownDays: 0,
      useIdeas: false,
      rules: [rule({ id: "a", tagId: "light", weight: 0, mealTime: "DINNER" as const })],
      exclusions: [],
      pins: [],
    };
    const dinners = generate(input({ recipes, profile, mealTimes: ["DINNER"] }));
    expect(new Set(picked(dinners))).toEqual(new Set(["plat"]));
    const lunches = generate(
      input({ recipes, profile, mealTimes: ["LUNCH"], random: seededRandom(3) })
    );
    expect(picked(lunches)).toContain("salade");
  });

  it("une regle de recette a poids nul l'ecarte", () => {
    const result = generate(
      input({
        recipes: [recipe("dahl"), recipe("plat")],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [rule({ id: "a", recipeId: "dahl", weight: 0 })],
          exclusions: [],
          pins: [],
        },
      })
    );
    expect(new Set(picked(result))).toEqual(new Set(["plat"]));
  });

  it("seules des recettes de poids nul : case vide expliquee", () => {
    const result = generate(
      input({
        from: "2026-11-09",
        to: "2026-11-09",
        mealTimes: ["DINNER"],
        recipes: [recipe("dahl")],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [rule({ id: "a", recipeId: "dahl", weight: 0 })],
          exclusions: [],
          pins: [],
        },
      })
    );
    expect(result.proposals[0]?.reason).toEqual({ code: "WEIGHT_ZERO" });
  });

  it("les poids se multiplient : x2 contre x0,5 donne environ quatre fois plus", () => {
    const counts = { more: 0, less: 0 };
    const random = seededRandom(123);
    for (let i = 0; i < 2000; i++) {
      const result = generate(
        input({
          from: "2026-11-09",
          to: "2026-11-09",
          mealTimes: ["DINNER"],
          random,
          recipes: [recipe("more", ["a", "b"]), recipe("less", ["c"])],
          profile: {
            cooldownDays: 0,
            useIdeas: false,
            rules: [
              rule({ id: "1", tagId: "a", weight: 1.5 }),
              rule({ id: "2", tagId: "b", weight: 2 / 1.5 }),
              rule({ id: "3", tagId: "c", weight: 0.5 }),
            ],
            exclusions: [],
            pins: [],
          },
        })
      );
      const id = result.proposals[0]?.pick?.id;
      if (id === "more" || id === "less") counts[id]++;
    }
    expect(counts.more / counts.less).toBeGreaterThan(3.3);
    expect(counts.more / counts.less).toBeLessThan(4.8);
  });
});

describe("frequence minimale : rattrapage (D184)", () => {
  it("atteint le minimum par semaine en remplacant des repas", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const result = generate(
        input({
          random: seededRandom(seed),
          recipes: [recipe("v1", ["veggie"]), recipe("v2", ["veggie"]), ...input().recipes],
          profile: {
            cooldownDays: 0,
            useIdeas: false,
            rules: [
              rule({
                id: "a",
                tagId: "veggie",
                weight: 0.05,
                frequencyMin: 3,
                frequencyPer: "PER_WEEK",
              }),
            ],
            exclusions: [],
            pins: [],
          },
        })
      );
      const veggie = result.proposals.filter((p) => p.pick?.id.startsWith("v")).length;
      expect(veggie, `graine ${String(seed)}`).toBeGreaterThanOrEqual(3);
      expect(result.warnings).toEqual([]);
    }
  });

  it("compte les repas deja places dans la semaine", () => {
    const result = generate(
      input({
        from: "2026-11-14",
        to: "2026-11-15",
        mealTimes: ["DINNER"],
        recipes: [recipe("v1", ["veggie"]), recipe("plat")],
        context: [
          { date: "2026-11-09", mealTime: "DINNER", recipeId: "v1", tagIds: ["veggie"] },
          { date: "2026-11-10", mealTime: "DINNER", recipeId: "v1", tagIds: ["veggie"] },
        ],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [rule({ id: "a", tagId: "veggie", weight: 0, mealTime: null, frequencyMin: 2 })],
          exclusions: [],
          pins: [],
        },
      })
    );
    // Minimum deja atteint hors periode : rien a rattraper, poids nul respecte.
    expect(picked(result)).toEqual(["plat", "plat"]);
    expect(result.warnings).toEqual([]);
  });

  it("minimum impossible : avertissement avec le compte atteint", () => {
    const result = generate(
      input({
        mealTimes: ["DINNER"],
        recipes: [recipe("v1", ["veggie"]), recipe("plat")],
        profile: {
          cooldownDays: 3,
          useIdeas: false,
          rules: [rule({ id: "a", tagId: "veggie", frequencyMin: 4, frequencyPer: "PER_WEEK" })],
          exclusions: [],
          pins: [],
        },
      })
    );
    expect(result.warnings).toEqual([
      {
        code: "MIN_NOT_MET",
        ruleId: "a",
        tagId: "veggie",
        required: 4,
        actual: 2,
        from: "2026-11-09",
        to: "2026-11-15",
      },
    ]);
  });

  it("le rattrapage ne touche ni aux cases epinglees ni a la frequence maximale d'un autre tag", () => {
    const result = generate(
      input({
        mealTimes: ["DINNER"],
        recipes: [recipe("vp", ["veggie", "pasta"]), recipe("p", ["pasta"]), recipe("x")],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [
            rule({ id: "max", tagId: "pasta", frequencyMax: 1, frequencyPer: "PER_WEEK" }),
            rule({ id: "min", tagId: "veggie", frequencyMin: 3, frequencyPer: "PER_WEEK" }),
          ],
          exclusions: [],
          pins: [{ weekday: "MON", mealTime: "DINNER", tagId: "pasta" }],
        },
      })
    );
    const pastaCount = result.proposals.filter(
      (p) => p.pick?.id === "vp" || p.pick?.id === "p"
    ).length;
    // L'epinglage du lundi compte deja une pates : le rattrapage ne peut pas en ajouter.
    expect(pastaCount).toBe(1);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "MIN_NOT_MET", ruleId: "min" })
    );
  });

  it("minimums concurrents : dans l'ordre de declaration des regles", () => {
    const result = generate(
      input({
        from: "2026-11-09",
        to: "2026-11-10",
        mealTimes: ["DINNER"],
        recipes: [recipe("a1", ["a"]), recipe("b1", ["b"]), recipe("x")],
        profile: {
          cooldownDays: 0,
          useIdeas: false,
          rules: [
            rule({
              id: "ra",
              tagId: "a",
              weight: 0.01,
              frequencyMin: 2,
              frequencyPer: "PER_PERIOD",
            }),
            rule({
              id: "rb",
              tagId: "b",
              weight: 0.01,
              frequencyMin: 2,
              frequencyPer: "PER_PERIOD",
            }),
          ],
          exclusions: [],
          pins: [],
        },
      })
    );
    expect(picked(result)).toEqual(["a1", "a1"]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "MIN_NOT_MET", ruleId: "rb" }),
    ]);
  });
});

describe("idees de repas (D182)", () => {
  const ideas = [{ id: "i1" }, { id: "i2" }];

  it("proposees si le profil les inclut, chacune une fois au plus", () => {
    const result = generate(
      input({
        recipes: [],
        ideas,
        profile: { cooldownDays: 0, useIdeas: true, rules: [], exclusions: [], pins: [] },
      })
    );
    const chosen = result.proposals.flatMap((p) => (p.pick?.kind === "IDEA" ? [p.pick.id] : []));
    expect(chosen.sort()).toEqual(["i1", "i2"]);
    expect(result.proposals.filter((p) => p.pick === null)).toHaveLength(12);
  });

  it("ignorees si le profil ne les inclut pas, et jamais sur une case epinglee", () => {
    const excluded = generate(input({ recipes: [], ideas, from: "2026-11-09", to: "2026-11-09" }));
    expect(picked(excluded)).toEqual([null, null]);
    const pinned = generate(
      input({
        recipes: [],
        ideas,
        from: "2026-11-09",
        to: "2026-11-09",
        mealTimes: ["DINNER"],
        profile: {
          cooldownDays: 0,
          useIdeas: true,
          rules: [],
          exclusions: [],
          pins: [{ weekday: "MON", mealTime: "DINNER", tagId: "fish" }],
        },
      })
    );
    expect(picked(pinned)).toEqual([null]);
  });
});

describe("proposer un autre repas (une case)", () => {
  it("ne propose pas la recette actuelle et tient compte des autres repas de la periode", () => {
    const result = generate(
      input({
        from: "2026-11-10",
        to: "2026-11-10",
        mealTimes: ["DINNER"],
        recipes: [recipe("actuelle"), recipe("voisine"), recipe("autre")],
        context: [{ date: "2026-11-11", mealTime: "DINNER", recipeId: "voisine", tagIds: [] }],
        meals: [
          {
            date: "2026-11-10",
            mealTime: "DINNER",
            kind: "RECIPE",
            recipeId: "actuelle",
            tagIds: [],
            locked: false,
          },
        ],
        replace: true,
        avoid: { kind: "RECIPE", id: "actuelle" },
        profile: { cooldownDays: 2, useIdeas: false, rules: [], exclusions: [], pins: [] },
      })
    );
    expect(picked(result)).toEqual(["autre"]);
  });
});

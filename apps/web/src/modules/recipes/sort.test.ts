// Ordre de la liste des recettes [D217] : choix retenu sur l'appareil, tri hors ligne.
import { beforeEach, describe, expect, it } from "vitest";

import { readRecipeSort, sortRecipes, writeRecipeSort } from "./sort.ts";

beforeEach(() => {
  localStorage.clear();
});

const recipe = (title: string, createdAt: string, totalMinutes: number | null) => ({
  title,
  createdAt,
  totalMinutes,
});

describe("ordre des recettes (D217)", () => {
  it("A a Z par defaut ; le choix est retenu, une valeur inconnue est ignoree", () => {
    expect(readRecipeSort()).toBe("title");
    writeRecipeSort("time-desc");
    expect(readRecipeSort()).toBe("time-desc");
    localStorage.setItem("fm:recipeSort", "nope");
    expect(readRecipeSort()).toBe("title");
  });

  it("trie hors ligne comme l'API : sans temps a la fin dans les deux sens", () => {
    const list = [
      recipe("Éclair", "2026-01-02T00:00:00.000Z", 30),
      recipe("dahl", "2026-01-03T00:00:00.000Z", null),
      recipe("Bouillon", "2026-01-01T00:00:00.000Z", 90),
    ];
    const titles = (sort: Parameters<typeof sortRecipes>[1]) =>
      sortRecipes(list, sort).map((r) => r.title);
    expect(titles("title")).toEqual(["Bouillon", "dahl", "Éclair"]);
    expect(titles("title-desc")).toEqual(["Éclair", "dahl", "Bouillon"]);
    expect(titles("recent")).toEqual(["dahl", "Éclair", "Bouillon"]);
    expect(titles("oldest")).toEqual(["Bouillon", "Éclair", "dahl"]);
    expect(titles("time")).toEqual(["Éclair", "Bouillon", "dahl"]);
    expect(titles("time-desc")).toEqual(["Bouillon", "Éclair", "dahl"]);
  });
});

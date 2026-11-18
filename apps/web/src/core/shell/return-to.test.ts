// Page de retour d'une recette (D219) : derniere page visitee hors des pages d'une recette.
import { beforeEach, describe, expect, it } from "vitest";

import { isRecipePage, recipeBackMove, recipeBackTarget, rememberPage } from "./return-to.ts";

const SPACE = "00000000-0000-4000-8000-000000000001";
const RECIPE = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "");
});

/** Position dans l'historique de l'onglet, comme la pose le routeur (`idx`). */
const at = (idx: number) => {
  window.history.replaceState({ idx }, "");
};

describe("isRecipePage", () => {
  it("reconnait la recette et ses sous-pages, y compris la creation", () => {
    for (const path of ["", "/edit", "/cook", "/history", "/compare", "/suggest"]) {
      expect(isRecipePage(`/s/${SPACE}/recipes/${RECIPE}${path}`)).toBe(true);
    }
    expect(isRecipePage(`/s/${SPACE}/recipes/${RECIPE}/suggestions/abc`)).toBe(true);
    expect(isRecipePage(`/s/${SPACE}/recipes/new`)).toBe(true);
  });

  it("laisse de cote la liste, les tags et les autres pages", () => {
    for (const path of [
      `/s/${SPACE}/recipes`,
      `/s/${SPACE}/recipes/`,
      `/s/${SPACE}/recipes/tags`,
      `/s/${SPACE}/meal-plan`,
      `/s/${SPACE}/home`,
      "/notifications",
    ]) {
      expect(isRecipePage(path)).toBe(false);
    }
  });
});

describe("recipeBackTarget", () => {
  it("sans page retenue : la liste des recettes de l'espace", () => {
    expect(recipeBackTarget(SPACE)).toBe(`/s/${SPACE}/recipes`);
  });

  it("renvoie la derniere page retenue, parametres compris", () => {
    rememberPage(`/s/${SPACE}/meal-plan?day=2026-11-17&view=week`);
    expect(recipeBackTarget(SPACE)).toBe(`/s/${SPACE}/meal-plan?day=2026-11-17&view=week`);
    rememberPage("/notifications");
    expect(recipeBackTarget(SPACE)).toBe("/notifications");
  });

  it("ignore les pages d'une recette : le retour saute les sous-pages", () => {
    rememberPage(`/s/${SPACE}/home`);
    rememberPage(`/s/${SPACE}/recipes/${RECIPE}`);
    rememberPage(`/s/${SPACE}/recipes/${RECIPE}/history`);
    expect(recipeBackTarget(SPACE)).toBe(`/s/${SPACE}/home`);
  });

  it("survit au rechargement (stockage de l'onglet)", () => {
    sessionStorage.setItem("fm:return-to", `/s/${SPACE}/activity`);
    expect(recipeBackTarget(SPACE)).toBe(`/s/${SPACE}/activity`);
  });

  it("refuse une valeur qui n'est pas un chemin de l'appli", () => {
    sessionStorage.setItem("fm:return-to", "https://exemple.test/");
    expect(recipeBackTarget(SPACE)).toBe(`/s/${SPACE}/recipes`);
    sessionStorage.setItem("fm:return-to", "//exemple.test/");
    expect(recipeBackTarget(SPACE)).toBe(`/s/${SPACE}/recipes`);
  });
});

describe("recipeBackMove (geste retour coherent, D219)", () => {
  it("origine dans l'historique de l'onglet : on y remonte, sans empiler de page", () => {
    at(4);
    rememberPage(`/s/${SPACE}/meal-plan?view=week`);
    at(5);
    rememberPage(`/s/${SPACE}/recipes/${RECIPE}`);
    at(7);
    rememberPage(`/s/${SPACE}/recipes/${RECIPE}/history`);
    expect(recipeBackMove(SPACE)).toEqual({ delta: -3 });
  });

  it("origine inconnue de l'historique : on la remplace a la place de la recette", () => {
    expect(recipeBackMove(SPACE)).toEqual({ to: `/s/${SPACE}/recipes` });
    // Valeur d'avant la position retenue (deja en stockage au deploiement).
    sessionStorage.setItem("fm:return-to", `/s/${SPACE}/home`);
    at(3);
    expect(recipeBackMove(SPACE)).toEqual({ to: `/s/${SPACE}/home` });
  });

  it("position retenue pas en arriere de la page courante : chemin remplace", () => {
    at(6);
    rememberPage("/notifications");
    expect(recipeBackMove(SPACE)).toEqual({ to: "/notifications" });
    at(2);
    expect(recipeBackMove(SPACE)).toEqual({ to: "/notifications" });
  });
});

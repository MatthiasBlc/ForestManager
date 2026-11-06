// Mode cuisine (C3.9, F-REC-12, D100) : etapes en grand, ecran maintenu allume,
// ingredients a cocher dans une feuille (F-INGREDIENTS).
import type { Recipe } from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { buildRecipe, unitId, UNITS } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { cookIngredientGroups, cookSteps } from "./cook.ts";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
});

function mockWakeLock() {
  const release = vi.fn(() => Promise.resolve());
  const request = vi.fn(() => Promise.resolve({ release, released: false }));
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
  return { request, release };
}

function gratin(): Recipe {
  const base = buildRecipe({ title: "Gratin de pâtes", yieldQuantity: 4 });
  const block = base.blocks[0];
  if (block?.kind !== "LOCAL") throw new Error("bloc local attendu");
  return {
    ...base,
    blocks: [{ ...block, steps: ["Cuire les pâtes dans l'eau salée.", "Gratiner 20 min."] }],
  };
}

describe("ouvrir le mode cuisine", () => {
  it("depuis le detail, avec les portions choisies", async () => {
    const recipe = gratin();
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await screen.findByRole("heading", { name: "Gratin de pâtes" });
    await user.click(screen.getByRole("button", { name: "Plus" }));
    const links = screen.getAllByRole("link", { name: "Mode cuisine" });
    expect(links[0]).toHaveAttribute(
      "href",
      `/s/${s.space.id}/recipes/${recipe.id}/cook?servings=5`
    );
  });

  it("pas de mode cuisine pour une recette sans etape", async () => {
    const recipe = buildRecipe({
      blocks: [{ kind: "LOCAL", title: null, ingredients: [], steps: [] }],
    });
    const s = recipeServer({ recipes: [recipe] });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${recipe.id}` });
    await screen.findByRole("heading", { name: recipe.title });
    expect(screen.queryByRole("link", { name: "Mode cuisine" })).not.toBeInTheDocument();
  });
});

describe("E-MODE-CUISINE", () => {
  it("une etape a la fois, ingredients de l'etape a l'echelle", async () => {
    const recipe = gratin();
    const s = recipeServer({ recipes: [recipe] });
    const { user, container } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/cook?servings=8`,
    });
    expect(await screen.findByText("Étape 1 sur 2")).toBeInTheDocument();
    expect(screen.getByText("Gratin de pâtes")).toBeInTheDocument();
    expect(screen.getByText("Cuire les pâtes dans l'eau salée.")).toBeInTheDocument();
    const forStep = screen.getByRole("region", { name: "Pour cette étape" });
    expect(within(forStep).getByRole("checkbox", { name: "1 kg Pâtes" })).toBeInTheDocument();
    expect(within(forStep).queryByText("Sel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Précédente" })).toBeDisabled();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Suivante" }));
    expect(screen.getByText("Étape 2 sur 2")).toBeInTheDocument();
    expect(screen.getByText("Gratiner 20 min.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pour cette étape" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Terminer" }));
    expect(await screen.findByRole("heading", { name: "Gratin de pâtes" })).toBeInTheDocument();
  });

  it("quitter revient au detail", async () => {
    const recipe = gratin();
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/cook`,
    });
    await screen.findByText("Étape 1 sur 2");
    await user.click(screen.getByRole("button", { name: "Quitter le mode cuisine" }));
    expect(await screen.findByRole("heading", { name: "Gratin de pâtes" })).toBeInTheDocument();
  });

  it("F-INGREDIENTS : les cases cochees restent cochees d'une ouverture a l'autre", async () => {
    const recipe = gratin();
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/cook?servings=8`,
    });
    await screen.findByText("Étape 1 sur 2");
    await user.click(screen.getByRole("button", { name: "Ingrédients" }));
    const sheet = await screen.findByRole("dialog", { name: "Ingrédients pour 8 pers." });
    await user.click(within(sheet).getByRole("checkbox", { name: "1 kg Pâtes" }));
    expect(within(sheet).getByText(/Rien n'est enregistré sur la recette/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    // La case de l'etape suit la feuille.
    expect(screen.getByRole("checkbox", { name: "1 kg Pâtes" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await user.click(screen.getByRole("button", { name: "Ingrédients" }));
    const again = await screen.findByRole("dialog");
    expect(within(again).getByRole("checkbox", { name: "1 kg Pâtes" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("ecran maintenu allume, libere en quittant", async () => {
    const lock = mockWakeLock();
    const recipe = gratin();
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}/cook`,
    });
    expect(await screen.findByText("Écran maintenu allumé")).toBeInTheDocument();
    expect(lock.request).toHaveBeenCalledWith("screen");
    await user.click(screen.getByRole("button", { name: "Quitter le mode cuisine" }));
    await screen.findByRole("heading", { name: "Gratin de pâtes" });
    expect(lock.release).toHaveBeenCalled();
  });

  it("sans Wake Lock : pas de promesse d'ecran allume", async () => {
    const recipe = gratin();
    const s = recipeServer({ recipes: [recipe] });
    renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes/${recipe.id}/cook` });
    await screen.findByText("Étape 1 sur 2");
    expect(screen.queryByText("Écran maintenu allumé")).not.toBeInTheDocument();
  });
});

describe("etapes et ingredients a plat (cook.ts)", () => {
  function composed(): Recipe {
    const sub = buildRecipe({
      title: "Sauce teriyaki",
      yieldQuantity: 300,
      yieldUnitId: unitId("ml"),
      blocks: [
        {
          kind: "LOCAL",
          title: null,
          ingredients: [
            {
              ingredientId: crypto.randomUUID(),
              name: "Sauce soja",
              namePlural: null,
              quantity: 100,
              unitId: unitId("ml"),
              note: null,
              optional: false,
            },
          ],
          steps: ["Mélanger la sauce soja et le mirin."],
        },
      ],
    });
    return buildRecipe({
      title: "Saumon teriyaki",
      yieldQuantity: 2,
      blocks: [
        {
          kind: "RECIPE",
          recipeId: sub.id,
          quantity: 150,
          unitId: unitId("ml"),
          status: "AVAILABLE",
          recipe: {
            id: sub.id,
            title: sub.title,
            yieldQuantity: sub.yieldQuantity,
            yieldUnitId: sub.yieldUnitId,
            isBase: true,
            blocks: sub.blocks,
          },
        },
        {
          kind: "LOCAL",
          title: "Saumon",
          ingredients: [
            {
              ingredientId: crypto.randomUUID(),
              name: "Saumon",
              namePlural: "Saumons",
              quantity: 2,
              unitId: null,
              note: null,
              optional: false,
            },
          ],
          steps: ["Saisir les saumons 3 minutes par face."],
        },
      ],
    });
  }

  it("les etapes d'une sous-recette portent son nom et la quantite utilisee", () => {
    const steps = cookSteps(composed(), UNITS, 2);
    expect(steps.map((step) => step.text)).toEqual([
      "Mélanger la sauce soja et le mirin.",
      "Saisir les saumons 3 minutes par face.",
    ]);
    expect(steps[0]?.block).toEqual({ title: "Sauce teriyaki", linked: true, amount: "300 ml" });
    expect(steps[0]?.ingredients.map((line) => line.amount)).toEqual(["100 ml"]);
    expect(steps[1]?.block).toEqual({ title: "Saumon", linked: false, amount: null });
    // Le pluriel du nom compte aussi.
    expect(steps[1]?.ingredients.map((line) => line.name)).toEqual(["Saumon"]);
  });

  it("ingredients groupes par bloc, a l'echelle", () => {
    const groups = cookIngredientGroups(composed(), UNITS, 1);
    expect(groups.map((group) => [group.title, group.amount])).toEqual([
      ["Sauce teriyaki", "150 ml"],
      ["Saumon", null],
    ]);
    expect(groups[0]?.ingredients[0]?.amount).toBe("50 ml");
  });
});

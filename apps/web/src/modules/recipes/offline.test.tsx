// Recettes hors ligne (C3.9, D106) : recettes deja ouvertes lisibles, badge sur les
// cartes, ecritures desactivees (pas masquees).
import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../../app/App.tsx";
import { buildRecipe } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => {
    setOnline(true);
  });
});

describe("liste hors ligne (E-RECETTES-HorsLigne)", () => {
  it("montre les recettes deja ouvertes avec un badge, creation desactivee", async () => {
    const opened = buildRecipe({ title: "Dahl de lentilles" });
    const other = buildRecipe({ title: "Tarte aux pommes" });
    const s = recipeServer({ recipes: [opened, other] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${opened.id}`,
    });
    await screen.findByRole("heading", { name: "Dahl de lentilles" });
    act(() => {
      setOnline(false);
    });
    await user.click(screen.getByRole("button", { name: "Retour" }));

    expect(
      await screen.findByText("Disponibles hors ligne : 1 recette ouverte récemment.")
    ).toBeInTheDocument();
    const card = screen.getByRole("article", { name: "Dahl de lentilles" });
    expect(within(card).getByText("Hors ligne")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Tarte aux pommes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nouvelle recette" })).toBeDisabled();
  });

  it("rien d'ouvert : le dit au lieu de charger sans fin", async () => {
    const s = recipeServer({ recipes: [buildRecipe()] });
    const { user } = renderWithProviders(<App />, { route: `/s/${s.space.id}/home` });
    await screen.findByRole("heading", { level: 1 });
    act(() => {
      setOnline(false);
    });
    await user.click(screen.getAllByRole("link", { name: "Recettes" })[0] as HTMLElement);
    expect(await screen.findByText("Aucune recette disponible hors ligne")).toBeInTheDocument();
  });
});

describe("detail hors ligne", () => {
  it("lecture et mode cuisine restent, modifier est desactive avec la raison", async () => {
    const recipe = buildRecipe({ title: "Dahl de lentilles" });
    const s = recipeServer({ recipes: [recipe] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${recipe.id}`,
    });
    await screen.findByRole("heading", { name: "Dahl de lentilles" });
    act(() => {
      setOnline(false);
    });
    const edit = await screen.findByRole("button", { name: "Modifier" });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAccessibleDescription(/Hors ligne/);
    expect(screen.getAllByRole("link", { name: "Mode cuisine" }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Plus d'actions" }));
    const share = await screen.findByRole("menuitem", { name: "Partager dans un espace" });
    expect(share).toHaveAttribute("aria-disabled", "true");
  });

  it("recette jamais ouverte : indisponible hors ligne", async () => {
    const sauce = buildRecipe({ title: "Sauce teriyaki", isBase: true });
    const plat = buildRecipe({
      title: "Saumon teriyaki",
      blocks: [
        {
          kind: "RECIPE",
          recipeId: sauce.id,
          quantity: 1,
          unitId: null,
          status: "AVAILABLE",
          recipe: {
            id: sauce.id,
            title: sauce.title,
            yieldQuantity: sauce.yieldQuantity,
            yieldUnitId: null,
            isBase: true,
            blocks: sauce.blocks,
          },
        },
      ],
    });
    const s = recipeServer({ recipes: [sauce, plat] });
    const { user } = renderWithProviders(<App />, {
      route: `/s/${s.space.id}/recipes/${plat.id}`,
    });
    await screen.findByRole("heading", { name: "Saumon teriyaki" });
    act(() => {
      setOnline(false);
    });
    // La sous-recette n'a jamais ete ouverte seule : elle n'est pas sur l'appareil.
    await user.click(screen.getByRole("link", { name: "Sauce teriyaki" }));
    expect(
      await screen.findByRole("heading", { name: "Pas encore disponible hors ligne" })
    ).toBeInTheDocument();
  });
});
